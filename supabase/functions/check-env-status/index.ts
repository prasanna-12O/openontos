// Quick diagnostic tool to check environment variable status
// Run this in Supabase Edge Functions to see what's configured

import { corsHeaders } from '../test-source-connection/index.ts';

interface EnvStatus {
  variable: string;
  configured: boolean;
  required_for: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const envVars: EnvStatus[] = [
      {
        variable: 'LOVABLE_API_KEY',
        configured: !!Deno.env.get('LOVABLE_API_KEY'),
        required_for: ['All cloud connectors (Snowflake, Databricks, BigQuery, Fabric, S3)']
      },
      {
        variable: 'SNOWFLAKE_API_KEY', 
        configured: !!Deno.env.get('SNOWFLAKE_API_KEY'),
        required_for: ['Snowflake connections']
      },
      {
        variable: 'DATABRICKS_API_KEY',
        configured: !!Deno.env.get('DATABRICKS_API_KEY'), 
        required_for: ['Databricks connections']
      },
      {
        variable: 'BIGQUERY_API_KEY',
        configured: !!Deno.env.get('BIGQUERY_API_KEY'),
        required_for: ['BigQuery connections']
      },
      {
        variable: 'FABRIC_API_KEY',
        configured: !!Deno.env.get('FABRIC_API_KEY'),
        required_for: ['Microsoft Fabric Lakehouse & Warehouse connections']
      },
      {
        variable: 'AWS_S3_API_KEY', 
        configured: !!Deno.env.get('AWS_S3_API_KEY'),
        required_for: ['AWS S3 connections']
      },
      {
        variable: 'SUPABASE_URL',
        configured: !!Deno.env.get('SUPABASE_URL'),
        required_for: ['Supabase functions (should be auto-configured)'] 
      },
      {
        variable: 'SUPABASE_SERVICE_ROLE_KEY',
        configured: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        required_for: ['Supabase functions (should be auto-configured)']
      }
    ];
    
    const missing = envVars.filter(v => !v.configured);
    const configured = envVars.filter(v => v.configured);
    
    const result = {
      status: missing.length === 0 ? 'all_configured' : 'missing_variables',
      total_checked: envVars.length,
      configured_count: configured.length,
      missing_count: missing.length,
      configured_variables: configured.map(v => ({ variable: v.variable, required_for: v.required_for })),
      missing_variables: missing.map(v => ({ variable: v.variable, required_for: v.required_for })),
      next_steps: missing.length > 0 ? [
        'Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables',
        'Add the missing variables listed above',  
        'Redeploy Edge Functions',
        'Test your data source connections'
      ] : [
        'All environment variables configured!',
        'Test your data source connections to verify they work'
      ]
    };
    
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : String(e) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});