# OpenOntos Sample Datasets

Ready-to-use raw data files organized by industry. Load these into OpenOntos to explore the full Profile → Ontology → Mapping → ETL Code → Deploy → Monitor workflow.

## Industries

### 🛒 E-Commerce (`ecommerce/`)
- **customers.csv** — Customer profiles with tiers, lifetime value, and geography
- **orders.csv** — Order transactions with status, discounts, and shipping
- **products.csv** — Product catalog with pricing, stock, and supplier info

### 🏥 Healthcare (`healthcare/`)
- **patients.csv** — Patient demographics, insurance, and admission data
- **encounters.csv** — Clinical encounters with diagnosis codes and dispositions
- **medications.csv** — Prescription records with dosage and frequency

### 🏦 Finance (`finance/`)
- **accounts.csv** — Bank accounts with types, balances, and risk ratings
- **transactions.csv** — Financial transactions with flagging for suspicious activity
- **risk_alerts.csv** — AML/fraud alert records with severity and status

### 🏭 Manufacturing (`manufacturing/`)
- **work_orders.csv** — Production work orders with yield and defect tracking
- **equipment_sensors.csv** — IoT sensor readings with threshold alerts
- **inventory.csv** — Raw materials and component inventory levels

### 🏬 Retail (`retail/`)
- **stores.csv** — Store locations with format, region, and square footage
- **sales.csv** — Point-of-sale transactions with payment and loyalty data
- **products_catalog.csv** — Product catalog with cost, margin, and seasonality

## Data Quality Notes

Each dataset intentionally includes real-world data quality issues for profiling:
- Missing values (nulls)
- Inconsistent formats
- Referential integrity gaps
- Outliers and anomalies

These are designed to exercise OpenOntos profiling and validation capabilities.
