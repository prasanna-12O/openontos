import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  role: string | null;
  admin_notified: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess?.user) {
        setProfile(null);
      } else {
        // Defer profile fetch + admin notify to avoid deadlocks
        setTimeout(() => {
          fetchProfileAndNotify(sess.user.id);
        }, 0);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchProfileAndNotify(sess.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndNotify = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to fetch profile', error);
      return;
    }
    setProfile(data as UserProfile | null);

    // Fire admin notification once (server-side idempotent)
    if (data && !data.admin_notified) {
      try {
        await supabase.functions.invoke('notify-admin-registration');
        // Re-fetch updated flag
        const { data: refreshed } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (refreshed) setProfile(refreshed as UserProfile);
      } catch (e) {
        console.error('Admin notify failed', e);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, profile, loading, signOut, isAuthenticated: !!user };
}
