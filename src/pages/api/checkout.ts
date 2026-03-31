import type { APIRoute } from 'astro';
import { Client, Environment } from 'square';
import { validateCheckout, buildSquareLineItems } from '../../lib/checkout';
import { randomUUID } from 'crypto';

export const prerender = false;

const client = new Client({
  accessToken: import.meta.env.SQUARE_ACCESS_TOKEN,
  environment: import.meta.env.SQUARE_ENVIRONMENT === 'production'
    ? Environment.Production
    : Environment.Sandbox,
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const validation = validateCheckout(body);

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lineItems = buildSquareLineItems(body.items);
    const idempotencyKey = randomUUID();
    const locationId = import.meta.env.SQUARE_LOCATION_ID;

    const orderResponse = await client.ordersApi.createOrder({
      order: {
        locationId,
        lineItems,
        fulfillments: [{
          type: 'PICKUP',
          state: 'PROPOSED',
          pickupDetails: {
            recipient: {
              displayName: body.customer.name,
              emailAddress: body.customer.email,
              phoneNumber: body.customer.phone || undefined,
            },
          },
        }],
      },
      idempotencyKey,
    });

    const orderId = orderResponse.result.order?.id;
    const totalMoney = orderResponse.result.order?.totalMoney;

    const paymentResponse = await client.paymentsApi.createPayment({
      sourceId: body.token,
      idempotencyKey: randomUUID(),
      amountMoney: totalMoney!,
      orderId,
    });

    return new Response(JSON.stringify({
      success: true,
      orderId,
      total: totalMoney,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const message = err?.errors?.[0]?.detail || err?.message || 'Payment failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
