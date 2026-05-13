# 13 — Checklist de producción

Cinta lista para `git tag v1.0.0`. Ningún ítem es opcional.

## A. Calidad de código

- [ ] `npm run typecheck` ✔ sin errores
- [ ] `npm run lint` ✔ sin warnings
- [ ] `npm test` ✔ 11/11
- [ ] `npm run build` ✔ sin errores
- [ ] Cobertura tests dominio + workflow ≥ 80%

## B. Supabase Cloud

- [ ] Proyecto creado en región `sa-east-1`
- [ ] `npx supabase db push` aplicó 0001..0021 sin error
- [ ] RLS **ON** en todas las tablas con `org_id`
- [ ] Buckets `pqrs-adjuntos`, `respuestas`, `normativa` creados y privados
- [ ] Auth: SMTP propio (Resend/SES) configurado
- [ ] Auth: Site URL y Redirect URLs apuntan al dominio de producción
- [ ] `confirm email = true` en prod
- [ ] DB password rotado y guardado en gestor de secretos (no en el repo)
- [ ] Habilitado **Point-in-time recovery** (PITR) en plan Pro+
- [ ] Configurado backup automático diario
- [ ] Job programado: snapshot Power BI (`fn_pbi_snapshot`) — vía Vercel Cron

## C. Vercel

- [ ] Proyecto enlazado al repo GitHub
- [ ] Production branch = `main`
- [ ] Variables de entorno completas (ver `docs/12`)
- [ ] `CRON_SECRET` rotado (32+ chars aleatorios)
- [ ] `AI_MOCK_MODE=false` en prod
- [ ] Dominio principal configurado (`app.tu-dominio.co`)
- [ ] Wildcard `*.tu-dominio.co` configurado (subdominios por tenant)
- [ ] Cron jobs activos en `Settings → Cron Jobs` (3 jobs)
- [ ] Logs de funciones revisados sin errores 5xx
- [ ] Tasa de error < 1% en últimas 24h

## D. Seguridad

- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en variables server-side
- [ ] Nunca expuesta en `NEXT_PUBLIC_*`
- [ ] `CRON_SECRET` único por entorno
- [ ] `POWERBI_API_SECRET` rotable y guardado encriptado
- [ ] CSP en `middleware.ts` revisada para tu dominio
- [ ] HSTS habilitado (lo emite el middleware)
- [ ] Rate limit configurado para endpoints públicos (`/api/pqrs`, `/api/ai/chat`)
- [ ] Política de retención de PII documentada (Ley 1581/2012)
- [ ] Consentimiento de tratamiento de datos en formulario público
- [ ] Auditoría: tabla `audit_log` sin política UPDATE/DELETE para nadie

## E. IA

- [ ] Claude Anthropic key con límite mensual configurado
- [ ] OpenAI key con límite mensual configurado
- [ ] Embeddings cargados a `knowledge_base_chunks` (Ley 142/94, CREG 108/97, SSPD, CCU)
- [ ] Guardrails verificados: `scanPromptInjection` no bloquea casos legítimos en muestra
- [ ] `pii_patterns` revisados para Colombia (CC 8-10 dígitos, celular 3XX...)
- [ ] Logs de `ai_interactions` no contienen PII no enmascarada (muestreo aleatorio)

## F. Notificaciones

- [ ] Dominio DKIM/SPF configurado para Resend
- [ ] Plantillas WhatsApp aprobadas por Meta (si se usa)
- [ ] Pruebas E2E: crear PQRS → recibir email de acuse
- [ ] Reintentos verificados: forzar fallo → ver `notification_attempts`

## G. Power BI

- [ ] `api_keys` creada para Power BI con scope `readonly` + expiración 90 días
- [ ] Power BI Desktop probado contra `/api/powerbi/*` con datos reales
- [ ] Refresh programado en Power BI (no más frecuente que el cron de snapshot)
- [ ] Dashboard ejecutivo publicado en workspace privado

## H. DevOps

- [ ] CI verde en `main`
- [ ] CD desplegado a producción al merge
- [ ] Sentry conectado (DSN en `SENTRY_DSN`)
- [ ] OpenTelemetry exportando spans a tu APM (opcional)
- [ ] Healthcheck `/api/health` (pendiente de implementar)
- [ ] Runbook de incidentes documentado
- [ ] Rotación de claves agendada (cuatrimestral)

## I. Datos iniciales por tenant

Por cada tenant que entra en producción:

- [ ] `organizations` creada con slug, NIT, dominio, branding
- [ ] Plan asignado correcto
- [ ] Admin inicial creado (`scripts/seed-admin.ts`)
- [ ] `legal_terms` adicionales por causal específica de esa empresa (opcional)
- [ ] `response_templates` personalizadas para esa empresa
- [ ] `holidays_co` del año vigente cargados
- [ ] Documentos normativos internos cargados al bucket `normativa` y procesados a `knowledge_base_chunks`
- [ ] Usuarios funcionarios invitados con sus roles

## J. Validación funcional final

Probar manualmente como cada rol:

- [ ] **Ciudadano**: radicar PQRS, consultar su radicado, no debe ver casos de otros.
- [ ] **Agente**: ver bandeja, clasificar, transferir.
- [ ] **Analista**: crear orden interna, proyectar respuesta.
- [ ] **Supervisor**: aprobar respuesta, decidir recurso.
- [ ] **Jurídico**: dictamen, escalar a SSPD.
- [ ] **Técnico**: ver orden, completar checklist (cuando UI esté lista), subir fotos.
- [ ] **Admin**: crear plantillas, parámetros, ver auditoría.
- [ ] **Auditor**: consultar `audit_log`, sin permiso de modificar nada.

## K. Documentación

- [ ] README con instrucciones de instalación verificadas
- [ ] `docs/12-DESPLIEGUE-Y-PRUEBAS.md` revisado
- [ ] Política de privacidad publicada (`/privacidad`)
- [ ] Términos de uso publicados (`/terminos`)
- [ ] Manual del funcionario (PDF interno)
- [ ] Capacitación impartida a equipo PQRS de cada tenant
