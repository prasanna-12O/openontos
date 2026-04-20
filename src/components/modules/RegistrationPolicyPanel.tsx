import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Mail, Database, Shield, Bell, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function RegistrationPolicyPanel() {
  const { isAuthenticated, profile, user } = useAuth();

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">User Registration & Data Policy</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              How registration works and what we collect
            </CardDescription>
          </div>
          {isAuthenticated ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> Registered
            </Badge>
          ) : (
            <Badge variant="outline">Not registered</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        {isAuthenticated && profile && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-success flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Your registered information
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Name:</span> {profile.name || '—'}</div>
              <div><span className="text-muted-foreground">Email:</span> {profile.email || user?.email}</div>
              <div><span className="text-muted-foreground">Organization:</span> {profile.organization || '—'}</div>
              <div><span className="text-muted-foreground">Role:</span> {profile.role || '—'}</div>
            </div>
          </div>
        )}

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> When is registration required?
          </h4>
          <ul className="space-y-1.5 text-xs text-foreground pl-4 list-disc">
            <li><strong>First 2 projects:</strong> No registration needed — try the app freely.</li>
            <li><strong>After 1st project:</strong> A dismissible prompt invites you to register.</li>
            <li><strong>3rd project onward:</strong> Registration becomes mandatory to continue.</li>
            <li>The built-in <em>demo</em> project does not count toward this limit.</li>
          </ul>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> What we collect
          </h4>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Field</th>
                  <th className="text-left px-3 py-1.5 font-medium">Required</th>
                  <th className="text-left px-3 py-1.5 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-3 py-1.5">Full name</td><td className="px-3 py-1.5">Yes</td><td className="px-3 py-1.5 text-muted-foreground">Personalize your workspace</td></tr>
                <tr><td className="px-3 py-1.5">Email</td><td className="px-3 py-1.5">Yes</td><td className="px-3 py-1.5 text-muted-foreground">Magic-link verification & sign-in</td></tr>
                <tr><td className="px-3 py-1.5">Organization</td><td className="px-3 py-1.5">Optional</td><td className="px-3 py-1.5 text-muted-foreground">Aggregate usage stats only</td></tr>
                <tr><td className="px-3 py-1.5">Role</td><td className="px-3 py-1.5">Optional</td><td className="px-3 py-1.5 text-muted-foreground">Tailor AI agent suggestions to your role</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Verification flow
          </h4>
          <ol className="space-y-1.5 text-xs text-foreground pl-5 list-decimal">
            <li>You submit the registration form.</li>
            <li>We email you a one-time <strong>magic link</strong> — no password needed.</li>
            <li>Clicking the link verifies your email and signs you in.</li>
            <li>Your profile is created automatically using the details you provided.</li>
          </ol>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Admin notifications
          </h4>
          <p className="text-xs text-foreground leading-relaxed">
            Upon successful email verification, a one-time notification is sent to{' '}
            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">contactlucid@luciddatahub.com</code>{' '}
            containing your <strong>name, email, organization, role, and registration timestamp</strong>.
            This is used solely to track active users and improve the product. No project data, schemas,
            or credentials are ever sent.
          </p>
        </section>

        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Data storage & security
          </h4>
          <ul className="space-y-1.5 text-xs text-foreground pl-4 list-disc">
            <li>
              <strong>Only your User Registration Data</strong> — specifically your{' '}
              <em>full name, email address, organization (if provided), role (if provided), registration timestamp,
              and an internal admin-notification flag</em> — is stored in <strong>Lovable Cloud</strong>{' '}
              (managed PostgreSQL with Row-Level Security).
            </li>
            <li>
              <strong>Nothing else</strong> is sent to Lovable Cloud. Specifically, the following are{' '}
              <strong>never uploaded</strong> and remain entirely in your browser's local storage:
              <ul className="mt-1 ml-4 list-[circle] space-y-0.5">
                <li>Project definitions, names, and metadata</li>
                <li>Data source connection details and credentials (hosts, usernames, passwords, API keys)</li>
                <li>Ontology classes, properties, and relationships</li>
                <li>Source-to-target mappings and transformation rules</li>
                <li>Generated ETL code, SQL, and pipeline configurations</li>
                <li>Sample data, profiling results, and monitoring metrics</li>
                <li>AI agent chat history and prompts</li>
              </ul>
            </li>
            <li>
              You can <strong>only read and update your own profile row</strong> — Row-Level Security policies
              enforce this at the database level, so no other user (or anonymous visitor) can access your registration data.
            </li>
            <li>
              The one-time admin notification email contains the same registration fields listed above —{' '}
              <strong>no project data is ever included</strong>.
            </li>
            <li>You can sign out at any time from the top bar; signing out does not delete your profile row.</li>
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
