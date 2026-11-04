import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from './sharing.service';
import { FiltersService } from './filters.service';
import { NotificationsService } from './notifications.service';
import { AuthUser } from './decorators';
import { andWhere, buildFilterWhere, prepareData } from './data';
import { ObjectConfig } from '../metadata/object-meta';

@Injectable()
export class CrudService {
  constructor(
    private prisma: PrismaService,
    private sharing: SharingService,
    private filters: FiltersService,
    private notifications: NotificationsService,
  ) {}

  model(config: ObjectConfig) {
    return (this.prisma as any)[config.model];
  }

  private searchWhere(config: ObjectConfig, search?: string) {
    if (!search?.trim() || !config.searchFields?.length) return {};
    return {
      OR: config.searchFields.map((field) => ({
        [field]: { contains: search.trim(), mode: 'insensitive' },
      })),
    };
  }

  async list(user: AuthUser, config: ObjectConfig, query: any = {}) {
    const scope = await this.sharing.readScope(user, config.objectType);
    const saved = buildFilterWhere(await this.filters.fromQuery(query));
    const quick = (config.quickFilters || [])
      .filter((key) => query[key])
      .map((key) => ({ [key]: query[key] }));
    const related =
      config.allowRelatedFilter && query.relatedType && query.relatedId
        ? { relatedType: String(query.relatedType), relatedId: String(query.relatedId) }
        : {};
    const where = andWhere(scope, config.baseWhere || {}, saved, this.searchWhere(config, query.search), ...quick, related);
    const sortBy = query.sortBy && config.allowed.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const take = Math.min(Number(query.take) || 300, 500);
    return this.model(config).findMany({
      where,
      include: config.listInclude,
      orderBy: { [sortBy]: sortDir },
      take,
    });
  }

  async get(user: AuthUser, config: ObjectConfig, id: string) {
    const scope = await this.sharing.readScope(user, config.objectType);
    const row = await this.model(config).findFirst({
      where: andWhere({ id }, scope),
      include: config.detailInclude || config.listInclude,
    });
    if (!row) throw new NotFoundException(`${config.label} not found`);
    return row;
  }

  async create(user: AuthUser, config: ObjectConfig, input: any) {
    if (!(await this.sharing.can(user, config.objectType, 'create'))) {
      throw new ForbiddenException(`You cannot create ${config.plural.toLowerCase()}`);
    }
    const data = prepareData(input, config.allowed);
    if (!data.ownerId) data.ownerId = user.id;
    if (config.objectType === 'Activity') data.createdById = user.id;
    config.beforeSave?.(data, null);
    const created = await this.model(config).create({ data, include: config.listInclude });
    if (data.ownerId && data.ownerId !== user.id) {
      await this.notifications.notify(
        data.ownerId,
        'assignment',
        `${user.firstName} ${user.lastName} assigned you a ${config.label.toLowerCase()}: ${labelOf(config, created)}`,
        `/o/${config.key}/${created.id}`,
      );
    }
    return created;
  }

  async update(user: AuthUser, config: ObjectConfig, id: string, input: any) {
    const existing = await this.model(config).findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${config.label} not found`);
    if (!(await this.sharing.canEditRecord(user, config.objectType, id, existing.ownerId))) {
      throw new ForbiddenException(`You cannot edit this ${config.label.toLowerCase()}`);
    }
    const data = prepareData(input, config.allowed);
    if (data.customFields && existing.customFields && typeof data.customFields === 'object') {
      data.customFields = { ...(existing.customFields as object), ...(data.customFields as object) };
    }
    config.beforeSave?.(data, existing);
    const updated = await this.model(config).update({
      where: { id },
      data,
      include: config.detailInclude || config.listInclude,
    });
    if (data.ownerId && data.ownerId !== existing.ownerId) {
      await this.notifications.notify(
        data.ownerId,
        'assignment',
        `${user.firstName} ${user.lastName} assigned you a ${config.label.toLowerCase()}: ${labelOf(config, updated)}`,
        `/o/${config.key}/${updated.id}`,
      );
    }
    return updated;
  }

  async remove(user: AuthUser, config: ObjectConfig, id: string) {
    const existing = await this.model(config).findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`${config.label} not found`);
    const permitted = user.isAdmin || (await this.sharing.can(user, config.objectType, 'delete'));
    const canEdit = await this.sharing.canEditRecord(user, config.objectType, id, existing.ownerId);
    if (!permitted || !canEdit) throw new ForbiddenException(`You cannot delete this ${config.label.toLowerCase()}`);
    await this.model(config).delete({ where: { id } });
    return { success: true };
  }
}

export function labelOf(config: ObjectConfig, row: any) {
  if (config.title) return config.title(row);
  return row.name || row.subject || row.id;
}
