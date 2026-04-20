// Docs content registry. Each entry is a self-contained page.
// Keep `body` as plain text (markdown-lite) so client-side search works without MDX tooling.
// Headings: lines starting with "## ". Code blocks: lines wrapped in triple backticks.

export type DocPage = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
};

export const DOCS: DocPage[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    category: 'Introduction',
    summary: 'Install OpenOntos, create your first project, and run the demo dataset.',
    body: `## What is OpenOntos?
OpenOntos is a local-first AI data engineering workspace. It helps you connect data sources, profile them, design an ontology, map source fields, generate ETL code, orchestrate pipelines, deploy, and monitor — all from one app.

## 1. Create a project
Click the project switcher in the top bar and choose "New Project". Pick an industry template (E-commerce, Finance, Healthcare, Manufacturing, Retail) to load a curated demo dataset, or start from scratch.

## 2. Connect a data source
Open the Data Sources module. Add a CSV, database, or API connector. Use "Test connection" to verify access. Sample CSVs live in the /samples folder for offline experimentation.

## 3. Profile and explore
Switch to Profile to inspect column types, null counts, distributions, and quality issues detected automatically.

## 4. Build an ontology
In Ontology, drag entities onto the canvas and connect them with relationships. The AI agent (right panel) can suggest entities based on your sources.

## Next steps
- Read "Connecting Data Sources" for connector specifics.
- Read "Building an Ontology" for modeling tips.`,
  },
  {
    slug: 'data-sources',
    title: 'Connecting Data Sources',
    category: 'Guides',
    summary: 'Add CSV, database, and API sources. Test connections and load samples.',
    body: `## Supported sources
- CSV / Parquet files (local)
- PostgreSQL, MySQL, SQL Server, Snowflake
- REST APIs with header / bearer auth
- S3-compatible object storage

## Adding a source
1. Open the Data Sources module.
2. Click "Add Source" and pick a connector type.
3. Fill in connection params. Secrets are stored locally and never leave your machine.
4. Click "Test connection" — you should see a green check.
5. Click "Save" to register the source with your project.

## Loading sample data
Use the "Load sample dataset" button to import one of the bundled demos (e-commerce, finance, healthcare, manufacturing, retail). Great for trying features without real data.`,
  },
  {
    slug: 'ontology',
    title: 'Building an Ontology',
    category: 'Guides',
    summary: 'Model your domain with entities, attributes, and relationships.',
    body: `## Concepts
An ontology defines the *business meaning* of your data: which real-world things exist (entities), how they relate, and what attributes they carry. OpenOntos stores it as a graph you can edit visually.

## Workflow
1. Open the Ontology module.
2. Add entities (e.g. Customer, Order, Product).
3. Add attributes to each entity (id, name, email…).
4. Draw relationships between entities (Customer —places→ Order).
5. Ask the AI agent to "suggest entities from my sources" — it inspects connected sources and proposes a starting graph.

## Tips
- Keep entity names singular (Customer, not Customers).
- Use canonical attribute names — mapping handles source variations.`,
  },
  {
    slug: 'mapping',
    title: 'Mapping Source Fields',
    category: 'Guides',
    summary: 'Map raw source columns to ontology attributes with transformations.',
    body: `## Workflow
1. Open the Mapping module.
2. Pick a source on the left and a target entity on the right.
3. Drag a source column onto an attribute, or click "Auto-map" to let the AI propose mappings.
4. Add transformations (lowercase, trim, parse date, lookup, custom expression).
5. Save the mapping — it becomes the input to ETL code generation.

## Auto-map
The AI agent uses column names, types, and sample values to propose mappings with a confidence score. Always review before saving.`,
  },
  {
    slug: 'etl',
    title: 'ETL Code Generation',
    category: 'Guides',
    summary: 'Generate Python / SQL transformation code from your mappings.',
    body: `## Generating code
1. Open the ETL Code module.
2. Select a mapping.
3. Pick a target dialect (Python pandas, PySpark, SQL).
4. Click "Generate" — the AI produces idiomatic, commented code.
5. Edit inline if needed. Changes are saved to the project.

## Best practices
- Always run "Dry run" against a sample before deploying.
- Commit generated code to version control alongside the ontology.`,
  },
  {
    slug: 'pipelines',
    title: 'Orchestrating Pipelines',
    category: 'Guides',
    summary: 'Chain ETL steps into scheduled pipelines with dependencies.',
    body: `## Pipelines
A pipeline is a DAG of ETL steps with dependencies and a schedule. Open the Pipelines module to compose one.

## Steps
1. Click "New Pipeline".
2. Drag ETL jobs onto the canvas in execution order.
3. Connect them — downstream steps wait for upstream success.
4. Set a schedule (cron) or trigger (manual / on-source-change).
5. Save and enable.`,
  },
  {
    slug: 'deploy',
    title: 'Deploy',
    category: 'Guides',
    summary: 'Push pipelines to your runtime: local, Airflow, Dagster, or cloud.',
    body: `## Targets
- Local runner (default for development)
- Apache Airflow (export DAG)
- Dagster (export job)
- Cloud functions (AWS Lambda, GCP Cloud Run)

## Deploying
1. Open Deploy.
2. Select a pipeline and a target.
3. Configure runtime params (workers, memory, secrets).
4. Click "Deploy" — OpenOntos generates the deployment artifact and ships it.`,
  },
  {
    slug: 'monitor',
    title: 'Monitoring',
    category: 'Guides',
    summary: 'Track runs, alerts, data quality, and lineage in real time.',
    body: `## What you see
- Live run status per pipeline
- Row counts, duration, failure reasons
- Data quality checks (null %, schema drift, range violations)
- Lineage graph: source → transform → destination

## Alerts
Set thresholds per check; alerts fire to email or webhook when breached.`,
  },
  {
    slug: 'faq',
    title: 'FAQ',
    category: 'Reference',
    summary: 'Answers to common questions about OpenOntos.',
    body: `## Is my data sent to the cloud?
No. OpenOntos is local-first. Sources, ontologies, and generated code stay on your machine unless you explicitly deploy to a cloud target.

## Which AI models are used?
The AI agent uses the configured LLM provider (see Settings). The default ships with a hosted gateway; you can swap for a local model.

## Can I export my ontology?
Yes — JSON, OWL, or RDF from the Ontology module's export menu.

## How do I back up a project?
Use Settings → Export project. Produces a single .zip including ontology, mappings, generated code, and pipeline definitions.`,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    category: 'Reference',
    summary: 'Common issues and how to resolve them.',
    body: `## "Connection test failed"
- Verify host, port, and credentials.
- Check firewall / VPN.
- For databases, confirm the user has SELECT on the target schema.

## "Auto-map produced nothing"
- Ensure the source has been profiled at least once.
- Check that the target ontology has attributes defined.

## "Pipeline stuck in 'queued'"
- Local runner: confirm the background worker process is running (Settings → Runtime).
- Restart the app if the queue is unresponsive.

## Reset everything
Top bar → RESET clears all local data and reloads with the demo project.`,
  },
];

export const CATEGORIES = Array.from(new Set(DOCS.map((d) => d.category)));
