# PQRS Energía — Plataforma SaaS de gestión

Sistema integral para recepción, clasificación, trámite, respuesta y seguimiento de PQRS (peticiones, quejas, reclamos, solicitudes y recursos) para empresas prestadoras del servicio público de energía eléctrica en Colombia.

Cumple con el marco normativo: **Ley 142 de 1994**, **Resolución CREG 108 de 1997**, lineamientos SSPD, trámites de **reclamación, recurso de reposición y apelación**, y término general de **15 días hábiles** (parametrizable por causal).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Supabase Edge Functions
- **DB**: Supabase PostgreSQL + `pgvector` para RAG
- **Auth**: Supabase Auth (email + magic link + OAuth)
- **Storage**: Supabase Storage (buckets: `pqrs-adjuntos`, `respuestas`, `normativa`)
- **IA**: Claude (Anthropic) + OpenAI embeddings (configurable)
- **Hosting**: Vercel
- **Reportería**: Vistas SQL + endpoints REST → Power BI

## Estructura del repositorio

```
05-PQRS/
├── docs/                     # Arquitectura, modelo, roadmap, seguridad, agente IA
├── supabase/migrations/      # Scripts SQL incrementales (0001..0011)
├── supabase/functions/       # Edge Functions (term-calc, notify, ingest-rag)
├── src/app/                  # Rutas Next.js (público, auth, dashboard, api)
├── src/components/           # UI, formularios, chat IA, layout
├── src/lib/                  # Clientes Supabase, IA, utilidades
├── src/types/                # Tipos TypeScript del dominio
├── .env.example
└── package.json
```

## Instalación local

```bash
# 1. Clonar e instalar
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar con credenciales Supabase + Anthropic + OpenAI

# 3. Aplicar migraciones en Supabase
# Opción A: Supabase CLI
supabase link --project-ref <ref>
supabase db push

# Opción B: ejecutar manualmente los .sql en orden desde supabase/migrations/

# 4. Levantar
npm run dev
```

## Despliegue

- **Vercel**: conectar el repo, definir variables de entorno, deploy.
- **Supabase**: crear proyecto, ejecutar migraciones, configurar buckets de Storage y políticas RLS.

Ver `docs/01-ARQUITECTURA.md` y `docs/03-ROADMAP.md` para detalle por fases.

## Roles

`ciudadano · agente · analista · supervisor · juridico · tecnico · admin · auditor`

## Módulos

1. Portal público de radicación  2. Agente IA conversacional  3. Clasificación automática
4. Validación de cuenta/medidor  5. Expedientes  6. Control de términos legales
7. Bandejas por área  8. Órdenes internas  9. Documental y adjuntos
10. Respuestas asistidas por IA  11. Recursos (reposición/apelación)  12. Escalamiento SSPD
13. Notificaciones multicanal  14. Dashboard KPI  15. API Power BI  16. Auditoría

## Licencia

Propietario.
