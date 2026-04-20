import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Database, Sparkles, Download } from 'lucide-react';
import s01 from '@/assets/tour/01-projects.png';
import s02 from '@/assets/tour/02-datasources.png';
import s03 from '@/assets/tour/03-profile.png';
import s04 from '@/assets/tour/04-ontology.png';
import s05 from '@/assets/tour/05-mapping.png';
import s06 from '@/assets/tour/06-etl.png';
import s07 from '@/assets/tour/07-pipelines.png';
import s08 from '@/assets/tour/08-deploy.png';
import s09 from '@/assets/tour/09-monitor.png';
import s10 from '@/assets/tour/10-agent.png';

type Step = {
  n: string;
  img: string;
  title: string;
  subtitle: string;
  body: React.ReactNode;
  agent: string;
};

const steps: Step[] = [
  {
    n: '01', img: s01,
    title: 'Start: Project Workspace',
    subtitle: 'Pick a demo or create a new project',
    body: (<>OpenOntos opens to your project workspace. The bundled <b>E-Commerce Data Warehouse</b> demo ships with 5 raw tables, a target ontology, and 10 mappings — perfect for a guided walkthrough. Click <b>+ New Project</b> to start from scratch.</>),
    agent: '“Create a new project for retail sales analytics”',
  },
  {
    n: '02', img: s02,
    title: 'Connect Data Sources',
    subtitle: '15+ supported source types — databases, warehouses, files, APIs',
    body: (<>Connect PostgreSQL, MySQL, Snowflake, BigQuery, Databricks, Fabric, S3, REST APIs, and more. Each source is tested live and its tables are auto-discovered. Here the demo has a <b>PostgreSQL</b> database (4 tables) and a <b>REST API</b> (1 table) connected.</>),
    agent: '“Add a Snowflake source called Analytics with sample credentials”',
  },
  {
    n: '03', img: s03,
    title: 'Profile Source Data',
    subtitle: 'AI-powered schema, quality, and relationship analysis',
    body: (<>The Profile module ingests raw tables and runs <b>AI Analyze Schema</b> to detect column types, primary/foreign key candidates, anomalies, and join relationships. Anomalies (nulls, duplicates, outliers) are flagged inline.</>),
    agent: '“Profile all connected tables and explain any data quality issues”',
  },
  {
    n: '04', img: s04,
    title: 'Generate the Ontology',
    subtitle: 'Conceptual entities and relationships from your raw schema',
    body: (<>The AI proposes a clean business ontology — <b>Customer → Order → Order Line Item ← Product ← Supplier</b> — with relationship types and confidence scores per entity and edge. Edit, accept, or regenerate from the canvas.</>),
    agent: '“Suggest an ontology for an e-commerce order system”',
  },
  {
    n: '05', img: s05,
    title: 'Map Source → Target Attributes',
    subtitle: 'AI-suggested column mappings with transformation expressions',
    body: (<>Each ontology attribute is mapped from a source column with a generated transformation: <code>CAST</code>, <code>TRIM</code>, <code>LOWER</code>, <code>COALESCE</code>. Confidence scores indicate how certain the AI is. Approve in bulk or refine per row.</>),
    agent: '“Suggest mappings for the Customer entity”',
  },
  {
    n: '06', img: s06,
    title: 'Generate ETL Code',
    subtitle: 'Bronze → Silver → Gold layered SQL for any target platform',
    body: (<>OpenOntos generates production-ready SQL for <b>Snowflake, BigQuery, Redshift, Databricks, and Fabric</b> across Bronze (raw), Silver (cleaned), and Gold (aggregated) layers. Edit inline, copy, export, or execute directly on the warehouse.</>),
    agent: '“Generate Snowflake ETL for all three layers”',
  },
  {
    n: '07', img: s07,
    title: 'Run & Schedule Pipelines',
    subtitle: 'Execute Bronze/Silver/Gold layers on demand or on schedule',
    body: (<>Trigger individual layers from <b>Quick Run</b>, run the full pipeline end-to-end, or schedule recurring jobs (cron-style). Run history shows duration and row counts per execution.</>),
    agent: '“Schedule a nightly full refresh at 2 AM”',
  },
  {
    n: '08', img: s08,
    title: 'Deploy to Target Platform',
    subtitle: 'Configure connections and ship to production',
    body: (<>Pick your warehouse — <b>Snowflake, Databricks, Microsoft Fabric, BigQuery, or Redshift</b> — and configure secure credentials. The <b>Readiness checklist</b> verifies every step before deployment.</>),
    agent: '“Check deployment readiness and tell me what’s blocking”',
  },
  {
    n: '09', img: s09,
    title: 'Monitor Pipeline Health',
    subtitle: 'Runs, validations, and AI health analysis',
    body: (<>The Monitor view aggregates pipeline runs, errors, open validation issues, and active jobs. Click any run to drill into logs and row counts. <b>AI Health Analysis</b> summarizes failures and recommends fixes.</>),
    agent: '“Why did the Gold Aggregation run fail and how do I fix it?”',
  },
  {
    n: '10', img: s10,
    title: 'AI Agent — Everywhere',
    subtitle: 'Context-aware copilot in every module',
    body: (<>The <b>AI Agent panel</b> opens beside any module and adapts to its context — Profile, Ontology, Mapping, Monitor agents and more. Each agent has full read/write access to your project state.</>),
    agent: '“Show monitoring issues” · “Run validation checks” · “Summarize pipeline health”',
  },
];

export default function Tour() {
  useEffect(() => {
    document.title = 'Product Tour — OpenOntos';
    const meta = document.querySelector('meta[name="description"]');
    const desc = 'Guided 10-step walkthrough of OpenOntos: from new project creation to deployment, end-to-end with AI agents.';
    if (meta) meta.setAttribute('content', desc);
    else {
      const m = document.createElement('meta');
      m.name = 'description'; m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to app
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-7 h-7 rounded-md gradient-primary flex items-center justify-center">
              <Database className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">OpenOntos</span>
            <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Product Tour</span>
          </div>
          <a
            href="/openontos-product-tour.pdf"
            download="openontos-product-tour.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-wider mb-5">
            <Sparkles className="w-3 h-3" /> 10-step walkthrough
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            From raw tables to <span className="text-primary">deployed warehouse</span> — in one workspace.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            See exactly how OpenOntos takes you end-to-end: connect sources, profile data, generate an ontology,
            map and transform, ship ETL, and monitor — with an AI agent at every step.
          </p>
        </motion.div>
      </section>

      {/* Steps */}
      <main className="max-w-6xl mx-auto px-6 pb-24 space-y-20">
        {steps.map((step, i) => (
          <motion.section
            key={step.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="grid md:grid-cols-12 gap-8 items-start"
          >
            <div className="md:col-span-4 md:sticky md:top-24 self-start">
              <div className="text-7xl font-bold text-primary/90 leading-none font-mono">{step.n}</div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">{step.title}</h2>
              <p className="mt-1.5 text-sm italic text-muted-foreground">{step.subtitle}</p>
              <p className="mt-4 text-sm text-foreground/85 leading-relaxed">{step.body}</p>
              <div className="mt-5 rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-accent mb-1">Agent prompt</div>
                <div className="text-xs text-foreground/80 italic leading-relaxed">{step.agent}</div>
              </div>
            </div>
            <div className="md:col-span-8">
              <div className="rounded-lg overflow-hidden border border-border bg-card shadow-2xl">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                  <span className="ml-3 text-[10px] font-mono text-muted-foreground">openontos.ai — {step.title}</span>
                </div>
                <img
                  src={step.img}
                  alt={`OpenOntos ${step.title} screenshot`}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </motion.section>
        ))}

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center pt-12 border-t border-border"
        >
          <h3 className="text-3xl font-bold tracking-tight">Ready to try it on your data?</h3>
          <p className="mt-3 text-muted-foreground">Open the workspace and load the demo project — no setup needed.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Launch workspace
            </Link>
            <Link to="/docs" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors">
              Read the docs
            </Link>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
