import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterClause } from './data';

@Injectable()
export class FiltersService {
  constructor(private prisma: PrismaService) {}

  async fromQuery(query: any): Promise<FilterClause[]> {
    if (query?.viewId) {
      const view = await this.prisma.listView.findUnique({ where: { id: String(query.viewId) } });
      return Array.isArray(view?.filters) ? (view!.filters as unknown as FilterClause[]) : [];
    }
    if (query?.filters) {
      try {
        const parsed = typeof query.filters === 'string' ? JSON.parse(query.filters) : query.filters;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
