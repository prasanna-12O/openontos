import { useState } from 'react';
import { Database, Rocket, ChevronDown, FolderKanban, Check, Trash2, LogOut, LogIn, User as UserIcon, HelpCircle, Bug, MessageSquareHeart } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import FeedbackDialog, { GITHUB_ISSUES_URL } from '@/components/FeedbackDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function AppTopNav() {
  const { activeProjectId, setActiveProject, projects } = useAppStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const { isAuthenticated, profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackVariant, setFeedbackVariant] = useState<'soft' | 'manual'>('manual');

  // Global hook so other modules (e.g. Deploy) can request the soft feedback prompt.
  if (typeof window !== 'undefined') {
    (window as unknown as { __openFeedback?: (v: 'soft' | 'manual') => void }).__openFeedback = (v) => {
      setFeedbackVariant(v);
      setFeedbackOpen(true);
    };
  }

  const openManualFeedback = () => {
    setFeedbackVariant('manual');
    setFeedbackOpen(true);
  };

  const handleClearData = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="bg-sidebar border-b border-sidebar-border shrink-0">
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Database className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div className="min-w-0 hidden sm:block">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight leading-tight">OpenOntos</h1>
            <p className="text-[9px] text-muted-foreground font-mono tracking-wider uppercase leading-tight">Data Engineering AI</p>
          </div>
        </div>

        {/* Inline Project Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors border-l border-sidebar-border pl-3 shrink-0 max-w-[200px]"
              title="Switch project"
            >
              <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate font-medium">
                {activeProject ? activeProject.name : 'All Projects'}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Projects
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setActiveProject(null)}
              className="text-xs cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5 mr-2 opacity-60" />
              <span className="flex-1">All Projects</span>
              {!activeProjectId && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
            {projects.length > 0 && <DropdownMenuSeparator />}
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className="text-xs cursor-pointer"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  {p.industryType && (
                    <div className="text-[10px] text-muted-foreground truncate">{p.industryType}</div>
                  )}
                </div>
                {p.id === activeProjectId && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Right cluster: Help / Reset / Auth / Status */}
        <div className="ml-auto flex items-center gap-2 shrink-0 border-l border-sidebar-border pl-3">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            title="Open documentation"
          >
            <HelpCircle className="w-3 h-3" />
            DOCS
          </a>
          <a
            href="/tour"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            title="Open product tour"
          >
            <Rocket className="w-3 h-3" />
            TOUR
          </a>
          <button
            onClick={openManualFeedback}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-accent hover:text-accent-foreground hover:bg-accent/10 transition-colors"
            title="Share feedback"
          >
            <MessageSquareHeart className="w-3 h-3" />
            FEEDBACK
          </button>
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Report a bug on GitHub"
          >
            <Bug className="w-3 h-3" />
            REPORT BUG
          </a>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear all data"
              >
                <Trash2 className="w-3 h-3" />
                RESET
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all projects and settings. The app will reload with default demo data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10">
                <UserIcon className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-foreground font-medium max-w-[120px] truncate">
                  {profile?.name || user?.email}
                </span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono text-muted-foreground hover:bg-muted transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-primary hover:bg-primary/10 transition-colors"
              title="Sign in"
            >
              <LogIn className="w-3 h-3" />
              REGISTER
            </button>
          )}

          <div className="flex items-center gap-1.5 pl-2 border-l border-sidebar-border">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[10px] text-muted-foreground font-mono">LOCAL</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">v0.1.0-alpha</span>
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} variant={feedbackVariant} />
    </div>
  );
}
