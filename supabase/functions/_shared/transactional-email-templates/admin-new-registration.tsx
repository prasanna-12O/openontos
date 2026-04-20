/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'OpenOntos'

interface AdminNewRegistrationProps {
  name?: string
  email?: string
  organization?: string
  role?: string
  registeredAt?: string
}

const AdminNewRegistrationEmail = ({
  name,
  email,
  organization,
  role,
  registeredAt,
}: AdminNewRegistrationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New {SITE_NAME} registration: {name || email || 'a user'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New user registration</Heading>
        <Text style={text}>
          A new user just verified their email and registered on {SITE_NAME}.
        </Text>
        <Section style={card}>
          <Row label="Name" value={name || '—'} />
          <Row label="Email" value={email || '—'} />
          <Row label="Organization" value={organization || '(not provided)'} />
          <Row label="Role" value={role || '(not provided)'} />
          <Row label="Registered at" value={registeredAt || '—'} />
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          You are receiving this because you are the configured admin for {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Section style={{ marginBottom: '8px' }}>
    <Text style={rowLabel}>{label}</Text>
    <Text style={rowValue}>{value}</Text>
  </Section>
)

export const template = {
  component: AdminNewRegistrationEmail,
  subject: (data: Record<string, any>) =>
    `New ${SITE_NAME} registration: ${data?.name || data?.email || 'user'}`,
  displayName: 'Admin — new user registration',
  previewData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    organization: 'Acme Corp',
    role: 'Data Engineer',
    registeredAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0b1220',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px 18px',
}
const rowLabel = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: '#64748b',
  margin: '0 0 2px',
  fontWeight: 600,
}
const rowValue = {
  fontSize: '14px',
  color: '#0f172a',
  margin: '0',
  fontFamily: "'JetBrains Mono', monospace",
}
const hr = { borderColor: '#e2e8f0', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '0' }
