// Edge Function: notify-payment
// Triggered via Supabase Database Webhook on payments INSERT/UPDATE
// When payment.status = 'success', sends Expo push notifications to all
// staff in the shop who have a push_token registered.
//
// Supabase Dashboard setup:
//   Database → Webhooks → New webhook
//   Table: payments | Events: UPDATE
//   URL: <project_url>/functions/v1/notify-payment

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  try {
    // Verify this request came from Supabase webhook (not arbitrary caller)
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    if (!webhookSecret) {
      return new Response('misconfigured', { status: 500 })
    }
    const signature = req.headers.get('x-supabase-signature') ?? ''
    // Use constant-time comparison to prevent timing-based attacks
    const enc = new TextEncoder()
    const sigBytes = enc.encode(signature)
    const secretBytes = enc.encode(webhookSecret)
    const sigValid =
      sigBytes.length === secretBytes.length &&
      crypto.subtle.timingSafeEqual(sigBytes, secretBytes)
    if (!sigValid) {
      return new Response('unauthorized', { status: 401 })
    }

    const payload = await req.json()
    const payment = payload.record

    // Only act when payment is confirmed as successful via auto detection
    if (payment.status !== 'success' || payment.confirmation_type !== 'auto') {
      return new Response('skipped', { status: 200 })
    }

    // Get order to find shop_id and order_number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('shop_id, order_number')
      .eq('id', payment.order_id)
      .single()

    if (orderError || !order) {
      return new Response('order not found', { status: 200 })
    }

    // Get all push tokens for staff in this shop
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('shop_id', order.shop_id)
      .not('push_token', 'is', null)

    if (profilesError || !profiles || profiles.length === 0) {
      return new Response('no tokens', { status: 200 })
    }

    const tokens = profiles.map((p: { push_token: string }) => p.push_token).filter(Boolean)

    if (tokens.length === 0) {
      return new Response('no tokens', { status: 200 })
    }

    // Build Expo push notification messages
    const messages = tokens.map((token: string) => ({
      to: token,
      title: 'ชำระเงินสำเร็จ ✅',
      body: `฿${Number(payment.amount).toFixed(2)} - ออเดอร์ #${order.order_number}`,
      data: { orderId: payment.order_id },
    }))

    // Send to Expo Push API
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    })

    if (!expoRes.ok) {
      console.error('Expo push failed:', await expoRes.text())
      return new Response('push failed', { status: 500 })
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('notify-payment error:', err)
    return new Response('error', { status: 500 })
  }
})
