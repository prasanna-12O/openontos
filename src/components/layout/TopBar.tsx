import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { Building2, BookOpen, Bot, Sparkles, Search, Share2, ArrowRightLeft, Code2, Rocket, Activity, PlugZap, Settings, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ModuleId } from '@/types/project';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const navItems: { id: ModuleId; label: string; icon: React.ElementType }[] = [
  { id: 'datasources', label: 'Data Sources', icon: PlugZap },
  { id: 'profile', label: 'Profile', icon: Search },
  { id: 'ontology', label: 'Ontology', icon: Share2 },
  { id: 'mapping', label: 'Mapping', icon: ArrowRightLeft },
  { id: 'etl', label: 'ETL Code', icon: Code2 },
  { id: 'pipelines', label: 'Pipelines', icon: Workflow },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function TopBar() {
  const { getActiveProject, activeModule, setActiveModule, activeProjectId, toggleAgentPanel, agentPanelOpen } = useAppStore();
  const project = getActiveProject();
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  return (
    <header className="bg-card/50 border-b border-border shrink-0 glass">
      {/* Row 1: breadcrumb + badges + AI Agent */}
      <div className="h-11 flex items-center px-4 gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {project ? (
            <>
              <span className="text-muted-foreground truncate">{project.name}</span>
            </>
          ) : (
            <span className="text-foreground font-medium">Projects</span>
          )}
        </div>

        {project && (project.industryType || project.subjectArea) && (
          <div className="flex items-center gap-2 shrink-0">
            {project.industryType && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                <Building2 className="w-3 h-3" />
                {project.industryType}
              </span>
            )}
            {project.subjectArea && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                <BookOpen className="w-3 h-3" />
                {project.subjectArea}
              </span>
            )}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={toggleAgentPanel}
          className={cn(
            'ml-auto relative flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all shrink-0 overflow-hidden group',
            agentPanelOpen
              ? 'bg-agent text-agent-foreground shadow-lg shadow-agent/30'
              : 'bg-gradient-to-r from-agent/90 to-primary/90 text-white shadow-md hover:shadow-lg hover:shadow-agent/40'
          )}
          style={{
            boxShadow: agentPanelOpen ? undefined : '0 0 20px hsl(var(--agent) / 0.35)',
          }}
        >
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <Bot className="w-4 h-4 relative z-10" />
          <span className="relative z-10">AI Agent</span>
          <Sparkles className="w-3 h-3 relative z-10 opacity-80" />
          <span
            className={cn(
              'relative z-10 w-2 h-2 rounded-full ml-0.5',
              agentPanelOpen ? 'bg-white animate-pulse-glow' : 'bg-white/70'
            )}
          />
        </motion.button>
      </div>

      {/* Row 2: Module navigation (only shown when a project is active) */}
      {activeProjectId && (
        <nav className="h-11 flex items-center gap-1 px-3 border-t border-border/60 overflow-x-auto scrollbar-none">
          {navItems.map(({ id, label, icon: Icon }, i) => {
            const isActive = activeModule === id;
            return (
              <motion.button
                key={id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                onClick={() => {
                  if (id === 'monitor') {
                    setComingSoonOpen(true);
                    return;
                  }
                  setActiveModule(id);
                }}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all whitespace-nowrap shrink-0',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="topbar-module-active"
                    className="absolute inset-0 bg-accent/40 rounded-md"
                    style={{ borderBottom: '2px solid hsl(var(--primary))' }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className={cn('w-4 h-4 relative z-10', isActive && 'text-primary')} />
                <span className="relative z-10">{label}</span>
              </motion.button>
            );
          })}
        </nav>
      )}

      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Monitor — Coming soon
            </DialogTitle>
            <DialogDescription className="pt-2">
              This feature is coming soon and is planned for a future release.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setComingSoonOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
