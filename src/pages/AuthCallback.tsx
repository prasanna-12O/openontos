import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Supabase processes the magic link automatically via detectSessionInUrl.
    const check = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus('error');
        setErrorMsg(error.message);
        return;
      }
      if (data.session) {
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
      } else {
        // Wait a moment for URL processing
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession();
          if (retry.session) {
            setStatus('success');
            setTimeout(() => navigate('/'), 1500);
          } else {
            setStatus('error');
            setErrorMsg('Verification link is invalid or has expired.');
          }
        }, 1500);
      }
    };
    check();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center glow-primary"
      >
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-lg font-semibold mb-1">Verifying your email...</h1>
            <p className="text-xs text-muted-foreground">Just a moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-1">You're verified!</h1>
            <p className="text-xs text-muted-foreground">Redirecting to your projects...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-1">Verification failed</h1>
            <p className="text-xs text-muted-foreground mb-4">{errorMsg}</p>
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
