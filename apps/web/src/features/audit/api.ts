// Audit endpoints (admin only).

import { api, unwrap } from '../../lib/api';
import type { AuditItem, AuditStats, Paged } from '../../lib/types';

export function listAudit(params: { page?: number; pageSize?: number; search?: string }): Promise<Paged<AuditItem>> {
  const query: Record<string, unknown> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  if (params.search) query.search = params.search;
  return unwrap<Paged<AuditItem>>(api.get('/audit', { params: query }));
}

export function getAuditStats(): Promise<AuditStats> {
  return unwrap<AuditStats>(api.get('/audit/stats'));
}