# 10 — Testing

## Estrategia

| Nivel              | Herramienta | Foco                                                          |
|--------------------|-------------|---------------------------------------------------------------|
| Unitario (dominio) | Vitest      | Reglas de workflow, validadores, masking PII, guardrails IA   |
| Integración        | Vitest + Supabase local | Repos contra DB en docker-compose                  |
| Contrato API       | Vitest + fetch | Rutas Next.js con `request.json()` mockeado                 |
| E2E                | Playwright (siguiente fase) | Flujo radicación + transición + respuesta      |
| Seguridad          | Vitest      | Prompt injection, RLS bypass intentos                         |

## Comandos

```bash
npm test               # corre toda la suite
npm run test:watch     # modo watch
npm run test:coverage  # con cobertura v8
```

## Cobertura objetivo

- Dominio (`src/domain`) y motor workflow (`src/lib/workflow`): **≥ 90%**.
- Guardrails IA: **≥ 80%**.
- API routes críticas (`/api/pqrs`, `/transition`): **≥ 70%**.

## Mocks

- `@/lib/supabase/server` se mockea con `vi.mock()` en pruebas que no requieren DB.
- Para pruebas de integración real, levantar Supabase local con CLI:

```bash
supabase start
SUPABASE_URL=http://localhost:54321 \
SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm test
```

## Lo que ya está cubierto

- `tests/workflow/engine.test.ts` — 8 casos: transiciones permitidas, rol, fields, reglas temporales.
- `tests/ai/guardrails.test.ts` — 3 casos: prompt injection, leak secrets, texto inocuo.
