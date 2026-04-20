import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'contactlucid@luciddatahub.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('getUser failed', userErr);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    // Service role client to read profile + update admin_notified flag
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile.admin_notified) {
      return new Response(JSON.stringify({ ok: true, alreadyNotified: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const registeredAt = new Date().toISOString();

    // Send via the transactional email pipeline (queued + retried automatically)
    const { error: sendErr } = await adminClient.functions.invoke(
      'send-transactional-email',
      {
        body: {
          templateName: 'admin-new-registration',
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `admin-new-registration-${userId}`,
          templateData: {
            name: profile.name,
            email: profile.email,
            organization: profile.organization || '(not provided)',
            role: profile.role || '(not provided)',
            registeredAt,
          },
        },
      }
    );

    if (sendErr) {
      console.error('Failed to enqueue admin notification email', sendErr);
      return new Response(
        JSON.stringify({ error: 'Failed to send admin notification' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark notified to ensure idempotency
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ admin_notified: true })
      .eq('id', userId);

    if (updateErr) {
      console.error('Failed to mark admin_notified', updateErr);
    }

    console.log('[ADMIN NOTIFY] Enqueued admin email for user', userId);

    return new Response(JSON.stringify({ ok: true, notified: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('notify-admin-registration error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
