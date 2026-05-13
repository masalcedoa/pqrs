/**
 * Definiciones de tools (function calling) que el agente conversacional puede invocar.
 * El runtime de routing está en `src/app/api/ai/chat/route.ts` cuando se habilite tool-use.
 *
 * Schema sigue convención Anthropic / OpenAI function calling.
 */
export const tools = [
  {
    name: 'crear_radicado',
    description: 'Crea una PQRS nueva en el sistema cuando el usuario ya entregó datos suficientes.',
    input_schema: {
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['persona_natural','persona_juridica'] },
            document_type: { type: 'string', enum: ['CC','CE','NIT','TI','PA'] },
            document_id: { type: 'string' },
            full_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' }
          },
          required: ['document_type','document_id','full_name']
        },
        service_account: {
          type: 'object',
          properties: {
            account_number: { type: 'string' },
            address: { type: 'string' },
            municipality: { type: 'string' }
          }
        },
        type:      { type: 'string' },
        category:  { type: 'string' },
        narrative: { type: 'string' }
      },
      required: ['customer','type','narrative']
    }
  },
  {
    name: 'validar_cuenta',
    description: 'Verifica si una cuenta contrato existe y devuelve titular, dirección y estado.',
    input_schema: {
      type: 'object',
      properties: { account_number: { type: 'string' } },
      required: ['account_number']
    }
  },
  {
    name: 'consultar_estado_caso',
    description: 'Devuelve estado, fechas y última actualización de un radicado.',
    input_schema: {
      type: 'object',
      properties: { radicado: { type: 'string' }, document_id: { type: 'string' } },
      required: ['radicado']
    }
  },
  {
    name: 'consultar_normativa',
    description: 'Busca normativa o procedimiento aplicable en la base de conocimiento (RAG).',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, top_k: { type: 'number' } },
      required: ['query']
    }
  },
  {
    name: 'sugerir_orden_interna',
    description: 'Dado un case_id, sugiere el tipo de orden interna a generar y describe su alcance.',
    input_schema: {
      type: 'object',
      properties: { case_id: { type: 'string' } },
      required: ['case_id']
    }
  },
  {
    name: 'redactar_respuesta',
    description: 'Genera un borrador de respuesta para un caso usando plantilla y normativa relevante.',
    input_schema: {
      type: 'object',
      properties: { case_id: { type: 'string' }, template_code: { type: 'string' } },
      required: ['case_id']
    }
  }
] as const;

export type ToolName = (typeof tools)[number]['name'];
