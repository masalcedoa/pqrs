import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const VIEW_MAP: Record<string, string> = {
  radicados_dia:        'v_pbi_radicados_dia',
  radicados_mes:        'v_pbi_radicados_mes',
  radicados_anio:       'v_pbi_radicados_anio',
  por_tipo:             'v_pbi_por_tipo',
  por_causal:           'v_pbi_por_causal',
  por_municipio:        'v_pbi_por_municipio',
  por_area:             'v_pbi_por_area',
  vencidos:             'v_pbi_vencidos',
  por_vencer:           'v_pbi_por_vencer',
  tiempo_respuesta:     'v_pbi_tiempo_respuesta',
  ordenes_generadas:    'v_pbi_ordenes_generadas',
  reincidencia:         'v_pbi_reincidencia',
  reclamos_facturacion: 'v_pbi_reclamos_facturacion',
  reclamos_consumo:     'v_pbi_reclamos_consumo',
  reclamos_medidor:     'v_pbi_reclamos_medidor',
  recursos_reposicion:  'v_pbi_recursos_reposicion',
  apelaciones:          'v_pbi_apelaciones',
  escalados_sspd:       'v_pbi_escalados_sspd',
  efectividad:          'v_pbi_efectividad',
  productividad:        'v_pbi_productividad_analista',
  ranking_causales:     'v_pbi_ranking_causales'
};

export async function GET(req: Request, { params }: { params: { metric: string } }) {
  const token = req.headers.get('x-api-token');
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 401 });

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createSupabaseServiceClient();
  const { data: key } = await supabase
    .from('api_keys').select('id, is_active, expires_at')
    .eq('hash_sha256', hash).single();

  if (!key?.is_active) return NextResponse.json({ error: 'token inválido' }, { status: 401 });
  if (key.expires_at && new Date(key.expires_at) < new Date())
    return NextResponse.json({ error: 'token expirado' }, { status: 401 });

  const view = VIEW_MAP[params.metric];
  if (!view) return NextResponse.json({ error: 'métrica desconocida' }, { status: 404 });

  const { data, error } = await supabase.from(view).select('*').limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('api_keys').update({ last_used: new Date().toISOString() }).eq('id', key.id);
  return NextResponse.json({ metric: params.metric, rows: data });
}
