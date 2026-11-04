import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, Post, Query, Res } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CrudService } from '../common/crud.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { OBJECT_BY_API, ObjectConfig } from '../metadata/object-meta';
import { applyMapping, suggestMapping } from './csv.util';

function parseCsv(csv: string) {
  if (!csv?.trim()) throw new BadRequestException('CSV content is empty');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

@Injectable()
export class ImportService {
  constructor(private crud: CrudService, private prisma: PrismaService) {}

  preview(objectType: string, csv: string) {
    const config = this.config(objectType);
    const { headers, rows } = parseCsv(csv);
    return {
      headers,
      sample: rows.slice(0, 5),
      rowCount: rows.length,
      fields: config.fields.filter((field) => field.name !== 'ownerId').concat([
        { name: 'ownerEmail', label: 'Owner Email', type: 'email' },
        { name: 'accountName', label: 'Account Name', type: 'text' },
      ]),
      mapping: suggestMapping(headers, config.fields),
    };
  }

  private config(objectType: string): ObjectConfig {
    const config = OBJECT_BY_API[objectType];
    if (!config) throw new BadRequestException(`Cannot import ${objectType}`);
    return config;
  }

  async importCsv(user: AuthUser, objectType: string, mapping: Record<string, string>, csv: string) {
    const config = this.config(objectType);
    const { rows } = parseCsv(csv);
    const users = await this.prisma.user.findMany({ select: { id: true, email: true } });
    const byEmail = new Map(users.map((item) => [item.email.toLowerCase(), item.id]));
    let created = 0;
    const errors: { row: number; message: string }[] = [];
    for (let index = 0; index < rows.length; index++) {
      try {
        const mapped = applyMapping(rows[index], mapping);
        if (mapped.ownerEmail) {
          const ownerId = byEmail.get(String(mapped.ownerEmail).toLowerCase());
          if (ownerId) mapped.ownerId = ownerId;
          delete mapped.ownerEmail;
        }
        if (mapped.accountName && (objectType === 'Contact' || objectType === 'Opportunity' || objectType === 'Case')) {
          const name = String(mapped.accountName).trim();
          if (name) {
            let account = await this.prisma.account.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
            if (!account) {
              account = await this.prisma.account.create({ data: { name, ownerId: user.id } });
            }
            mapped.accountId = account.id;
          }
          delete mapped.accountName;
        }
        await this.crud.create(user, config, mapped);
        created += 1;
      } catch (error: any) {
        errors.push({ row: index + 2, message: error?.message || 'Could not import row' });
      }
    }
    return { created, failed: errors.length, errors: errors.slice(0, 25) };
  }

  async exportCsv(user: AuthUser, objectType: string, query: any) {
    const config = this.config(objectType);
    const rows = await this.crud.list(user, config, { ...query, take: 500 });
    const columns = config.fields.map((field) => field.name);
    const flat = rows.map((row: any) => {
      const out: Record<string, any> = {};
      for (const column of columns) out[column] = row[column] ?? '';
      if (row.owner?.email) out.ownerEmail = row.owner.email;
      return out;
    });
    return stringify(flat, { header: true, columns: [...columns.filter((c) => c !== 'ownerId'), 'ownerEmail'] });
  }
}

@Controller('import')
export class ImportController {
  constructor(private imports: ImportService) {}

  @Post('preview')
  preview(@Body() body: any) {
    return this.imports.preview(body.objectType, body.csv);
  }

  @Post()
  run(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.imports.importCsv(user, body.objectType, body.mapping || {}, body.csv);
  }
}

@Controller('export')
export class ExportController {
  constructor(private imports: ImportService) {}

  @Get(':objectType')
  async export(
    @CurrentUser() user: AuthUser,
    @Param('objectType') objectType: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const csv = await this.imports.exportCsv(user, objectType, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${objectType.toLowerCase()}.csv"`);
    res.send(csv);
  }
}

@Module({
  controllers: [ImportController, ExportController],
  providers: [ImportService],
})
export class ImportModule {}
