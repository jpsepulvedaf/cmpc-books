import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ApiException } from '../../common/errors/api.exception';
import { AuthUser } from '../../common/types/auth-user';
import { AuditRecordInput, AuditService } from './audit.service';

/** One route mapping: HTTP method + path pattern → audit action/entity. */
interface AuditRule {
  method: string;
  pattern: RegExp;
  action: string;
  entityType: string;
  /** entityId comes from `request.params.id` when the route has an :id. */
  usesId?: boolean;
  /** Extra sanitized metadata merged into `details` (never user input). */
  staticDetails?: Record<string, unknown>;
}

/**
 * Routes that ARE audited.
 *
 * Deliberately EXCLUDED (documented decision — this is a technical test, the
 * requirement is auditing of WRITE operations):
 *  - GET /api/health, GET /api/docs/* → infrastructure, not business
 *  - GET /api/authors, /publishers, /genres → read-only catalogs
 *  - GET /api/books, GET /api/books/:id → consultation reads
 *  - GET /api/audit, GET /api/audit/stats → the trail reading itself would
 *    flood the table with its own queries (noise, no operational value)
 *
 * INCLUDED (everything that writes or matters operationally):
 *  - POST /api/auth/login → LOGIN/AUTH (success AND failure, see below)
 *  - POST/PATCH/DELETE /api/books[/:id][/image] → CREATE/UPDATE/DELETE/BOOK
 *  - POST/PATCH/DELETE /api/users[/:id] → CREATE/UPDATE/DELETE/USER
 *  - GET /api/books/export → EXPORT/BOOK (data exfiltration-worth tracking)
 *
 * `usesId` routes read the id from `request.params.id` (string), so `entityId`
 * is the same value the API contract exposes.
 */
const AUDIT_RULES: AuditRule[] = [
  { method: 'POST', pattern: /^\/api\/auth\/login$/, action: 'LOGIN', entityType: 'AUTH' },
  { method: 'POST', pattern: /^\/api\/books$/, action: 'CREATE', entityType: 'BOOK' },
  {
    method: 'PATCH',
    pattern: /^\/api\/books\/\d+$/,
    action: 'UPDATE',
    entityType: 'BOOK',
    usesId: true,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/books\/\d+$/,
    action: 'DELETE',
    entityType: 'BOOK',
    usesId: true,
  },
  {
    method: 'POST',
    pattern: /^\/api\/books\/\d+\/image$/,
    action: 'UPDATE',
    entityType: 'BOOK',
    usesId: true,
    staticDetails: { image: true },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/books\/\d+\/image$/,
    action: 'UPDATE',
    entityType: 'BOOK',
    usesId: true,
    staticDetails: { image: false },
  },
  { method: 'POST', pattern: /^\/api\/users$/, action: 'CREATE', entityType: 'USER' },
  {
    method: 'PATCH',
    pattern: /^\/api\/users\/\d+$/,
    action: 'UPDATE',
    entityType: 'USER',
    usesId: true,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/users\/\d+$/,
    action: 'DELETE',
    entityType: 'USER',
    usesId: true,
  },
  {
    method: 'GET',
    pattern: /^\/api\/books\/export$/,
    action: 'EXPORT',
    entityType: 'BOOK',
    staticDetails: { format: 'csv' },
  },
];

/**
 * Global audit interceptor. It runs for EVERY request (registered as
 * APP_INTERCEPTOR, like ResponseInterceptor) and decides per-route whether the
 * operation is worth recording in AuditLog.
 *
 * Transparency guarantees (requirement §4):
 *  - matched routes pass the response through untouched (`tap` only — data and
 *    status code are never modified),
 *  - the audit write is FIRE-AND-FORGET: `record()` is not awaited in the
 *    response path, so a slow/failing DB can never delay or break the reply,
 *  - on handler errors the error is re-thrown after recording, so the global
 *    HttpExceptionFilter still produces the `{ok:false,...}` envelope.
 *
 * Security/sanitization:
 *  - `request.user` is read ONLY from the principal set by JwtAuthGuard,
 *  - the login body is read ONLY to extract `email` (never `password`),
 *  - `details` is built exclusively from static constants + success flags;
 *    no request body, headers or tokens ever land in it.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request: Request = context.switchToHttp().getRequest();
    const rule = this.matchRule(request);

    // Untracked route or unknown path → pass through completely transparent.
    if (!rule) {
      return next.handle();
    }

    const entry = this.buildEntry(request, rule);

    return next.handle().pipe(
      tap((data) => {
        // Success path: record after the handler resolved, without awaiting.
        const withEntityId = this.applyCreatedId(entry, data);
        this.fireAndForget(withEntityId, { ...rule.staticDetails, success: true });
      }),
      catchError((error: unknown) => {
        // Failure path: the operation was ATTEMPTED, still worth recording.
        this.fireAndForget(entry, this.failureDetails(rule, error));
        // Re-throw: the global exception filter must still shape the envelope.
        return throwError(() => error);
      }),
    );
  }

  /**
   * For create operations (POST /api/books, POST /api/users) the id is
   * server-generated, so it exists only in the handler's response. When the
   * returned payload carries a top-level `id`, promote it to entityId so the
   * CREATE row references the created entity like every other write does.
   */
  private applyCreatedId(
    entry: AuditRecordInput,
    data: unknown,
  ): AuditRecordInput {
    if (entry.entityId !== undefined || data === null || typeof data !== 'object') {
      return entry;
    }
    const id = (data as { id?: unknown }).id;
    if (typeof id === 'number' || typeof id === 'string') {
      return { ...entry, entityId: String(id) };
    }
    return entry;
  }

  /** Sanitized failure metadata: code when available, never the error itself. */
  private failureDetails(
    rule: AuditRule,
    error: unknown,
  ): Record<string, unknown> {
    const isLogin = rule.action === 'LOGIN';
    const code = error instanceof ApiException ? error.code : undefined;
    // LOGIN failure carries `reason` (spec literal: reason: INVALID_CREDENTIALS);
    // every other failed operation records `errorCode` when one exists.
    return isLogin
      ? { success: false, reason: code ?? 'ERROR' }
      : { success: false, ...(code ? { errorCode: code } : {}) };
  }

  private matchRule(request: Request): AuditRule | undefined {
    const method = request.method.toUpperCase();
    const path = request.path ?? request.url?.split('?')[0] ?? '';
    return AUDIT_RULES.find((rule) => rule.method === method && rule.pattern.test(path));
  }

  private buildEntry(request: Request, rule: AuditRule): AuditRecordInput {
    const user = (request as Request & { user?: AuthUser }).user;
    const isLogin = rule.action === 'LOGIN';

    // Login has no principal yet: the user is identified by the attempted
    // email (the ONLY field read from the body) and role is a placeholder.
    // userId stays null — the row is linked to whoever logs in via userName.
    if (isLogin) {
      const body = request.body as { email?: unknown } | undefined;
      const email =
        body && typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : undefined;
      return {
        userName: email,
        userRole: '-',
        action: rule.action,
        entityType: rule.entityType,
        method: request.method,
        path: request.path,
        ipAddress: this.resolveIp(request),
      };
    }

    return {
      userId: user?.sub,
      userName: user?.email,
      userRole: user?.role ?? '-',
      action: rule.action,
      entityType: rule.entityType,
      entityId: rule.usesId ? String(request.params?.id ?? '') : undefined,
      method: request.method,
      path: request.path,
      ipAddress: this.resolveIp(request),
    };
  }

  /**
   * IP resolution, documented choice: `request.ip` (Express) — which already
   * honors the `trust proxy` setting if ever enabled — falling back to the raw
   * socket peer. X-Forwarded-For is NOT read directly: this app does not
   * enable `trust proxy`, so blindly trusting that header would let any client
   * spoof the logged origin. In local dev the value is the loopback `::1`.
   */
  private resolveIp(request: Request): string | undefined {
    const expressIp = request.ip;
    if (expressIp && expressIp !== 'unknown') return expressIp;
    const socket = (request as Request & { socket?: { remoteAddress?: unknown } }).socket;
    const remote = socket?.remoteAddress;
    return typeof remote === 'string' && remote.length > 0 ? remote : undefined;
  }

  /** Fire-and-forget: never awaited, never blocks the response. */
  private fireAndForget(entry: AuditRecordInput, details: Record<string, unknown>): void {
    void this.audit.record({ ...entry, details }).catch(() => {
      // Unreachable in practice (record() is fail-tolerant internally), but a
      // final safety net so a stray rejection can never crash the process.
    });
  }
}