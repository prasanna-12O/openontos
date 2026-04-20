<p align="center">
  <h1 align="center">🧠 OpenOntos</h1>
  <p align="center">
    <strong>Open-source agentic AI workspace for data engineers</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=flat-square" alt="Platform" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/electron-React%20%2B%20TypeScript-purple?style=flat-square" alt="Stack" />
    <img src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" alt="Status" />
  </p>
</p>

---

## Overview

OpenOntos is a **local-first** desktop application that helps data engineers go from raw source schemas to deployable data pipelines — powered by AI agents at every step.

No cloud dependency. No CLI. Just a modern GUI workspace that runs on your Windows machine.

**Who is it for?**
- Data engineers building Bronze → Silver → Gold pipelines
- Analytics engineers designing canonical data models
- Teams adopting Snowflake, BigQuery, Databricks, Redshift, or Microsoft Fabric

---

## Core Modules

OpenOntos is organized into 8 sequential modules plus a Settings panel, accessible from the left sidebar:

### 1. 🔌 Data Sources
Connect to databases (PostgreSQL, MySQL, SQL Server, Oracle, MongoDB), cloud warehouses (Snowflake, BigQuery, Redshift, Databricks), cloud storage (S3, Azure Blob), APIs, or load local CSV files. Test connections and browse available tables.

### 2. 📊 Profile
Analyze source data and schemas. View column statistics including null percentages, uniqueness scores, data types, sample values, and distribution charts. **AI-powered column descriptions** — click the ✨ sparkle icon on any table header to auto-generate one-liner business descriptions for every column using your configured LLM.

### 3. 🧬 Ontology
Convert raw schemas into structured business entities. Visualize entity relationships on an interactive graph workspace powered by ReactFlow. Drag, connect, and refine your semantic model.

### 4. 🔗 Mapping
Map source columns to target business entities. Review AI-suggested source-to-target mappings, approve or edit transformations, and define join logic — all in a side-by-side view.

### 5. ⚙️ ETL Code
Generate and edit transformation code from your mappings and ontology. Select your **target data platform** (Snowflake, BigQuery, Redshift, Databricks, Fabric) directly in this module. Outputs Bronze / Silver / Gold layer artifacts as SQL or PySpark. Create custom ETL objects (tables/views) with inline code editing. **Execute code directly** against your connected target platform.

### 6. 🔄 Pipelines
Manage pipeline execution workflows. Queue and run ETL jobs per layer (Bronze, Silver, Gold) or for custom objects. View run history with status, duration, rows processed, and logs. Set up cron-based schedules for automated pipeline execution.

### 7. 🚀 Deploy
Deploy generated artifacts to your target platform. Configure **platform connection strings** with full credential management (host, port, database, warehouse, schema, credentials). Test connections before deploying. Review readiness checklists, trigger deployment runs, and monitor step-by-step deployment progress with live logs.

### 8. 📈 Monitor
Track pipeline health, validation warnings, unresolved mappings, and quality checks. View **pipeline execution history** with run status, duration, and error details. Browse an activity timeline and severity-coded issue list across all modules.

### ⚙️ Settings
Configure LLM connections (API URL, token, model name) for AI agent functionality. Manage multiple LLM configurations with a default selection.

---

## Agentic AI System

Each module is backed by a specialized AI agent:

| Agent | Role |
|-------|------|
| **Profile Agent** | Analyzes source structure, infers schema quality, generates column descriptions |
| **Ontology Agent** | Suggests business entities and semantic structure |
| **Mapping Agent** | Maps source attributes to canonical entities and targets |
| **ETL Code Agent** | Generates SQL / PySpark across Bronze / Silver / Gold layers |
| **Pipeline Agent** | Manages execution workflows and scheduling |
| **Deploy Agent** | Prepares packaging, connection testing, and deployment execution |
| **Monitor Agent** | Surfaces health issues, validation warnings, and tracking summaries |

The right-side **Agent Panel** (toggleable) shows active agent status, reasoning steps, and task history. Use prompts like:
- *"Profile this dataset"*
- *"Generate column descriptions"*
- *"Suggest ontology"*
- *"Generate Gold layer code"*
- *"Run bronze pipeline"*
- *"Deploy to Snowflake"*
- *"Show monitoring issues"*

---

## Application Flow

```
Data Sources → Profile → Ontology → Mapping → ETL Code → Pipelines → Deploy → Monitor
     │            │          │          │          │           │          │         │
  Connect &    Analyze    Build      Map src    Generate    Schedule   Push to   Track
  load data    schemas    entities   to target  & edit ETL  & run      platform  health
```

Each step feeds into the next. The sidebar provides quick navigation between modules, and a **Project Selector** screen lets you manage multiple independent projects.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Electron |
| Frontend | React 18 + TypeScript 5 |
| Styling | Tailwind CSS v3 |
| State Management | Zustand (persisted) |
| Graph Visualization | ReactFlow |
| CSV Parsing | PapaParse |
| Animations | Framer Motion |
| LLM Integration | Configurable API (OpenAI-compatible) |
| Build Tool | Vite 5 |
| Packaging | electron-builder |

---

## Data Storage & Architecture

OpenOntos is a **local-first** application — there is no server-side database or cloud backend.

| Aspect | Details |
|--------|---------|
| **Storage engine** | IndexedDB via localForage (web) / Electron file storage (desktop) |
| **State management** | Zustand with `persist` middleware automatically saves/loads all project data |
| **Persistence scope** | Per-browser, per-device only |
| **Multi-user sharing** | ❌ Not supported — each user has their own isolated local data |
| **Cloud sync** | ❌ None — fully offline-capable, no cloud dependency |
| **Data loss risk** | Clearing browser data will erase all projects and settings |

### What gets persisted?

- All projects and their configurations
- Data source connections and credentials
- Profiled table schemas and column statistics
- Ontology entities, edges, and relationships
- Source-to-target mappings
- Generated ETL code and custom ETL objects
- Pipeline run history and schedules
- Deploy configurations and platform connections
- LLM configurations (API URLs, tokens, model names)
- Agent chat history

### Important notes

- **Web version**: Data is stored in IndexedDB (via localForage) in the browser. Opening the app in a different browser, device, or incognito window starts fresh with only the demo project.
- **Electron version**: Data is stored via Electron's file-based storage adapter, persisted to the user's app data directory on disk.
- **No authentication**: There is no login system — the app is designed for single-user local use.
- **Backup**: To prevent data loss, consider exporting project configurations periodically (feature planned).

### Browser Storage Limits

The web version uses **IndexedDB** (via localForage), which provides significantly more capacity than localStorage:

| Storage Backend | Typical Limit |
|----------------|--------------|
| IndexedDB (Chrome/Edge) | Up to 80% of available disk space |
| IndexedDB (Firefox) | Up to 50% of available disk space |
| IndexedDB (Safari) | ~1 GB (prompts user beyond that) |
| localStorage (legacy fallback) | ~5–10 MB |

#### Approximate Capacity (IndexedDB)

| Metric | Estimate |
|--------|----------|
| Projects | Hundreds with full complexity |
| Tables per project | 500+ profiled tables |
| Columns per table | 1,000+ with full stats |
| Agent chat messages | 10,000+ messages |
| ETL code entries | 1,000+ custom objects |
| Pipeline run history | 10,000+ runs with logs |

#### Known Risks

- **Browser eviction**: Under extreme storage pressure, browsers may evict IndexedDB data. Use `navigator.storage.persist()` to request durable storage.
- **Safari private browsing**: IndexedDB is capped and may be cleared on session end.
- **No compression**: Zustand stores raw JSON strings with no gzip or binary encoding.
- **Large schemas**: Very large projects still consume more space — monitor usage in Settings.

#### Recommendations

- Monitor storage usage via the **Settings → Storage Usage** indicator.
- **Clear agent chat history** periodically to free space.
- **Use the Electron desktop build** for production or heavy workloads — it uses file-based storage limited only by disk space.

---

## Data Privacy & Security Architecture

**No customer data ever leaves your browser or device.** OpenOntos is architecturally incapable of uploading your data to any server.

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│                   USER'S BROWSER                     │
│                                                     │
│  ┌───────────┐    ┌──────────┐    ┌──────────────┐  │
│  │ React App │◄──►│ Zustand  │◄──►│  IndexedDB   │  │
│  │ (UI)      │    │ (State)  │    │ (localForage)│  │
│  └───────────┘    └──────────┘    └──────────────┘  │
│                                                     │
│  All data lives HERE and ONLY here:                 │
│  • Data source credentials                          │
│  • Table schemas & profiling stats                  │
│  • Ontology models (nodes/edges)                    │
│  • Mapping rules                                    │
│  • ETL code (all platforms)                         │
│  • Pipeline runs & logs                             │
│  • Deploy configurations                            │
│  • LLM API keys                                     │
│  • Agent chat history                               │
└─────────────────────────────────────────────────────┘
                      ▲
                      │ NOTHING leaves this boundary
                      ▼
┌─────────────────────────────────────────────────────┐
│              HOSTING SERVER                          │
│                                                     │
│  Serves ONLY static files:                          │
│  • index.html, JS bundles, CSS, icons               │
│                                                     │
│  ❌ No database    ❌ No API endpoints               │
│  ❌ No server code ❌ No data collection             │
│  ❌ No analytics   ❌ No user accounts               │
└─────────────────────────────────────────────────────┘
```

### Data Residency by Type

| Data | Stored Where | Leaves Browser? |
|------|-------------|-----------------|
| Data source credentials | IndexedDB | ❌ Never |
| Table schemas & column stats | IndexedDB | ❌ Never |
| Ontology graph (entities, edges) | IndexedDB | ❌ Never |
| Mapping rules | IndexedDB | ❌ Never |
| ETL code (SQL/PySpark) | IndexedDB | ❌ Never |
| Pipeline run history & logs | IndexedDB | ❌ Never |
| Deploy configs & connections | IndexedDB | ❌ Never |
| LLM API keys | IndexedDB | Only to **your own** configured LLM endpoint |
| Agent chat messages | IndexedDB | Prompts sent to **your own** LLM endpoint |

### Outbound Network Calls

OpenOntos makes **three categories** of outbound network calls — all directed to infrastructure **you own and configure**:

#### 1. Static Asset Loading (Hosting CDN)

```
Browser ──GET──► Hosting CDN (one-time, cacheable)
```

- Fetches `index.html`, JS bundles, CSS, icons
- Happens once on first load, then served from browser cache
- The hosting server has **no database, no API, no data collection**

#### 2. Data Source Connections (Profiling & Schema Discovery)

```
Browser ──SQL/API──► Your Database (e.g., db.company.com:5432)
```

| Aspect | Detail |
|--------|--------|
| **When** | During Data Sources connection testing and Profile analysis |
| **What's sent** | Connection credentials + metadata queries (`INFORMATION_SCHEMA`, `SELECT TOP N` for sampling) |
| **What's returned** | Table names, column names, data types, row counts, sample values |
| **Destination** | Only the hostname/IP **you** entered in the connection form |
| **Intermediary** | ❌ None — browser connects directly (or Electron's Node.js in desktop mode) |

Supported sources: PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Snowflake, BigQuery, Redshift, Databricks, S3, Azure Blob, APIs.

#### 3. Target Platform Connections (Deploy & Pipeline Execution)

```
Browser ──DDL/DML──► Your Target Platform (e.g., xyz.snowflakecomputing.com)
```

| Aspect | Detail |
|--------|--------|
| **When** | During Deploy runs and Pipeline execution |
| **What's sent** | Platform credentials + generated DDL/DML scripts (CREATE TABLE, INSERT, stored procedures) |
| **What's returned** | Execution status, row counts, error messages |
| **Destination** | Only the platform endpoint **you** configured in Deploy settings |
| **Intermediary** | ❌ None |

Supported targets: Snowflake, BigQuery, Redshift, Databricks, Microsoft Fabric.

#### 4. LLM Inference (AI Agent)

```
Browser ──POST──► Your LLM API (e.g., api.openai.com or localhost:11434)
```

| Aspect | Detail |
|--------|--------|
| **When** | When using AI features (column descriptions, ontology suggestions, code generation) |
| **What's sent** | Prompts containing schema metadata, ontology context, user questions |
| **What's returned** | AI-generated suggestions, code, descriptions |
| **Destination** | Only the LLM API URL **you** configured in Settings |
| **Intermediary** | ❌ None — OpenOntos has no proxy server |

#### What's Never Sent Anywhere

| Data | Sent to OpenOntos servers? | Sent to any third party? |
|------|---------------------------|--------------------------|
| Raw row-level production data | ❌ Never | ❌ Never |
| Database credentials/passwords | ❌ Never | Only to **your** configured endpoints |
| Generated ETL code | ❌ Never | Only to **your** deploy target |
| Ontology models | ❌ Never | Only as LLM context to **your** LLM |
| Profiling statistics | ❌ Never | ❌ Never |

### Compliance & Privacy Implications

- **No account needed for casual use** — try the app freely with up to 2 projects.
- **No data breach risk from hosting** — the server has zero knowledge of your data.
- **GDPR/compliance friendly** — customer data never crosses a network boundary you don't control.
- **Offline capable** — once loaded, the app works without internet (except LLM calls).
- **Data portability** — your data is in your browser's IndexedDB; you own it completely.

---

## User Registration & Data Collection Policy

OpenOntos uses a **lightweight, opt-in registration model**. The first two projects can be created without registering. From the **3rd project onward**, registration becomes mandatory.

### Why we ask you to register

- Track active users to plan roadmap and capacity
- Enable future cross-device sync and collaboration features
- Let the AI agent tailor suggestions to your role and industry

### What we collect at registration

| Field | Required | Purpose |
|-------|----------|---------|
| **Full name** | ✅ Yes | Personalize your workspace |
| **Email address** | ✅ Yes | Magic-link verification & sign-in |
| **Organization** | ⚪ Optional | Aggregate usage statistics only |
| **Role** (e.g., Data Engineer, Analyst, Architect) | ⚪ Optional | Tailor AI agent suggestions |

> No password is ever stored — authentication uses **passwordless magic links** delivered to your email.

### Verification flow

1. You submit the registration form on the `/auth` page.
2. A one-time **magic link** is emailed to you.
3. Clicking the link verifies your email address and signs you in.
4. A profile row is automatically created in the cloud database with your details.

### Admin notification

Upon every successful first-time email verification, **one notification email** is sent to:

```
contactlucid@luciddatahub.com
```

The notification contains: **name, email, organization, role, and registration timestamp**. The notification is **idempotent** — a database flag (`admin_notified`) ensures it is sent at most once per user.

The notification **never contains** any project data, schemas, credentials, ETL code, or LLM prompts.

### Data storage & access policy

| Aspect | Detail |
|--------|--------|
| **Storage backend** | Lovable Cloud (managed PostgreSQL) |
| **Table** | `public.profiles` |
| **Row-Level Security** | ✅ Enabled — each user can read/update **only their own row** |
| **Allowed operations** | View own profile, create own profile, update own profile |
| **Disallowed operations** | Delete profile, view other users' profiles |
| **Project data location** | ❌ Still local-only (IndexedDB / Electron storage) |

### Gating logic

| User-created projects | Anonymous behavior |
|----------------------|--------------------|
| 0 | Full access, no prompts |
| 1 | Full access, dismissible registration prompt shown |
| 2 | Full access, prompt persists |
| 3rd attempt | **Hard block** — modal requires registration |

The built-in **demo project does not count** toward the limit.

### Your rights

- **Sign out** anytime via the top bar.
- **Update your profile** by re-registering with the same email.
- **Account deletion**: contact `contactlucid@luciddatahub.com` to request removal of your profile data.

---


### Prerequisites

- **Node.js** ≥ 18
- **npm** or **bun**

### Install & Run (Dev)

```bash
git clone https://github.com/your-org/openontos.git
cd openontos
npm install
npm run dev
```

### Run in Electron (Dev)

```bash
# Terminal 1 — Vite dev server
npm run dev

# Terminal 2 — Electron
npx electron electron/main.cjs
```

### Configure AI Agents

1. Open the app and go to **Settings**
2. Add an LLM configuration (API URL, token, model name)
3. Set it as default
4. AI features (column descriptions, ontology suggestions, code generation) are now enabled

---

## Windows .exe Packaging

1. Install electron-builder:

```bash
npm install --save-dev electron-builder
```

2. Add to `package.json`:

```json
{
  "build": {
    "appId": "com.openontos.app",
    "productName": "OpenOntos",
    "directories": { "output": "release" },
    "win": {
      "target": ["nsis"],
      "icon": "public/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

3. Build:

```bash
npm run build
npx electron-builder --win
```

The installer will be in the `release/` directory.

---

## Project Structure

```
openontos/
├── electron/
│   ├── main.cjs              # Electron main process
│   └── preload.cjs            # Preload script
├── src/
│   ├── components/
│   │   ├── layout/            # AppSidebar, TopBar, AgentPanel
│   │   ├── modules/           # DataSources, Profile, Ontology, Mapping,
│   │   │                      # ETL, Pipelines, Deploy, Monitor, Settings,
│   │   │                      # ProjectSelector, ConnectionParamsInput
│   │   └── ui/                # shadcn/ui components
│   ├── data/
│   │   └── demoProject.ts     # Built-in e-commerce demo dataset
│   ├── hooks/
│   │   └── useLLM.ts          # LLM integration hook
│   ├── lib/
│   │   ├── llm.ts             # LLM API utilities
│   │   ├── storage.ts         # Electron storage adapter
│   │   └── utils.ts           # Utility functions
│   ├── store/
│   │   └── useAppStore.ts     # Zustand state management
│   ├── types/
│   │   └── project.ts         # TypeScript type definitions
│   ├── pages/
│   │   └── Index.tsx          # Main application page
│   └── index.css              # Design tokens & theme
├── samples/                   # Sample datasets (ecommerce, finance,
│                              # healthcare, manufacturing, retail)
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## Supported Target Platforms

| Platform | SQL | PySpark | Deploy | Pipelines |
|----------|-----|---------|--------|-----------|
| Snowflake | ✅ | ✅ | ✅ | ✅ |
| Google BigQuery | ✅ | ✅ | ✅ | ✅ |
| Amazon Redshift | ✅ | ✅ | ✅ | ✅ |
| Databricks | ✅ | ✅ | ✅ | ✅ |
| Microsoft Fabric | ✅ | ✅ | ✅ | ✅ |

---

## Inputs & Outputs

**Inputs:**
- CSV, JSON, YAML files
- Database connections (PostgreSQL, MySQL, SQL Server, Oracle, MongoDB)
- Cloud warehouse connections (Snowflake, BigQuery, Redshift, Databricks)
- Cloud storage (S3, Azure Blob)
- API endpoints
- Manual schema entry

**Outputs:**
- AI-generated column descriptions
- Ontology / entity models with interactive graph
- Source-to-target mapping specs
- SQL scripts (per platform)
- PySpark scripts
- Pipeline execution logs & metrics
- Deployment packages with connection validation
- Validation & monitoring summaries

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ for data engineers who ship pipelines, not YAML.
</p>
