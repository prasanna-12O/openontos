import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Clock, Database, Share2, ArrowRightLeft, Sparkles, ChevronRight, Building2, BookOpen } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import RegistrationGate from '@/components/RegistrationGate';
import Testimonials from '@/components/Testimonials';

const SOFT_DISMISS_KEY = 'openontos-soft-prompt-dismissed';
const HARD_GATE_THRESHOLD = 3; // user-created projects (excluding demo) before block

const COMMON_SUBJECTS = ['Customer Analytics', 'Marketing & Campaigns', 'HR & Workforce', 'Other'];

const INDUSTRY_SUBJECT_MAP: Record<string, string[]> = {
  'Retail & E-Commerce': ['Customer Analytics', 'Order Management', 'Inventory Management', 'Product Catalog', 'Pricing & Promotions', 'Marketing & Campaigns', 'Returns & Fulfillment', 'Other'],
  'Financial Services & Banking': ['Financial Reporting', 'Risk & Compliance', 'Fraud Detection', 'Customer Analytics', 'Loan & Credit Analytics', 'Transactions & Payments', 'Anti-Money Laundering', 'Other'],
  'Healthcare & Life Sciences': ['Patient Records', 'Clinical Encounters', 'Medications & Pharmacy', 'Claims Processing', 'Population Health', 'Clinical Trials', 'Medical Imaging', 'Other'],
  'Manufacturing & Supply Chain': ['Inventory Management', 'Supply Chain Optimization', 'IoT & Sensor Data', 'Work Orders & Production', 'Quality & Defects', 'Procurement', 'Logistics', 'Other'],
  'Telecommunications': ['Customer Analytics', 'Network Performance', 'Billing & Revenue', 'Churn Analysis', 'Service Tickets', 'IoT & Sensor Data', 'Other'],
  'Energy & Utilities': ['IoT & Sensor Data', 'Smart Metering', 'Grid Operations', 'Outage Management', 'Asset Maintenance', 'Energy Trading', 'Sustainability & Emissions', 'Other'],
  'Insurance': ['Claims Processing', 'Underwriting & Policies', 'Risk & Compliance', 'Fraud Detection', 'Customer Analytics', 'Actuarial Analytics', 'Other'],
  'Government & Public Sector': ['Citizen Services', 'Tax & Revenue', 'Public Safety', 'Permits & Licensing', 'Open Data & Transparency', 'HR & Workforce', 'Other'],
  'Media & Entertainment': ['Content Catalog', 'Audience Analytics', 'Subscriptions & Billing', 'Ad Performance', 'Recommendations', 'Marketing & Campaigns', 'Other'],
  'Transportation & Logistics': ['Fleet & Vehicles', 'Route Optimization', 'Shipments & Tracking', 'Warehouse Operations', 'IoT & Sensor Data', 'Driver & Workforce', 'Other'],
  'Real Estate': ['Property Listings', 'Tenant & Lease Management', 'Valuations & Appraisals', 'Maintenance & Facilities', 'Customer Analytics', 'Other'],
  'Education': ['Student Records', 'Enrollment & Admissions', 'Course & Curriculum', 'Learning Analytics', 'HR & Workforce', 'Finance & Aid', 'Other'],
  'Other': COMMON_SUBJECTS,
};

const INDUSTRY_OPTIONS = Object.keys(INDUSTRY_SUBJECT_MAP);

export default function ProjectSelector() {
  const { projects, setActiveProject, createProject } = useAppStore();
  const { isAuthenticated } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showHardGate, setShowHardGate] = useState(false);
  const [softDismissed, setSoftDismissed] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [industrySelect, setIndustrySelect] = useState('');
  const [industryCustom, setIndustryCustom] = useState('');
  const [subjectSelect, setSubjectSelect] = useState('');
  const [subjectCustom, setSubjectCustom] = useState('');

  useEffect(() => {
    setSoftDismissed(localStorage.getItem(SOFT_DISMISS_KEY) === '1');
  }, []);

  const userProjectsCount = projects.filter(p => p.id !== 'demo-ecommerce').length;
  const showSoftPrompt = !isAuthenticated && !softDismissed && userProjectsCount >= 1 && userProjectsCount < HARD_GATE_THRESHOLD - 1;

  const resolvedIndustry = industrySelect === 'Other' ? industryCustom : industrySelect;
  const resolvedSubject = subjectSelect === 'Other' ? subjectCustom : subjectSelect;

  const handleNewProjectClick = () => {
    if (!isAuthenticated && userProjectsCount >= HARD_GATE_THRESHOLD - 1) {
      setShowHardGate(true);
      return;
    }
    setShowCreate(true);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createProject(name.trim(), desc.trim(), resolvedIndustry.trim(), resolvedSubject.trim());
    setShowCreate(false);
    setName('');
    setDesc('');
    setIndustrySelect('');
    setIndustryCustom('');
    setSubjectSelect('');
    setSubjectCustom('');
  };

  const dismissSoft = () => {
    localStorage.setItem(SOFT_DISMISS_KEY, '1');
    setSoftDismissed(true);
  };

  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 py-8 lg:py-10"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center glow-primary shrink-0"
            >
              <Database className="w-7 h-7 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">All Projects</h1>
              <p className="text-muted-foreground text-xs lg:text-sm mt-1">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'} · Profile schemas, build ontologies, generate pipelines
              </p>
            </div>
          </div>
          <button
            onClick={handleNewProjectClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity glow-primary self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {/* Soft registration prompt */}
        <AnimatePresence>
          {showSoftPrompt && (
            <RegistrationGate variant="soft" onDismiss={dismissSoft} />
          )}
        </AnimatePresence>

        {/* Project Grid - responsive across all breakpoints */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 mb-8">
          {/* New Project Card */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNewProjectClick}
            className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-all group min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors group-hover:glow-primary">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <span className="text-sm font-medium">New Project</span>
            <span className="text-[10px] text-muted-foreground">Start from scratch</span>
          </motion.button>

          {/* Existing Projects */}
          {projects.map((project, i) => (
            <motion.button
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveProject(project.id)}
              className="bg-card border border-border rounded-xl p-5 text-left hover:border-primary/40 transition-all group glow-primary min-h-[180px] flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <FolderOpen className="w-5 h-5 text-accent" />
                </div>
                {project.id === 'demo-ecommerce' && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full gradient-primary text-primary-foreground font-mono font-bold tracking-wider">DEMO</span>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1">{project.name}</h3>
              <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2 flex-1">{project.description}</p>
              {(project.industryType || project.subjectArea) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {project.industryType && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5" />{project.industryType}
                    </span>
                  )}
                  {project.subjectArea && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent flex items-center gap-1">
                      <BookOpen className="w-2.5 h-2.5" />{project.subjectArea}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {project.tables.length} tables</span>
                <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {project.entities.length} entities</span>
                <span className="flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> {project.mappings.length} maps</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(project.updatedAt).toLocaleDateString()}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Testimonials */}
        <Testimonials />

        {/* Create Modal */}
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-6 max-w-md mx-auto glow-primary"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              New Project
            </h2>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Industry Type
                  </label>
                  <select
                    value={industrySelect}
                    onChange={(e) => { setIndustrySelect(e.target.value); setSubjectSelect(''); setSubjectCustom(''); }}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRY_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {industrySelect === 'Other' && (
                    <input
                      value={industryCustom}
                      onChange={(e) => setIndustryCustom(e.target.value)}
                      placeholder="Enter your industry..."
                      className="w-full mt-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Subject Area
                  </label>
                  <select
                    value={subjectSelect}
                    onChange={(e) => setSubjectSelect(e.target.value)}
                    disabled={!industrySelect || industrySelect === 'Other' && !industryCustom}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {industrySelect ? 'Select subject area...' : 'Pick industry first...'}
                    </option>
                    {(INDUSTRY_SUBJECT_MAP[industrySelect] ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {subjectSelect === 'Other' && (
                    <input
                      value={subjectCustom}
                      onChange={(e) => setSubjectCustom(e.target.value)}
                      placeholder="Enter your subject area..."
                      className="w-full mt-2 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Industry & subject area help the AI agent provide domain-specific suggestions throughout the project.
              </p>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-5 py-2 gradient-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity glow-primary">
                  Create Project
                </button>
                <button onClick={() => setShowCreate(false)} className="px-5 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Hard registration gate */}
      {showHardGate && (
        <RegistrationGate variant="hard" onCancel={() => setShowHardGate(false)} />
      )}
    </div>
  );
}
