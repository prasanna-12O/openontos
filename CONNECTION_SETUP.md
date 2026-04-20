# Data Source Connection Setup Guide

## Overview
This guide explains how to configure environment variables for all supported data source connectors.

## ❌ Current Connection Issues

### Missing Environment Variables
The following environment variables are **required** but **not configured** in your Supabase project:

```bash
# Required for all cloud warehouse connectors
LOVABLE_API_KEY=your_lovable_api_key_here

# Required for specific connectors  
SNOWFLAKE_API_KEY=your_snowflake_connector_key
DATABRICKS_API_KEY=your_databricks_connector_key  
BIGQUERY_API_KEY=your_bigquery_connector_key
FABRIC_API_KEY=your_fabric_connector_key
AWS_S3_API_KEY=your_s3_connector_key
```

## ✅ Supported Data Sources

| Data Source | Status | Environment Variables Required |
|-------------|--------|-------------------------------|
| PostgreSQL | ✅ Working | None (direct connection) |
| REST API | ✅ Working | None (direct connection) |
| Azure Blob | ✅ Working | None (direct connection) |
| CSV Files | ✅ Working | None (local files) |
| Snowflake | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `SNOWFLAKE_API_KEY` |
| Databricks | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `DATABRICKS_API_KEY` |
| BigQuery | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `BIGQUERY_API_KEY` |
| Fabric Lakehouse | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `FABRIC_API_KEY` |
| Fabric Warehouse | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `FABRIC_API_KEY` |
| AWS S3 | ❌ **Missing Keys** | `LOVABLE_API_KEY`, `AWS_S3_API_KEY` |

## 🔧 How to Fix Connection Issues

### Step 1: Configure Supabase Environment Variables
1. Go to your **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Add the following **Environment Variables**:

```bash
# Core API Key (required for all cloud connectors)
LOVABLE_API_KEY=your_lovable_api_key

# Individual Connector Keys
SNOWFLAKE_API_KEY=your_snowflake_key
DATABRICKS_API_KEY=your_databricks_key  
BIGQUERY_API_KEY=your_bigquery_key
FABRIC_API_KEY=your_fabric_key
AWS_S3_API_KEY=your_s3_key
```

### Step 2: Get Connector Keys from Lovable Platform
1. **Sign up/Login** to the [Lovable Connector Platform](https://connector-gateway.lovable.dev)
2. **Connect each data source** you want to use:
   - Snowflake → Get `SNOWFLAKE_API_KEY`
   - Databricks → Get `DATABRICKS_API_KEY`  
   - BigQuery → Get `BIGQUERY_API_KEY`
   - Microsoft Fabric → Get `FABRIC_API_KEY`
   - AWS S3 → Get `AWS_S3_API_KEY`
3. **Copy the API keys** to your Supabase environment variables

### Step 3: Restart Edge Functions
After adding environment variables:
1. **Redeploy** your Supabase Edge Functions
2. **Test connections** in your application

## 📋 Connection Parameters by Data Source

### Microsoft Fabric Lakehouse
```json
{
  "sourceType": "fabric_lakehouse",
  "connectionParams": {
    "auth_type": "sql_login", // or "entra_id"
    "workspace_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "lakehouse_name": "my_lakehouse", 
    "sql_endpoint": "xxx.datawarehouse.fabric.microsoft.com",
    // For SQL Login:
    "username": "sql_user",
    "password": "sql_password",
    // For Entra ID:
    "tenant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", 
    "client_secret": "client_secret_value"
  }
}
```

### Microsoft Fabric Warehouse  
```json
{
  "sourceType": "fabric_warehouse",
  "connectionParams": {
    "auth_type": "sql_login", // or "entra_id"
    "workspace_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "warehouse_name": "my_warehouse",
    "sql_endpoint": "xxx.datawarehouse.fabric.microsoft.com",
    // Same auth options as Lakehouse...
  }
}
```

### Snowflake
```json
{
  "sourceType": "snowflake", 
  "connectionParams": {
    "account": "your-account.snowflakecomputing.com",
    "warehouse": "COMPUTE_WH",
    "database": "DATABASE_NAME", 
    "schema": "PUBLIC",
    "username": "username",
    "password": "password"
  }
}
```

### Databricks
```json
{
  "sourceType": "databricks",
  "connectionParams": {
    "hostname": "your-workspace.cloud.databricks.com",
    "warehouse_id": "warehouse_id_here", // or "http_path"
    "schema": "default",
    "username": "username",
    "password": "password"
  }
}
```

## 🚨 Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Databricks connector not linked" | Missing `DATABRICKS_API_KEY` | Add environment variable |
| "Snowflake connector not linked" | Missing `SNOWFLAKE_API_KEY` | Add environment variable |
| "Fabric connector not linked" | Missing `FABRIC_API_KEY` | Add environment variable |
| "HTTP 401/403" | Invalid credentials | Check connection parameters |
| "Workspace/Database not found" | Wrong IDs/names | Verify resource names |

## 🧪 Testing Connections

Once you've configured the environment variables, test your connections:

1. **Go to Data Sources** in your application
2. **Add a new source** → Select your data source type
3. **Fill in connection parameters** 
4. **Click "Test Connection"**
5. **Verify** you see "✅ Connected" with discovered tables

## ⚡ Quick Fix Checklist

- [ ] All required environment variables added to Supabase
- [ ] Connector keys obtained from Lovable platform  
- [ ] Edge Functions redeployed after adding variables
- [ ] Connection parameters filled correctly
- [ ] Network access allowed (firewalls, VPNs)
- [ ] Resource names and IDs are correct

If connections still fail after following this guide, check the browser console for detailed error messages.