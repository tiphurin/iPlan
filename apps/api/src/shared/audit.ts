import { type Executor, schema } from '@iplan/db'

export interface AuditEntry {
  actorId: string | null
  action: string
  entityType: string
  entityId?: string
  data?: Record<string, unknown>
}

export interface AuditLog {
  record(entry: AuditEntry, executor?: Executor): Promise<void>
}

/** Append-only log of who changed what; read by the admin dashboard. */
export class AuditRepository implements AuditLog {
  constructor(private readonly db: Executor) {}

  async record(entry: AuditEntry, executor: Executor = this.db): Promise<void> {
    await executor.insert(schema.auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      data: entry.data ?? null,
    })
  }
}
