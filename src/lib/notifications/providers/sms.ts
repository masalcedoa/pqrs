/** Stub SMS — sustituir por Twilio/MasivoSMS/Movistar API según contrato. */
export async function sendSMS(opts: { to: string; body: string }) {
  void opts;
  return { ok: false, provider: 'stub', error: 'Proveedor SMS no configurado' };
}
