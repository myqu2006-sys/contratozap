// api/criar-cobranca.js
// Recebe { amount, description, email } do app e cria uma order Pix no Mercado Pago.
// Devolve { orderId, qrCode, qrCodeBase64 } para o front-end mostrar o QR real.
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, description, email } = req.body || {};

  if (!amount || !email) {
    return res.status(400).json({ error: 'amount e email são obrigatórios' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
  }

  const idempotencyKey = randomUUID();
  const externalReference = 'contratozap_' + Date.now();

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        type: 'online',
        total_amount: Number(amount).toFixed(2),
        external_reference: externalReference,
        processing_mode: 'automatic',
        transactions: {
          payments: [
            {
              amount: Number(amount).toFixed(2),
              payment_method: { id: 'pix', type: 'bank_transfer' }
            }
          ]
        },
        payer: { email }
      })
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      return res.status(mpResponse.status).json({ error: 'Erro do Mercado Pago', details: data });
    }

    const payment = data.transactions?.payments?.[0];
    if (!payment) {
      return res.status(502).json({ error: 'Resposta inesperada do Mercado Pago', details: data });
    }

    return res.status(200).json({
      orderId: data.id,
      status: data.status,
      qrCode: payment.payment_method.qr_code,
      qrCodeBase64: payment.payment_method.qr_code_base64,
      ticketUrl: payment.payment_method.ticket_url
    });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao criar cobrança', details: String(err) });
  }
}
