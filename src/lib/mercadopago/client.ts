import { MercadoPagoConfig } from "mercadopago";

let _client: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!_client) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured");
    }
    _client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10000 },
    });
  }
  return _client;
}
