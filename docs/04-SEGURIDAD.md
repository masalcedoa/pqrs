# 04 — Seguridad y cumplimiento

## Marco normativo aplicable

- **Ley 142 de 1994** — Régimen de servicios públicos domiciliarios.
- **Resolución CREG 108 de 1997** — Criterios de protección al usuario del servicio de energía.
- **Lineamientos SSPD** — Trámite de PQRS, escalamiento y reportes.
- **Ley 1581 de 2012 (Habeas Data)** + Decreto 1377/2013 — Protección de datos personales.
- **Ley 1437 de 2011 / Ley 1755 de 2015** — Derecho de petición.
- **Circular SSPD vigente** sobre canales electrónicos y firma electrónica.

## Controles técnicos

1. **Autenticación**
   - Supabase Auth: email + magic link y OAuth opcional.
   - MFA recomendado para roles administrativos.
   - JWT con claim `role` derivado de `users_profile.role` (set vía hook de Supabase).

2. **Autorización (RLS)**
   - Habilitada en todas las tablas operativas (ver `0010_rls_policies.sql`).
   - Función `fn_current_role()` lee el rol del usuario autenticado.
   - Ciudadanos solo acceden a casos donde `customers.user_id = auth.uid()`.

3. **Cifrado**
   - TLS en tránsito.
   - Cifrado en reposo a nivel Supabase.
   - Adjuntos en Storage con URLs firmadas (TTL 5–15 min).

4. **Auditoría**
   - Trigger `trg_audit_row()` registra INSERT/UPDATE/DELETE en tablas críticas.
   - Tabla `audit_log` inmutable (sin política UPDATE/DELETE — el admin no debe poder editar).
   - Histórico de estado en `pqrs_status_history`.

5. **Trazabilidad IA**
   - Cada llamada al modelo guarda prompt, respuesta, costo y latencia.
   - Borradores generados por IA siempre requieren aprobación humana antes de notificar al ciudadano.

6. **Power BI y APIs externas**
   - `api_keys` hash SHA-256, scope y vencimiento.
   - Rate limit por token (próxima iteración).

## Política de retención

- Casos: retención mínima 5 años desde el cierre (regulatoria SSPD).
- Datos personales: anonimización solicitable por el titular (derecho de supresión, Ley 1581).
- Auditoría: 10 años.

## Consentimiento

- En el formulario público de radicación se incluye checkbox de **tratamiento de datos personales**, con enlace a la política de privacidad.
- Pendiente: redactar política de privacidad e incorporar texto al `<form>`.

## Riesgos a mitigar

| Riesgo                                      | Mitigación                                              |
|---------------------------------------------|---------------------------------------------------------|
| Filtración de datos personales por logs IA  | No incluir documento ni dirección en prompts; tokenizar |
| Respuestas IA con errores normativos        | Aprobación humana obligatoria; RAG sobre normativa      |
| Vencimientos legales                        | Job diario + alertas; tablero dedicado                  |
| Suplantación al radicar                     | Validación cuenta contrato; alertas anti-fraude         |
| Acceso indebido a expedientes               | RLS estricta + auditoría completa                       |
