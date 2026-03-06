// Edge Function: create-cashier
// Called by shop owner to create a cashier account.
// Uses service role key so the owner doesn't need admin privileges.
//
// Deploy: supabase functions deploy create-cashier

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  // CORS headers (needed for web client)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify caller's JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Use anon key + caller's JWT to verify identity
    const supabaseCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseCaller.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // 2. Verify caller is an owner
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, shop_id')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'owner' || !callerProfile?.shop_id) {
      return new Response(
        JSON.stringify({ error: 'เฉพาะเจ้าของร้านเท่านั้นที่สร้างพนักงานได้' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // 3. Parse request body
    const { full_name, email, password } = await req.json()

    if (!full_name?.trim() || !email?.trim() || !password?.trim()) {
      return new Response(
        JSON.stringify({ error: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบ' }),
        { status: 400, headers: corsHeaders }
      )
    }
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 4. Create Supabase auth user (confirmed immediately, no email needed)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    })

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message ?? 'สร้างบัญชีไม่สำเร็จ' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // 5. Create profile row for the new cashier
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: email.trim().toLowerCase(),
        full_name: full_name.trim(),
        role: 'cashier',
        shop_id: callerProfile.shop_id,
      })

    if (profileInsertError) {
      // Roll back: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(
        JSON.stringify({ error: profileInsertError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: true, email: email.trim().toLowerCase() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
