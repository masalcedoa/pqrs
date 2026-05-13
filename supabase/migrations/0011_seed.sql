-- 0011_seed.sql
-- Datos semilla: unidades, términos legales por defecto (CREG 108/97 - 15 días hábiles),
-- festivos colombianos del año en curso (mínimo viable), plantillas base.

-- Unidades organizacionales
insert into organizational_units (code, name, description) values
  ('ATC',  'Atención al Cliente',         'Recepción y primera línea PQRS'),
  ('COM',  'Comercial / Facturación',     'Revisiones comerciales, ajustes'),
  ('TEC',  'Operación Técnica',           'Visitas, lecturas, medidores'),
  ('JUR',  'Jurídica / Regulación',       'Recursos, SSPD, conceptos'),
  ('ADM',  'Administración del sistema',  'Parámetros, accesos')
on conflict (code) do nothing;

-- Términos legales por defecto (15 días hábiles para la mayoría; visita técnica suma)
-- Fundamento: Ley 142/94 (art. 158), CREG 108/97 y lineamientos SSPD
insert into legal_terms (pqrs_type, category, subcategory, causal, requires_visit, days_business, legal_basis) values
  ('peticion',           null,              null, null, false, 15, 'Ley 142/94 art. 158 - término general'),
  ('queja',              null,              null, null, false, 15, 'Ley 142/94 art. 158'),
  ('reclamo',            'facturacion',     null, null, false, 15, 'Ley 142/94 art. 154/158; CREG 108/97'),
  ('reclamo',            'consumo_elevado', null, null, true,  15, 'Reclamo con visita técnica - CREG 108/97'),
  ('reclamo',            'medidor',         null, null, true,  15, 'Reclamo medidor con verificación técnica'),
  ('reclamo',            'lectura',         null, null, true,  15, 'Reclamo lectura con verificación'),
  ('reclamo',            'suspension',      null, null, false, 15, 'Reclamo por suspensión'),
  ('reclamo',            'reconexion',      null, null, false, 15, 'Reclamo por reconexión'),
  ('reclamo',            'calidad_servicio',null, null, true,  15, 'Reclamo calidad - verificación técnica'),
  ('reclamo',            'dano_electrico',  null, null, true,  15, 'Reclamo por daño - inspección'),
  ('reclamo',            'cobros',          null, null, false, 15, 'Reclamo cobros'),
  ('recurso_reposicion', null,              null, null, false, 15, 'Recurso de reposición - art. 159 Ley 142/94'),
  ('recurso_apelacion',  null,              null, null, false, 15, 'Apelación ante SSPD'),
  ('denuncia',           null,              null, null, false, 15, 'Denuncia general'),
  ('solicitud_tecnica',  null,              null, null, false, 15, 'Solicitudes técnicas')
on conflict do nothing;

-- Plantillas base de respuesta
insert into response_templates (code, name, pqrs_type, category, subject, body) values
  ('GEN-ACUSE', 'Acuse de recibo general', null, null,
   'Acuse de recibo PQRS {{caso.radicado}}',
   'Estimado/a {{cliente.nombre}}, confirmamos la recepción de su {{caso.tipo}} con radicado {{caso.radicado}} el día {{caso.fecha}}. Daremos respuesta dentro del término legal de {{caso.dias}} días hábiles.'),
  ('FAC-AJUSTE','Respuesta ajuste de facturación', 'reclamo', 'facturacion',
   'Respuesta reclamo {{caso.radicado}}',
   'Estimado/a {{cliente.nombre}}, una vez analizado su reclamo {{caso.radicado}} sobre la facturación del periodo {{periodo}}, se procede a {{decision}}. Fundamento normativo: Ley 142/94 y CCU vigente.'),
  ('CONSUMO-VISITA','Resultado visita por consumo elevado', 'reclamo', 'consumo_elevado',
   'Resultado revisión consumo - {{caso.radicado}}',
   'En atención al reclamo {{caso.radicado}}, se realizó visita técnica el {{visita.fecha}}. Hallazgos: {{visita.hallazgos}}. Decisión: {{decision}}.'),
  ('RECURSO-REP', 'Decisión recurso de reposición', 'recurso_reposicion', null,
   'Decisión recurso de reposición - {{caso.radicado}}',
   'Resuelto el recurso de reposición {{caso.radicado}}, la empresa {{decision}}. El usuario puede interponer recurso de apelación ante la SSPD dentro del término legal.')
on conflict (code) do nothing;

-- Festivos Colombia (subset reciente; cargar el calendario completo desde aplicación)
insert into holidays_co (holiday_date, name) values
  ('2026-01-01','Año Nuevo'),
  ('2026-01-12','Día de los Reyes Magos'),
  ('2026-03-23','Día de San José'),
  ('2026-04-02','Jueves Santo'),
  ('2026-04-03','Viernes Santo'),
  ('2026-05-01','Día del Trabajo'),
  ('2026-05-18','Ascensión del Señor'),
  ('2026-06-08','Corpus Christi'),
  ('2026-06-15','Sagrado Corazón'),
  ('2026-06-29','San Pedro y San Pablo'),
  ('2026-07-20','Independencia'),
  ('2026-08-07','Batalla de Boyacá'),
  ('2026-08-17','Asunción de la Virgen'),
  ('2026-10-12','Día de la Raza'),
  ('2026-11-02','Todos los Santos'),
  ('2026-11-16','Independencia de Cartagena'),
  ('2026-12-08','Inmaculada Concepción'),
  ('2026-12-25','Navidad')
on conflict do nothing;
