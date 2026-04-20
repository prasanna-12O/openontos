import type { Project } from '@/types/project';

export const DEMO_PROJECT: Project = {
  id: 'demo-ecommerce',
  name: 'E-Commerce Data Warehouse',
  description: 'Demo: Transform raw e-commerce data into a Gold-layer analytics warehouse',
  industryType: 'Retail & E-Commerce',
  subjectArea: 'Order Management & Customer Analytics',
  createdAt: '2025-04-10T10:00:00Z',
  updatedAt: '2025-04-16T14:30:00Z',
  dataSources: [
    {
      id: 'ds-1',
      name: 'E-Commerce PostgreSQL',
      type: 'postgresql',
      status: 'connected',
      connectionParams: { host: 'ecom-db.internal', port: '5432', database: 'ecommerce', username: 'readonly' },
      lastTested: '2025-04-16T14:00:00Z',
      tables: ['raw_orders', 'raw_customers', 'raw_products', 'raw_order_items'],
    },
    {
      id: 'ds-2',
      name: 'Supplier API',
      type: 'api',
      status: 'connected',
      connectionParams: { url: 'https://api.suppliers.internal/v2', method: 'GET' },
      lastTested: '2025-04-16T13:30:00Z',
      tables: ['raw_suppliers'],
    },
  ],
  tables: [
    {
      id: 't1', name: 'raw_orders', source: 'orders.csv', rowCount: 24850, profiledAt: '2025-04-10T10:05:00Z',
      columns: [
        { name: 'order_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 100, sampleValues: ['10001', '10002', '10003'], isKey: true },
        { name: 'customer_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 38, sampleValues: ['501', '502', '503'], isKey: false },
        { name: 'order_date', datatype: 'TIMESTAMP', nullPercent: 0.3, uniquePercent: 92, sampleValues: ['2024-01-15 09:22:00', '2024-01-16 14:11:00'] },
        { name: 'total_amount', datatype: 'DECIMAL(10,2)', nullPercent: 0, uniquePercent: 81, sampleValues: ['149.99', '299.50', '89.00'] },
        { name: 'currency', datatype: 'VARCHAR(3)', nullPercent: 0, uniquePercent: 3, sampleValues: ['USD', 'EUR', 'GBP'] },
        { name: 'status', datatype: 'VARCHAR(20)', nullPercent: 0, uniquePercent: 5, sampleValues: ['completed', 'pending', 'shipped', 'cancelled'] },
        { name: 'channel', datatype: 'VARCHAR(20)', nullPercent: 1.2, uniquePercent: 4, sampleValues: ['web', 'mobile', 'in-store'] },
      ]
    },
    {
      id: 't2', name: 'raw_customers', source: 'customers.csv', rowCount: 8720, profiledAt: '2025-04-10T10:05:00Z',
      columns: [
        { name: 'customer_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 100, sampleValues: ['501', '502'], isKey: true },
        { name: 'full_name', datatype: 'VARCHAR(100)', nullPercent: 0, uniquePercent: 97, sampleValues: ['Alice Smith', 'Bob Jones'] },
        { name: 'email', datatype: 'VARCHAR(200)', nullPercent: 2.1, uniquePercent: 99, sampleValues: ['alice@example.com'], anomalies: ['2.1% null — may affect deduplication'] },
        { name: 'signup_date', datatype: 'DATE', nullPercent: 0, uniquePercent: 78, sampleValues: ['2023-06-01'] },
        { name: 'segment', datatype: 'VARCHAR(20)', nullPercent: 4.8, uniquePercent: 5, sampleValues: ['premium', 'standard', 'basic', 'enterprise'] },
        { name: 'country', datatype: 'VARCHAR(2)', nullPercent: 0.5, uniquePercent: 28, sampleValues: ['US', 'UK', 'DE', 'FR'] },
      ]
    },
    {
      id: 't3', name: 'raw_products', source: 'products.csv', rowCount: 1450, profiledAt: '2025-04-10T10:05:00Z',
      columns: [
        { name: 'product_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 100, sampleValues: ['101', '102'], isKey: true },
        { name: 'product_name', datatype: 'VARCHAR(200)', nullPercent: 0, uniquePercent: 98, sampleValues: ['Widget Pro', 'Gadget Ultra'] },
        { name: 'category', datatype: 'VARCHAR(50)', nullPercent: 0.8, uniquePercent: 18, sampleValues: ['electronics', 'clothing', 'home'] },
        { name: 'subcategory', datatype: 'VARCHAR(50)', nullPercent: 3.2, uniquePercent: 42, sampleValues: ['phones', 'laptops', 'accessories'] },
        { name: 'price', datatype: 'DECIMAL(10,2)', nullPercent: 0, uniquePercent: 74, sampleValues: ['49.99', '129.00', '899.99'] },
        { name: 'supplier_id', datatype: 'INTEGER', nullPercent: 1.5, uniquePercent: 12, sampleValues: ['201', '202'] },
      ]
    },
    {
      id: 't4', name: 'raw_order_items', source: 'order_items.csv', rowCount: 62400, profiledAt: '2025-04-10T10:05:00Z',
      columns: [
        { name: 'item_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 100, sampleValues: ['1', '2', '3'], isKey: true },
        { name: 'order_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 40, sampleValues: ['10001', '10002'] },
        { name: 'product_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 28, sampleValues: ['101', '102'] },
        { name: 'quantity', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 10, sampleValues: ['1', '2', '3', '5'] },
        { name: 'unit_price', datatype: 'DECIMAL(10,2)', nullPercent: 0, uniquePercent: 68, sampleValues: ['49.99', '129.00'], anomalies: ['High correlation with products.price — possibly denormalized'] },
        { name: 'discount_pct', datatype: 'DECIMAL(5,2)', nullPercent: 45, uniquePercent: 8, sampleValues: ['0.00', '10.00', '15.00'] },
      ]
    },
    {
      id: 't5', name: 'raw_suppliers', source: 'suppliers.json', rowCount: 85, profiledAt: '2025-04-10T10:06:00Z',
      columns: [
        { name: 'supplier_id', datatype: 'INTEGER', nullPercent: 0, uniquePercent: 100, sampleValues: ['201', '202'], isKey: true },
        { name: 'company_name', datatype: 'VARCHAR(200)', nullPercent: 0, uniquePercent: 100, sampleValues: ['Acme Corp', 'GlobalTech'] },
        { name: 'contact_email', datatype: 'VARCHAR(200)', nullPercent: 5, uniquePercent: 95, sampleValues: ['sales@acme.com'] },
        { name: 'region', datatype: 'VARCHAR(50)', nullPercent: 0, uniquePercent: 6, sampleValues: ['North America', 'Europe', 'APAC'] },
      ]
    },
  ],
  entities: [
    { id: 'e1', label: 'Customer', tables: ['raw_customers'], attributes: ['customer_id', 'full_name', 'email', 'segment', 'country'], confidence: 0.96 },
    { id: 'e2', label: 'Order', tables: ['raw_orders', 'raw_order_items'], attributes: ['order_id', 'order_date', 'total_amount', 'status', 'channel'], confidence: 0.94 },
    { id: 'e3', label: 'Product', tables: ['raw_products'], attributes: ['product_id', 'product_name', 'category', 'subcategory', 'price'], confidence: 0.95 },
    { id: 'e4', label: 'Supplier', tables: ['raw_suppliers'], attributes: ['supplier_id', 'company_name', 'region'], confidence: 0.91 },
    { id: 'e5', label: 'Order Line Item', tables: ['raw_order_items'], attributes: ['item_id', 'quantity', 'unit_price', 'discount_pct'], confidence: 0.88 },
  ],
  edges: [
    { id: 'ed1', source: 'e1', target: 'e2', label: 'places', type: 'parent-child', confidence: 0.95 },
    { id: 'ed2', source: 'e2', target: 'e5', label: 'contains', type: 'contains', confidence: 0.97 },
    { id: 'ed3', source: 'e5', target: 'e3', label: 'references', type: 'related', confidence: 0.93 },
    { id: 'ed4', source: 'e4', target: 'e3', label: 'supplies', type: 'related', confidence: 0.85 },
  ],
  mappings: [
    { id: 'm1', sourceTable: 'raw_customers', sourceColumn: 'customer_id', targetEntity: 'Customer', targetAttribute: 'customer_key', transformLogic: 'CAST(customer_id AS BIGINT)', confidence: 0.98, approved: true },
    { id: 'm2', sourceTable: 'raw_customers', sourceColumn: 'full_name', targetEntity: 'Customer', targetAttribute: 'customer_name', transformLogic: 'TRIM(UPPER(full_name))', confidence: 0.95, approved: true },
    { id: 'm3', sourceTable: 'raw_customers', sourceColumn: 'email', targetEntity: 'Customer', targetAttribute: 'email_address', transformLogic: 'LOWER(TRIM(email))', confidence: 0.93, approved: false },
    { id: 'm4', sourceTable: 'raw_customers', sourceColumn: 'segment', targetEntity: 'Customer', targetAttribute: 'customer_segment', transformLogic: "COALESCE(segment, 'standard')", confidence: 0.90, approved: false },
    { id: 'm5', sourceTable: 'raw_orders', sourceColumn: 'order_id', targetEntity: 'Order', targetAttribute: 'order_key', transformLogic: 'CAST(order_id AS BIGINT)', confidence: 0.99, approved: true },
    { id: 'm6', sourceTable: 'raw_orders', sourceColumn: 'order_date', targetEntity: 'Order', targetAttribute: 'order_timestamp', transformLogic: 'CAST(order_date AS TIMESTAMP)', confidence: 0.96, approved: true },
    { id: 'm7', sourceTable: 'raw_orders', sourceColumn: 'total_amount', targetEntity: 'Order', targetAttribute: 'order_total', transformLogic: 'CAST(total_amount AS DECIMAL(12,2))', confidence: 0.97, approved: true },
    { id: 'm8', sourceTable: 'raw_order_items', sourceColumn: 'unit_price', targetEntity: 'Order Line Item', targetAttribute: 'line_unit_price', transformLogic: 'COALESCE(unit_price, 0)', confidence: 0.85, approved: false },
    { id: 'm9', sourceTable: 'raw_products', sourceColumn: 'product_id', targetEntity: 'Product', targetAttribute: 'product_key', transformLogic: 'CAST(product_id AS BIGINT)', confidence: 0.99, approved: true },
    { id: 'm10', sourceTable: 'raw_products', sourceColumn: 'category', targetEntity: 'Product', targetAttribute: 'product_category', transformLogic: "COALESCE(TRIM(category), 'uncategorized')", confidence: 0.88, approved: false },
  ],
  validations: [
    { id: 'v1', type: 'missing_join', severity: 'warning', message: 'No direct path from Customer to Product', details: 'Customers and Products are only connected through Orders → Order Line Items → Products. Consider whether a direct recommendation relationship is needed.', module: 'ontology', resolved: false, timestamp: '2025-04-12T09:00:00Z' },
    { id: 'v2', type: 'data_quality', severity: 'info', message: 'customers.email has 2.1% null rate', details: 'Email nulls may impact customer deduplication logic in Silver layer. Consider fallback to name + country composite key.', module: 'profile', resolved: false, timestamp: '2025-04-10T10:10:00Z' },
    { id: 'v3', type: 'low_confidence', severity: 'warning', message: 'order_items.unit_price may be denormalized', details: 'Correlation with products.price is 0.94. This could be a snapshot price at time-of-sale or a redundant copy. Confirm business intent.', module: 'mapping', resolved: false, timestamp: '2025-04-12T11:00:00Z' },
    { id: 'v4', type: 'data_quality', severity: 'warning', message: 'discount_pct has 45% null rate', details: 'Nearly half of order items have no discount info. Determine if NULL means 0% or missing data.', module: 'profile', resolved: false, timestamp: '2025-04-10T10:10:00Z' },
    { id: 'v5', type: 'unmapped', severity: 'info', message: 'raw_orders.currency not mapped', details: 'Currency field exists in orders but is not mapped to any target entity attribute. May be needed for multi-currency Gold layer aggregations.', module: 'mapping', resolved: false, timestamp: '2025-04-12T11:30:00Z' },
    { id: 'v6', type: 'deployment', severity: 'info', message: 'No deployment target configured', details: 'Select a target platform (Snowflake, Databricks, Fabric, BigQuery, or Redshift) to prepare deployment artifacts.', module: 'deploy', resolved: false, timestamp: '2025-04-16T14:00:00Z' },
  ],
  pipelines: {
    bronze: {
      sql_snowflake: `-- ═══════════════════════════════════════════
-- BRONZE LAYER: Raw Ingestion (Snowflake)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE OR REPLACE TABLE bronze.raw_orders AS
SELECT
  *,
  CURRENT_TIMESTAMP()    AS _ingested_at,
  'orders.csv'           AS _source_file,
  MD5(TO_VARCHAR(order_id)) AS _row_hash
FROM @data_stage/orders.csv
(FILE_FORMAT => 'csv_format');

CREATE OR REPLACE TABLE bronze.raw_customers AS
SELECT
  *,
  CURRENT_TIMESTAMP()    AS _ingested_at,
  'customers.csv'        AS _source_file,
  MD5(TO_VARCHAR(customer_id)) AS _row_hash
FROM @data_stage/customers.csv
(FILE_FORMAT => 'csv_format');

CREATE OR REPLACE TABLE bronze.raw_products AS
SELECT
  *,
  CURRENT_TIMESTAMP()    AS _ingested_at,
  'products.csv'         AS _source_file
FROM @data_stage/products.csv
(FILE_FORMAT => 'csv_format');

CREATE OR REPLACE TABLE bronze.raw_order_items AS
SELECT
  *,
  CURRENT_TIMESTAMP()    AS _ingested_at,
  'order_items.csv'      AS _source_file
FROM @data_stage/order_items.csv
(FILE_FORMAT => 'csv_format');

CREATE OR REPLACE TABLE bronze.raw_suppliers AS
SELECT
  *,
  CURRENT_TIMESTAMP()    AS _ingested_at,
  'suppliers.json'       AS _source_file
FROM @data_stage/suppliers.json
(FILE_FORMAT => 'json_format');`,
      sql_bigquery: `-- ═══════════════════════════════════════════
-- BRONZE LAYER: Raw Ingestion (BigQuery)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE OR REPLACE TABLE bronze.raw_orders AS
SELECT *, CURRENT_TIMESTAMP() AS _ingested_at, 'orders.csv' AS _source
FROM \`project.staging.orders\`;

CREATE OR REPLACE TABLE bronze.raw_customers AS
SELECT *, CURRENT_TIMESTAMP() AS _ingested_at, 'customers.csv' AS _source
FROM \`project.staging.customers\`;

CREATE OR REPLACE TABLE bronze.raw_products AS
SELECT *, CURRENT_TIMESTAMP() AS _ingested_at
FROM \`project.staging.products\`;

CREATE OR REPLACE TABLE bronze.raw_order_items AS
SELECT *, CURRENT_TIMESTAMP() AS _ingested_at
FROM \`project.staging.order_items\`;

CREATE OR REPLACE TABLE bronze.raw_suppliers AS
SELECT *, CURRENT_TIMESTAMP() AS _ingested_at
FROM \`project.staging.suppliers\`;`,
      sql_redshift: `-- ═══════════════════════════════════════════
-- BRONZE LAYER: Raw Ingestion (Redshift)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE bronze.raw_orders AS
SELECT *, GETDATE() AS _ingested_at, 'orders.csv' AS _source
FROM staging.orders;

CREATE TABLE bronze.raw_customers AS
SELECT *, GETDATE() AS _ingested_at
FROM staging.customers;`,
      pyspark_databricks: `# ═══════════════════════════════════════════
# BRONZE LAYER: Raw Ingestion (Databricks)
# Generated by OpenOntos
# ═══════════════════════════════════════════

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, lit, md5, col

spark = SparkSession.builder.appName("OpenOntos-Bronze").getOrCreate()

# --- Orders ---
df_orders = (spark.read
    .option("header", True)
    .option("inferSchema", True)
    .csv("/mnt/landing/orders.csv"))
df_orders = (df_orders
    .withColumn("_ingested_at", current_timestamp())
    .withColumn("_source_file", lit("orders.csv"))
    .withColumn("_row_hash", md5(col("order_id").cast("string"))))
df_orders.write.mode("overwrite").saveAsTable("bronze.raw_orders")

# --- Customers ---
df_customers = (spark.read
    .option("header", True)
    .option("inferSchema", True)
    .csv("/mnt/landing/customers.csv"))
df_customers = (df_customers
    .withColumn("_ingested_at", current_timestamp())
    .withColumn("_source_file", lit("customers.csv")))
df_customers.write.mode("overwrite").saveAsTable("bronze.raw_customers")

# --- Products ---
df_products = (spark.read
    .option("header", True)
    .option("inferSchema", True)
    .csv("/mnt/landing/products.csv"))
df_products = (df_products
    .withColumn("_ingested_at", current_timestamp()))
df_products.write.mode("overwrite").saveAsTable("bronze.raw_products")

# --- Order Items ---
df_items = (spark.read
    .option("header", True)
    .option("inferSchema", True)
    .csv("/mnt/landing/order_items.csv"))
df_items = (df_items
    .withColumn("_ingested_at", current_timestamp()))
df_items.write.mode("overwrite").saveAsTable("bronze.raw_order_items")

# --- Suppliers ---
df_suppliers = spark.read.json("/mnt/landing/suppliers.json")
df_suppliers = (df_suppliers
    .withColumn("_ingested_at", current_timestamp()))
df_suppliers.write.mode("overwrite").saveAsTable("bronze.raw_suppliers")

print("✓ Bronze layer ingestion complete")`,
      pyspark_fabric: `# ═══════════════════════════════════════════
# BRONZE LAYER: Raw Ingestion (Microsoft Fabric)
# Generated by OpenOntos
# ═══════════════════════════════════════════

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, lit

spark = SparkSession.builder.getOrCreate()

for source in ["orders", "customers", "products", "order_items"]:
    df = (spark.read
        .option("header", True)
        .option("inferSchema", True)
        .csv(f"abfss://landing@storage.dfs.core.windows.net/{source}.csv"))
    df = df.withColumn("_ingested_at", current_timestamp())
    df.write.mode("overwrite").format("delta").saveAsTable(f"bronze.raw_{source}")

df_suppliers = spark.read.json("abfss://landing@storage.dfs.core.windows.net/suppliers.json")
df_suppliers = df_suppliers.withColumn("_ingested_at", current_timestamp())
df_suppliers.write.mode("overwrite").format("delta").saveAsTable("bronze.raw_suppliers")

print("✓ Bronze layer ingestion complete (Fabric)")`,
    },
    silver: {
      sql_snowflake: `-- ═══════════════════════════════════════════
-- SILVER LAYER: Cleaned & Conformed (Snowflake)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS silver;

-- Dimension: Customers
CREATE OR REPLACE TABLE silver.dim_customers AS
SELECT
  CAST(customer_id AS BIGINT)         AS customer_key,
  TRIM(UPPER(full_name))              AS customer_name,
  LOWER(TRIM(email))                  AS email_address,
  signup_date,
  COALESCE(segment, 'standard')       AS customer_segment,
  COALESCE(country, 'UNKNOWN')        AS country_code,
  CURRENT_TIMESTAMP()                 AS _processed_at
FROM bronze.raw_customers
WHERE customer_id IS NOT NULL
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY customer_id ORDER BY _ingested_at DESC
) = 1;

-- Dimension: Products
CREATE OR REPLACE TABLE silver.dim_products AS
SELECT
  CAST(product_id AS BIGINT)          AS product_key,
  TRIM(product_name)                  AS product_name,
  COALESCE(TRIM(category), 'uncategorized') AS product_category,
  TRIM(subcategory)                   AS product_subcategory,
  CAST(price AS DECIMAL(12,2))        AS list_price,
  CAST(supplier_id AS BIGINT)         AS supplier_key,
  CURRENT_TIMESTAMP()                 AS _processed_at
FROM bronze.raw_products
WHERE product_id IS NOT NULL;

-- Fact: Orders with Line Items
CREATE OR REPLACE TABLE silver.fact_order_lines AS
SELECT
  CAST(oi.item_id AS BIGINT)          AS line_item_key,
  CAST(o.order_id AS BIGINT)          AS order_key,
  CAST(o.customer_id AS BIGINT)       AS customer_key,
  CAST(oi.product_id AS BIGINT)       AS product_key,
  CAST(o.order_date AS TIMESTAMP)     AS order_timestamp,
  o.status                            AS order_status,
  COALESCE(o.channel, 'unknown')      AS sales_channel,
  oi.quantity,
  CAST(oi.unit_price AS DECIMAL(12,2))  AS unit_price,
  COALESCE(oi.discount_pct, 0)        AS discount_pct,
  (oi.quantity * oi.unit_price * (1 - COALESCE(oi.discount_pct, 0) / 100))
                                      AS line_total,
  CURRENT_TIMESTAMP()                 AS _processed_at
FROM bronze.raw_orders o
JOIN bronze.raw_order_items oi ON o.order_id = oi.order_id
WHERE o.order_id IS NOT NULL;

-- Dimension: Suppliers
CREATE OR REPLACE TABLE silver.dim_suppliers AS
SELECT
  CAST(supplier_id AS BIGINT)         AS supplier_key,
  TRIM(company_name)                  AS supplier_name,
  LOWER(TRIM(contact_email))          AS contact_email,
  region                              AS supplier_region,
  CURRENT_TIMESTAMP()                 AS _processed_at
FROM bronze.raw_suppliers
WHERE supplier_id IS NOT NULL;`,
      sql_bigquery: `-- ═══════════════════════════════════════════
-- SILVER LAYER: Cleaned & Conformed (BigQuery)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS silver;

CREATE OR REPLACE TABLE silver.dim_customers AS
SELECT
  CAST(customer_id AS INT64) AS customer_key,
  TRIM(UPPER(full_name)) AS customer_name,
  LOWER(TRIM(email)) AS email_address,
  signup_date,
  COALESCE(segment, 'standard') AS customer_segment,
  COALESCE(country, 'UNKNOWN') AS country_code
FROM bronze.raw_customers
WHERE customer_id IS NOT NULL;

CREATE OR REPLACE TABLE silver.fact_order_lines AS
SELECT
  CAST(oi.item_id AS INT64) AS line_item_key,
  CAST(o.order_id AS INT64) AS order_key,
  CAST(o.customer_id AS INT64) AS customer_key,
  CAST(oi.product_id AS INT64) AS product_key,
  TIMESTAMP(o.order_date) AS order_timestamp,
  o.status AS order_status,
  oi.quantity,
  CAST(oi.unit_price AS NUMERIC) AS unit_price,
  (oi.quantity * oi.unit_price * (1 - COALESCE(oi.discount_pct, 0) / 100)) AS line_total
FROM bronze.raw_orders o
JOIN bronze.raw_order_items oi ON o.order_id = oi.order_id;`,
      sql_redshift: `-- SILVER LAYER: Cleaned & Conformed (Redshift)
CREATE SCHEMA IF NOT EXISTS silver;

CREATE TABLE silver.dim_customers AS
SELECT
  customer_id::BIGINT AS customer_key,
  UPPER(TRIM(full_name)) AS customer_name,
  LOWER(TRIM(email)) AS email_address,
  COALESCE(segment, 'standard') AS customer_segment
FROM bronze.raw_customers
WHERE customer_id IS NOT NULL;`,
      pyspark_databricks: `# ═══════════════════════════════════════════
# SILVER LAYER: Cleaned & Conformed (Databricks)
# Generated by OpenOntos
# ═══════════════════════════════════════════

from pyspark.sql.functions import (
    trim, upper, lower, coalesce, lit, col,
    current_timestamp, row_number, expr
)
from pyspark.sql.window import Window

spark = SparkSession.builder.appName("OpenOntos-Silver").getOrCreate()

# --- dim_customers ---
df_cust = spark.table("bronze.raw_customers")
w = Window.partitionBy("customer_id").orderBy(col("_ingested_at").desc())
df_dim_customers = (df_cust
    .filter(col("customer_id").isNotNull())
    .withColumn("_rn", row_number().over(w))
    .filter(col("_rn") == 1).drop("_rn")
    .select(
        col("customer_id").cast("bigint").alias("customer_key"),
        upper(trim(col("full_name"))).alias("customer_name"),
        lower(trim(col("email"))).alias("email_address"),
        col("signup_date"),
        coalesce(col("segment"), lit("standard")).alias("customer_segment"),
        coalesce(col("country"), lit("UNKNOWN")).alias("country_code"),
        current_timestamp().alias("_processed_at")
    ))
df_dim_customers.write.mode("overwrite").saveAsTable("silver.dim_customers")

# --- fact_order_lines ---
df_orders = spark.table("bronze.raw_orders")
df_items = spark.table("bronze.raw_order_items")
df_fact = (df_orders.join(df_items, "order_id")
    .select(
        col("item_id").cast("bigint").alias("line_item_key"),
        col("order_id").cast("bigint").alias("order_key"),
        col("customer_id").cast("bigint").alias("customer_key"),
        col("product_id").cast("bigint").alias("product_key"),
        col("order_date").cast("timestamp").alias("order_timestamp"),
        col("status").alias("order_status"),
        coalesce(col("channel"), lit("unknown")).alias("sales_channel"),
        col("quantity"),
        col("unit_price").cast("decimal(12,2)").alias("unit_price"),
        coalesce(col("discount_pct"), lit(0)).alias("discount_pct"),
        expr("quantity * unit_price * (1 - coalesce(discount_pct, 0) / 100)").alias("line_total"),
        current_timestamp().alias("_processed_at")
    ))
df_fact.write.mode("overwrite").saveAsTable("silver.fact_order_lines")

print("✓ Silver layer processing complete")`,
      pyspark_fabric: `# SILVER LAYER: Cleaned & Conformed (Microsoft Fabric)
from pyspark.sql.functions import trim, upper, lower, coalesce, lit, col, current_timestamp

spark = SparkSession.builder.getOrCreate()

df_cust = spark.table("bronze.raw_customers").filter(col("customer_id").isNotNull())
df_dim_customers = df_cust.select(
    col("customer_id").cast("bigint").alias("customer_key"),
    upper(trim(col("full_name"))).alias("customer_name"),
    lower(trim(col("email"))).alias("email_address"),
    coalesce(col("segment"), lit("standard")).alias("customer_segment")
)
df_dim_customers.write.mode("overwrite").format("delta").saveAsTable("silver.dim_customers")`,
    },
    gold: {
      sql_snowflake: `-- ═══════════════════════════════════════════
-- GOLD LAYER: Business Aggregates (Snowflake)
-- Generated by OpenOntos
-- ═══════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS gold;

-- Customer Lifetime Value
CREATE OR REPLACE TABLE gold.customer_lifetime_value AS
SELECT
  c.customer_key,
  c.customer_name,
  c.customer_segment,
  c.country_code,
  COUNT(DISTINCT f.order_key)               AS total_orders,
  SUM(f.line_total)                         AS lifetime_value,
  AVG(f.line_total)                         AS avg_order_value,
  MIN(f.order_timestamp)                    AS first_order_at,
  MAX(f.order_timestamp)                    AS last_order_at,
  DATEDIFF('day', MIN(f.order_timestamp),
    MAX(f.order_timestamp))                 AS tenure_days,
  CASE
    WHEN SUM(f.line_total) >= 5000 THEN 'High Value'
    WHEN SUM(f.line_total) >= 1000 THEN 'Medium Value'
    ELSE 'Low Value'
  END                                       AS value_tier,
  CURRENT_TIMESTAMP()                       AS _computed_at
FROM silver.dim_customers c
JOIN silver.fact_order_lines f ON c.customer_key = f.customer_key
GROUP BY c.customer_key, c.customer_name, c.customer_segment, c.country_code;

-- Product Performance
CREATE OR REPLACE TABLE gold.product_performance AS
SELECT
  p.product_key,
  p.product_name,
  p.product_category,
  p.product_subcategory,
  p.list_price,
  COUNT(DISTINCT f.order_key)               AS orders_containing,
  SUM(f.quantity)                           AS total_units_sold,
  SUM(f.line_total)                         AS total_revenue,
  AVG(f.discount_pct)                       AS avg_discount,
  CURRENT_TIMESTAMP()                       AS _computed_at
FROM silver.dim_products p
JOIN silver.fact_order_lines f ON p.product_key = f.product_key
GROUP BY p.product_key, p.product_name, p.product_category,
         p.product_subcategory, p.list_price;

-- Daily Sales Summary
CREATE OR REPLACE TABLE gold.daily_sales_summary AS
SELECT
  DATE_TRUNC('day', f.order_timestamp)      AS sale_date,
  f.sales_channel,
  COUNT(DISTINCT f.order_key)               AS order_count,
  COUNT(f.line_item_key)                    AS items_sold,
  SUM(f.line_total)                         AS gross_revenue,
  AVG(f.discount_pct)                       AS avg_discount_pct,
  CURRENT_TIMESTAMP()                       AS _computed_at
FROM silver.fact_order_lines f
GROUP BY 1, 2
ORDER BY 1 DESC;`,
      sql_bigquery: `-- GOLD LAYER: Business Aggregates (BigQuery)
CREATE SCHEMA IF NOT EXISTS gold;

CREATE OR REPLACE TABLE gold.customer_lifetime_value AS
SELECT
  c.customer_key,
  c.customer_name,
  c.customer_segment,
  COUNT(DISTINCT f.order_key) AS total_orders,
  SUM(f.line_total) AS lifetime_value,
  AVG(f.line_total) AS avg_order_value,
  MIN(f.order_timestamp) AS first_order_at,
  MAX(f.order_timestamp) AS last_order_at
FROM silver.dim_customers c
JOIN silver.fact_order_lines f ON c.customer_key = f.customer_key
GROUP BY 1, 2, 3;`,
      sql_redshift: `-- GOLD LAYER: Business Aggregates (Redshift)
CREATE TABLE gold.customer_lifetime_value AS
SELECT
  c.customer_key,
  c.customer_name,
  COUNT(DISTINCT f.order_key) AS total_orders,
  SUM(f.line_total) AS lifetime_value
FROM silver.dim_customers c
JOIN silver.fact_order_lines f ON c.customer_key = f.customer_key
GROUP BY 1, 2;`,
      pyspark_databricks: `# ═══════════════════════════════════════════
# GOLD LAYER: Business Aggregates (Databricks)
# Generated by OpenOntos
# ═══════════════════════════════════════════

from pyspark.sql.functions import (
    countDistinct, sum as spark_sum, avg, min, max,
    datediff, when, current_timestamp, date_trunc
)

spark = SparkSession.builder.appName("OpenOntos-Gold").getOrCreate()

df_customers = spark.table("silver.dim_customers")
df_fact = spark.table("silver.fact_order_lines")
df_products = spark.table("silver.dim_products")

# --- Customer Lifetime Value ---
df_clv = (df_customers.join(df_fact, "customer_key")
    .groupBy("customer_key", "customer_name", "customer_segment", "country_code")
    .agg(
        countDistinct("order_key").alias("total_orders"),
        spark_sum("line_total").alias("lifetime_value"),
        avg("line_total").alias("avg_order_value"),
        min("order_timestamp").alias("first_order_at"),
        max("order_timestamp").alias("last_order_at"),
    )
    .withColumn("value_tier",
        when(col("lifetime_value") >= 5000, "High Value")
        .when(col("lifetime_value") >= 1000, "Medium Value")
        .otherwise("Low Value"))
    .withColumn("_computed_at", current_timestamp()))
df_clv.write.mode("overwrite").saveAsTable("gold.customer_lifetime_value")

# --- Product Performance ---
df_prod_perf = (df_products.join(df_fact, "product_key")
    .groupBy("product_key", "product_name", "product_category")
    .agg(
        countDistinct("order_key").alias("orders_containing"),
        spark_sum("quantity").alias("total_units_sold"),
        spark_sum("line_total").alias("total_revenue"),
        avg("discount_pct").alias("avg_discount"),
    )
    .withColumn("_computed_at", current_timestamp()))
df_prod_perf.write.mode("overwrite").saveAsTable("gold.product_performance")

print("✓ Gold layer aggregation complete")`,
      pyspark_fabric: `# GOLD LAYER (Microsoft Fabric)
from pyspark.sql.functions import countDistinct, sum as spark_sum, avg, min, max

df_customers = spark.table("silver.dim_customers")
df_fact = spark.table("silver.fact_order_lines")

df_clv = (df_customers.join(df_fact, "customer_key")
    .groupBy("customer_key", "customer_name", "customer_segment")
    .agg(
        countDistinct("order_key").alias("total_orders"),
        spark_sum("line_total").alias("lifetime_value")))
df_clv.write.mode("overwrite").format("delta").saveAsTable("gold.customer_lifetime_value")`,
    },
  },
  customETL: [],
  deploy: {
    platform: '',
    readiness: [
      { check: 'Schema profiled', status: 'pass' },
      { check: 'Ontology defined', status: 'pass' },
      { check: 'Mappings approved', status: 'pending' },
      { check: 'ETL code generated', status: 'pass' },
      { check: 'Validations resolved', status: 'fail' },
      { check: 'Target platform selected', status: 'pending' },
    ],
    exported: false,
    platformConnections: [],
    deployRuns: [],
  },
  pipelineRuns: [
    {
      id: 'pr-1',
      name: 'Bronze Ingestion',
      platform: 'snowflake',
      layer: 'bronze',
      objectName: 'bronze_layer',
      status: 'completed',
      startedAt: '2025-04-15T08:00:00Z',
      completedAt: '2025-04-15T08:03:22Z',
      duration: 202,
      rowsProcessed: 97505,
      logs: ['[08:00:00] Starting bronze ingestion...', '[08:01:10] raw_orders: 24850 rows loaded', '[08:02:05] raw_customers: 8720 rows loaded', '[08:02:45] raw_products: 1450 rows loaded', '[08:03:10] raw_order_items: 62400 rows loaded', '[08:03:22] raw_suppliers: 85 rows loaded', '[08:03:22] ✓ Bronze layer complete'],
    },
    {
      id: 'pr-2',
      name: 'Silver Transform',
      platform: 'snowflake',
      layer: 'silver',
      objectName: 'silver_layer',
      status: 'completed',
      startedAt: '2025-04-15T08:05:00Z',
      completedAt: '2025-04-15T08:09:15Z',
      duration: 255,
      rowsProcessed: 96200,
      logs: ['[08:05:00] Starting silver transforms...', '[08:07:00] dim_customers created: 8720 rows', '[08:08:30] fact_orders created: 24850 rows', '[08:09:15] ✓ Silver layer complete'],
    },
    {
      id: 'pr-3',
      name: 'Gold Aggregation',
      platform: 'snowflake',
      layer: 'gold',
      objectName: 'gold_layer',
      status: 'failed',
      startedAt: '2025-04-15T08:10:00Z',
      completedAt: '2025-04-15T08:11:05Z',
      duration: 65,
      errorMessage: 'ERROR: column "currency" ambiguous in aggregation query at line 42',
      logs: ['[08:10:00] Starting gold aggregations...', '[08:10:30] revenue_daily started...', '[08:11:05] ✗ ERROR: column "currency" ambiguous'],
    },
  ],
  pipelineSchedules: [
    { id: 'ps-1', name: 'Nightly Full Refresh', platform: 'snowflake', layers: ['bronze', 'silver', 'gold'], cron: '0 2 * * *', enabled: true, lastRun: '2025-04-15T02:00:00Z', nextRun: '2025-04-16T02:00:00Z' },
  ],
  activity: [
    { id: 'a1', action: 'Project created', module: 'profile', timestamp: '2025-04-10T10:00:00Z' },
    { id: 'a2', action: '5 source tables profiled', module: 'profile', timestamp: '2025-04-10T10:05:00Z' },
    { id: 'a3', action: '5 entities suggested by AI', module: 'ontology', timestamp: '2025-04-11T14:00:00Z' },
    { id: 'a4', action: '10 source-to-target mappings generated', module: 'mapping', timestamp: '2025-04-12T09:30:00Z' },
    { id: 'a5', action: 'Bronze/Silver/Gold pipelines generated', module: 'etl', timestamp: '2025-04-13T16:00:00Z' },
    { id: 'a6', action: '6 validation issues identified', module: 'monitor', timestamp: '2025-04-14T11:00:00Z' },
  ],
};
