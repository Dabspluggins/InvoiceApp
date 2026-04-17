import { createClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.deleted'
  | 'invoice.sent'
  | 'invoice.marked_paid'
  | 'invoice.reminded'
  | 'estimate.created'
  | 'estimate.updated'
  | 'estimate.deleted'
  | 'estimate.sent'
  | 'profile.updated'
  | 'password.changed'
  | 'email.changed'
  | 'mfa.enabled'
  | 'mfa.disabled'
  | 'auth.suspicious_login'
  | 'auth.secured'
  | 'device.trusted'
  | 'device.untrusted'

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  userId: string
  action: AuditAction
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await adminClient.from('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  })
}
