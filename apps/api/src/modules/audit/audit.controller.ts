import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

/**
 * ADMIN-only read access to the audit trail. The trail itself is written by
 * the global AuditInterceptor; this controller only queries the persisted
 * rows. `details` is returned as stored — by construction it NEVER contains
 * secrets (passwords, tokens, headers), see AuditInterceptor sanitization.
 *
 * Responses use the global `{ok:true,data}` envelope via ResponseInterceptor.
 */
@ApiTags('audit')
@ApiBearerAuth('JWT')
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Paginated audit trail (ADMIN). Optional search + createdAt range.',
  })
  list(@Query() query: ListAuditQueryDto) {
    return this.auditService.list(query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Audit summary (ADMIN): total, counts by action and by entityType.',
  })
  stats() {
    return this.auditService.stats();
  }
}