import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, MailX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'submitting' | 'success' | 'error';

export default function Unsubscribe() {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('Missing unsubscribe token.');
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const json = await res.json();
        if (!res.ok) {
          setStatus('invalid');
          setError(json.error || 'Invalid or expired token.');
          return;
        }
        if (json.valid === false && json.reason === 'already_unsubscribed') {
          setStatus('already');
          return;
        }
        setStatus('valid');
      } catch (e) {
        setStatus('invalid');
        setError(e instanceof Error ? e.message : 'Could not validate token.');
      }
    };
    validate();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus('submitting');
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        'handle-email-unsubscribe',
        { body: { token } }
      );
      if (invokeErr) {
        setStatus('error');
        setError(invokeErr.message);
        return;
      }
      if (data?.success === false && data?.reason === 'already_unsubscribed') {
        setStatus('already');
        return;
      }
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Unsubscribe failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center glow-primary"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-lg font-semibold mb-1">Verifying request…</h1>
          </>
        )}
        {status === 'valid' && (
          <>
            <MailX className="w-10 h-10 text-primary mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-2">Unsubscribe from emails</h1>
            <p className="text-xs text-muted-foreground mb-6">
              Click below to stop receiving emails from OpenOntos at this address.
            </p>
            <button
              onClick={confirm}
              className="px-4 py-2 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Confirm unsubscribe
            </button>
          </>
        )}
        {status === 'submitting' && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-lg font-semibold mb-1">Processing…</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-1">You're unsubscribed</h1>
            <p className="text-xs text-muted-foreground">
              You will no longer receive emails at this address.
            </p>
          </>
        )}
        {status === 'already' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-1">Already unsubscribed</h1>
            <p className="text-xs text-muted-foreground">
              This address is already opted out.
            </p>
          </>
        )}
        {(status === 'invalid' || status === 'error') && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-1">Something went wrong</h1>
            <p className="text-xs text-muted-foreground">{error}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
