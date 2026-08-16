// Cliente mínimo da API oficial de Checkout InfinitePay.
// Documentação: https://www.infinitepay.io/checkout-documentacao

const BASE_URL = 'https://api.checkout.infinitepay.io';

async function request(path, body) {
  const response = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `InfinitePay HTTP ${response.status}`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

export function getConfig() {
  return {
    handle: process.env.INFINITEPAY_HANDLE || '',
    redirectUrl: process.env.INFINITEPAY_REDIRECT_URL || '',
    webhookUrl: process.env.INFINITEPAY_WEBHOOK_URL || '',
  };
}

export async function criarCheckout({ handle, items, orderNsu, redirectUrl, webhookUrl, customer, address }) {
  if (!handle) throw new Error('INFINITEPAY_HANDLE não configurado');
  if (!Array.isArray(items) || items.length === 0) throw new Error('O pedido precisa de pelo menos um item');
  return request('/links', {
    handle: handle.replace(/^\$/, ''),
    order_nsu: orderNsu,
    redirect_url: redirectUrl || undefined,
    webhook_url: webhookUrl || undefined,
    items: items.map(item => ({
      quantity: Number(item.quantity),
      price: Math.round(Number(item.price)),
      description: String(item.description),
    })),
    customer: customer || undefined,
    address: address || undefined,
  });
}

export async function consultarPagamento({ handle, orderNsu, transactionNsu, slug }) {
  if (!handle || !orderNsu || !transactionNsu || !slug) {
    return { success: true, paid: false, status: 'PENDING' };
  }
  const result = await request('/payment_check', {
    handle: handle.replace(/^\$/, ''),
    order_nsu: orderNsu,
    transaction_nsu: transactionNsu,
    slug,
  });
  return { ...result, status: result.paid ? 'CONFIRMED' : 'PENDING' };
}

export function validarWebhook(payload, expectedOrderNsu, expectedCents) {
  if (!payload || payload.order_nsu !== expectedOrderNsu) return false;
  if (Number(payload.amount) !== Number(expectedCents)) return false;
  return Boolean(payload.transaction_nsu && (payload.invoice_slug || payload.slug));
}
