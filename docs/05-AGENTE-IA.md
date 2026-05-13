# 05 — Diseño del agente IA

## Roles del agente

1. **Asistente público de radicación** (modelo rápido, `claude-haiku-4-5`).
   - Conversa con el ciudadano y lo guía a radicar la PQRS.
   - Identifica tipo, categoría, causal, prioridad y si requiere visita técnica.
   - Crea el radicado vía tool.

2. **Clasificador interno** (`claude-haiku-4-5`).
   - Lee la narrativa y devuelve JSON estricto con los campos de clasificación.
   - Alimenta `pqrs_classifications` con `source='ai'` y `confidence`.

3. **Redactor jurídico** (`claude-opus-4-7`).
   - Genera borradores de respuesta basados en plantilla, contexto del caso y normativa relevante (RAG).
   - Toda respuesta debe ser revisada y aprobada antes de notificarse.

4. **Asesor normativo** (RAG).
   - Tool `consultar_normativa(consulta, top_k)`.
   - Hace `embedding` de la consulta y recupera chunks de `knowledge_base_chunks` por similitud coseno.

## Prompt del asistente público (extracto operativo)

> Eres el asistente virtual de PQRS de una empresa prestadora del servicio público de energía
> eléctrica en Colombia. Tu objetivo es ayudar al usuario ciudadano a radicar correctamente
> una PQRS conforme a la Ley 142 de 1994, Resolución CREG 108 de 1997 y lineamientos SSPD.
> 1. Mantén un tono claro, cordial y respetuoso.
> 2. Solicita solo lo necesario: documento, número, nombre, número de cuenta, dirección, hechos, periodo, evidencia.
> 3. Clasifica tipo y categoría.
> 4. Sugiere prioridad razonada.
> 5. Cuando tengas los datos, llama a la tool "crear_radicado".
> 6. Nunca prometas decisiones favorables; informa el trámite y término legal aplicable.
> 7. Si es recurso de reposición o apelación, indica los términos y requisitos.
> 8. Nunca inventes normativa: si dudas, deriva al área jurídica.

(Versión completa en `src/lib/ai/agent.ts`.)

## Tools (function calling)

| Tool                       | Inputs                                  | Acción                                       |
|----------------------------|------------------------------------------|-----------------------------------------------|
| `crear_radicado`           | payload de radicación                    | POST `/api/pqrs`                              |
| `validar_cuenta`           | numero_cuenta                            | Lee `service_accounts`                        |
| `consultar_estado_caso`    | radicado, documento del titular          | Lee `pqrs_cases` + último estado              |
| `sugerir_clasificacion`    | texto                                    | Devuelve `Clasificacion`                      |
| `sugerir_orden_interna`    | case_id                                  | Sugiere `work_order_type`                     |
| `consultar_normativa`      | consulta, top_k                          | RAG en `knowledge_base_chunks`                |
| `redactar_respuesta`       | case_id, template_id?                    | Devuelve borrador + log en `ai_interactions`  |

## Trazabilidad

- Cada llamada se guarda en `ai_interactions` con prompt/respuesta, modelo, tokens, costo, latencia y `case_id` opcional.
- Para chats públicos largos, se persiste el último contexto (k últimos turnos) y resumen del caso.

## Guardarraíles

- No revelar datos de otros usuarios.
- No emitir decisiones jurídicas vinculantes.
- Si el ciudadano insiste en respuesta inmediata, recordar el término legal y derivar a humano.
- Sanitizar prompts para no enviar PII al modelo cuando no sea necesaria.

## RAG — ingest

1. Cargar PDFs/TXT de Ley 142/94, CREG 108/97, resoluciones SSPD, CCU, manuales internos en bucket `normativa`.
2. Edge Function `ingest-rag` (pendiente Fase 5):
   - Extrae texto, hace chunking (~800 tokens con solape 100).
   - Embeddings (`text-embedding-3-small`, 1536 dim).
   - Inserta en `knowledge_base_chunks` con `document_id` y `chunk_index`.
3. Consulta: `embedding <=> :query` con `vector_cosine_ops`.
