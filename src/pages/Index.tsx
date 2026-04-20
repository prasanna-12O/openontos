import { lazy, Suspense, useEffect } from 'react';
import AppTopNav from '@/components/layout/AppTopNav';
import TopBar from '@/components/layout/TopBar';
import AgentPanel from '@/components/layout/AgentPanel';
import ProjectSelector from '@/components/modules/ProjectSelector';
import { useAppStore } from '@/store/useAppStore';
import { AnimatePresence, motion } from 'framer-motion';

// Lazy-load heavy module screens to shrink initial bundle (improves LCP/FCP).
// Only the active module is rendered, so eagerly importing all of them wastes
// ~225 KB of JS on first paint per Lighthouse.
const DataSourcesModule = lazy(() => import('@/components/modules/DataSourcesModule'));
const ProfileModule = lazy(() => import('@/components/modules/ProfileModule'));
const OntologyModule = lazy(() => import('@/components/modules/OntologyModule'));
const MappingModule = lazy(() => import('@/components/modules/MappingModule'));
const ETLModule = lazy(() => import('@/components/modules/ETLModule'));
const PipelinesModule = lazy(() => import('@/components/modules/PipelinesModule'));
const DeployModule = lazy(() => import('@/components/modules/DeployModule'));
const MonitorModule = lazy(() => import('@/components/modules/MonitorModule'));
const SettingsModule = lazy(() => import('@/components/modules/SettingsModule'));

const moduleComponents = {
  datasources: DataSourcesModule,
  profile: ProfileModule,
  ontology: OntologyModule,
  mapping: MappingModule,
  etl: ETLModule,
  pipelines: PipelinesModule,
  deploy: DeployModule,
  monitor: MonitorModule,
  settings: SettingsModule,
};

function ModuleFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

const FEEDBACK_PROMPT_KEY = 'openontos-feedback-prompted';

export default function Index() {
  const { activeModule, activeProjectId } = useAppStore();
  const ModuleComponent = moduleComponents[activeModule];

  // Soft feedback prompt: fires once, the first time the user opens the Deploy module.
  useEffect(() => {
    if (activeModule !== 'deploy' || !activeProjectId) return;
    if (localStorage.getItem(FEEDBACK_PROMPT_KEY) === '1') return;
    const timer = setTimeout(() => {
      const w = window as unknown as { __openFeedback?: (v: 'soft' | 'manual') => void };
      w.__openFeedback?.('soft');
      localStorage.setItem(FEEDBACK_PROMPT_KEY, '1');
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeModule, activeProjectId]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <AppTopNav />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {!activeProjectId ? (
                <motion.div
                  key="projects"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <ProjectSelector />
                </motion.div>
              ) : (
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <Suspense fallback={<ModuleFallback />}>
                    <ModuleComponent />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <AgentPanel />
      </div>
    </div>
  );
}
