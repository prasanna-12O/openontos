import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Building2, User as UserIcon, Briefcase, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  'Data Engineer',
  'Data Modeler',
  'Data Analyst',
  'Data Architect',
  'Data Scientist',
  'ML Engineer',
  'Analytics Engineer',
  'BI Developer',
  'Other',
];

export default function Auth() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleSelect, setRoleSelect] = useState('');
  const [roleCustom, setRoleCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const resolvedRole = roleSelect === 'Other' ? roleCustom.trim() : roleSelect;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name.trim(),
            organization: organization.trim(),
            role: resolvedRole,
          },
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
        toast.success('Magic link sent! Check your email.');
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to projects
        </button>

        <div className="bg-card border border-border rounded-2xl p-8 glow-primary">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl gradient-primary mx-auto mb-4 flex items-center justify-center glow-primary">
              <Sparkles className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-1">
              {sent ? 'Check your inbox' : 'Register for OpenOntos'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {sent
                ? `We sent a magic link to ${email}. Click it to verify your email.`
                : 'Free unlimited use after a quick registration.'}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <p className="text-xs text-foreground">
                  Open the email and click the link. You'll be signed in automatically.
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Full name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Jane Doe"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="jane@company.com"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Organization (optional)
                </label>
                <input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Role (optional)
                </label>
                <select
                  value={roleSelect}
                  onChange={(e) => setRoleSelect(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select role...</option>
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {roleSelect === 'Other' && (
                  <input
                    value={roleCustom}
                    onChange={(e) => setRoleCustom(e.target.value)}
                    placeholder="Enter your role..."
                    className="w-full mt-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-5 py-2.5 mt-2 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity glow-primary disabled:opacity-50"
              >
                {submitting ? 'Sending magic link...' : 'Send magic link'}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                We'll email a one-time link to verify and sign you in. No password required.
              </p>
            </form>
          )}

          {!sent && (
            <div className="mt-6 pt-5 border-t border-border space-y-3">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                What we collect & why
              </p>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span><strong className="text-foreground">Name & email (required):</strong> for magic-link verification and personalization.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span><strong className="text-foreground">Organization & role (optional):</strong> aggregate stats and tailored AI suggestions.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>A one-time admin notification is sent to <code className="text-[10px] bg-muted px-1 py-0.5 rounded">contactlucid@luciddatahub.com</code> on first verification.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Your <strong className="text-foreground">project data, schemas, and credentials stay local</strong> in your browser — never uploaded.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>Registration is free and required only from your <strong className="text-foreground">3rd project onward</strong>.</span>
                </li>
              </ul>
              <p className="text-[10px] text-muted-foreground/80 italic">
                By registering you agree to receive your magic link by email. See <strong>Settings → User Registration & Data Policy</strong> for full details.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
