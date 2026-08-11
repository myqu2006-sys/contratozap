// api/verificar-pagamento.js
// Recebe ?orderId=XXX e consulta o Mercado Pago pra saber se já foi pago.
// O front-end chama isso a cada poucos segundos enquanto o cliente escaneia o QR code.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { orderId } = req.query;
  if (!orderId) {
    return res.status(400).json({ error: 'orderId é obrigatório' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
  }

  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({ error: 'Erro do Mercado Pago', details: data });
    }

    // status possíveis: "action_required" (aguardando pagamento), "processed" (pago), "canceled", "expired"
    const paid = data.status === 'processed';

    return res.status(200).json({ status: data.status, paid });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao verificar pagamento', details: String(err) });
  }
}
