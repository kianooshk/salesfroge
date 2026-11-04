import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { andWhere } from '../common/data';

const API_KEY = /^[a-z][a-z0-9_]*$/;
const API_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ownerSelect = { select: { id: true, firstName: true, lastName: true, avatarColor: true, email: true } };

function matches(record: any, filters: any[]) {
  return filters.every((filter) => {
    const value = record[filter.field] ?? record.values?.[filter.field];
    const expected = filter.value;
    switch (filter.op) {
      case 'eq':
        return String(value ?? '') === String(expected ?? '');
      case 'neq':
        return String(value ?? '') !== String(expected ?? '');
      case 'contains':
        return String(value ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
      case 'gt':
        return Number(value) > Number(expected);
      case 'lt':
        return Number(value) < Number(expected);
      default:
        return true;
    }
  });
}

@Injectable()
export class CustomService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  listObjects() {
    return this.prisma.customObject.findMany({ include: { fields: { orderBy: { order: 'asc' } } }, orderBy: { label: 'asc' } });
  }

  async createObject(input: any) {
    const apiKey = String(input.apiKey || '').trim();
    if (!API_KEY.test(apiKey)) throw new BadRequestException('apiKey must be lowercase letters, numbers, or underscores');
    if (!input.label) throw new BadRequestException('label is required');
    return this.prisma.customObject.create({
      data: {
        label: input.label,
        pluralLabel: input.pluralLabel || `${input.label}s`,
        apiKey,
        description: input.description || null,
        icon: input.icon || 'custom',
      },
    });
  }

  async updateObject(id: string, input: any) {
    const data: any = {};
    for (const key of ['label', 'pluralLabel', 'description', 'icon']) if (input[key] !== undefined) data[key] = input[key];
    return this.prisma.customObject.update({ where: { id }, data });
  }

  async removeObject(id: string) {
    await this.prisma.customObject.delete({ where: { id } });
    return { success: true };
  }

  listFields(objectType?: string) {
    return this.prisma.customField.findMany({
      where: objectType ? { objectType } : undefined,
      orderBy: { order: 'asc' },
    });
  }

  async createField(input: any) {
    if (!input.label || !input.apiName || !input.type) throw new BadRequestException('label, apiName and type are required');
    if (!API_NAME.test(input.apiName)) throw new BadRequestException('apiName must start with a letter');
    let objectType = input.objectType as string;
    let customObjectId = input.customObjectId || null;
    if (!objectType && input.apiKey) {
      const obj = await this.prisma.customObject.findUnique({ where: { apiKey: input.apiKey } });
      if (!obj) throw new NotFoundException('Custom object not found');
      objectType = `Custom:${obj.apiKey}`;
      customObjectId = obj.id;
    }
    if (!objectType) throw new BadRequestException('objectType is required');
    return this.prisma.customField.create({
      data: {
        objectType,
        customObjectId,
        label: input.label,
        apiName: input.apiName,
        type: input.type,
        options: input.options || null,
        required: !!input.required,
        order: input.order || 0,
      },
    });
  }

  async removeField(id: string) {
    await this.prisma.customField.delete({ where: { id } });
    return { success: true };
  }

  private async objectByKey(apiKey: string) {
    const obj = await this.prisma.customObject.findUnique({ where: { apiKey }, include: { fields: true } });
    if (!obj) throw new NotFoundException('Custom object not found');
    return obj;
  }

  private shape(record: any) {
    return { ...record, ...(record.values || {}) };
  }

  async listRecords(user: AuthUser, apiKey: string, query: any) {
    const obj = await this.objectByKey(apiKey);
    const scope = await this.sharing.readScope(user, 'CustomRecord');
    const where = andWhere(
      scope,
      { customObjectId: obj.id },
      query.search ? { name: { contains: String(query.search), mode: 'insensitive' } } : {},
    );
    let records = await this.prisma.customRecord.findMany({
      where,
      include: { owner: ownerSelect },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    let filters: any[] = [];
    if (query.filters) {
      try { filters = JSON.parse(query.filters); } catch { filters = []; }
    }
    if (filters.length) records = records.filter((record) => matches(this.shape(record), filters));
    return records.map((record) => this.shape(record));
  }

  async getRecord(user: AuthUser, apiKey: string, id: string) {
    const obj = await this.objectByKey(apiKey);
    const scope = await this.sharing.readScope(user, 'CustomRecord');
    const record = await this.prisma.customRecord.findFirst({
      where: andWhere({ id, customObjectId: obj.id }, scope),
      include: { owner: ownerSelect, customObject: { include: { fields: true } } },
    });
    if (!record) throw new NotFoundException('Record not found');
    return this.shape(record);
  }

  async createRecord(user: AuthUser, apiKey: string, input: any) {
    const obj = await this.objectByKey(apiKey);
    if (!input.name) throw new BadRequestException('name is required');
    const values: Record<string, any> = { ...(input.values || {}) };
    for (const field of obj.fields) {
      if (input[field.apiName] !== undefined) values[field.apiName] = input[field.apiName];
    }
    const record = await this.prisma.customRecord.create({
      data: {
        customObjectId: obj.id,
        name: input.name,
        values,
        ownerId: input.ownerId || user.id,
      },
      include: { owner: ownerSelect },
    });
    return this.shape(record);
  }

  async updateRecord(user: AuthUser, apiKey: string, id: string, input: any) {
    const existing = await this.getRecord(user, apiKey, id);
    const obj = await this.objectByKey(apiKey);
    const values = { ...(existing.values || {}) };
    for (const field of obj.fields) {
      if (input[field.apiName] !== undefined) values[field.apiName] = input[field.apiName];
    }
    if (input.values) Object.assign(values, input.values);
    const record = await this.prisma.customRecord.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        ownerId: input.ownerId || existing.ownerId,
        values,
      },
      include: { owner: ownerSelect },
    });
    return this.shape(record);
  }

  async removeRecord(user: AuthUser, apiKey: string, id: string) {
    await this.getRecord(user, apiKey, id);
    await this.prisma.customRecord.delete({ where: { id } });
    return { success: true };
  }
}

@Controller('custom-objects')
export class CustomObjectsController {
  constructor(private custom: CustomService) {}

  @Get() list() { return this.custom.listObjects(); }
  @Post() create(@Body() body: any) { return this.custom.createObject(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.custom.updateObject(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.custom.removeObject(id); }

  @Get(':apiKey/records')
  listRecords(@CurrentUser() user: AuthUser, @Param('apiKey') apiKey: string, @Query() query: any) {
    return this.custom.listRecords(user, apiKey, query);
  }

  @Post(':apiKey/records')
  createRecord(@CurrentUser() user: AuthUser, @Param('apiKey') apiKey: string, @Body() body: any) {
    return this.custom.createRecord(user, apiKey, body);
  }

  @Get(':apiKey/records/:id')
  getRecord(@CurrentUser() user: AuthUser, @Param('apiKey') apiKey: string, @Param('id') id: string) {
    return this.custom.getRecord(user, apiKey, id);
  }

  @Patch(':apiKey/records/:id')
  updateRecord(@CurrentUser() user: AuthUser, @Param('apiKey') apiKey: string, @Param('id') id: string, @Body() body: any) {
    return this.custom.updateRecord(user, apiKey, id, body);
  }

  @Delete(':apiKey/records/:id')
  removeRecord(@CurrentUser() user: AuthUser, @Param('apiKey') apiKey: string, @Param('id') id: string) {
    return this.custom.removeRecord(user, apiKey, id);
  }
}

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private custom: CustomService) {}

  @Get() list(@Query('objectType') objectType?: string) { return this.custom.listFields(objectType); }
  @Post() create(@Body() body: any) { return this.custom.createField(body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.custom.removeField(id); }
}

@Module({
  controllers: [CustomObjectsController, CustomFieldsController],
  providers: [CustomService],
})
export class CustomModule {}
