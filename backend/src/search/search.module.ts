import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { andWhere } from '../common/data';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  async search(user: AuthUser, q: string) {
    const term = (q || '').trim();
    if (term.length < 1) return [];
    const contains = { contains: term, mode: 'insensitive' as const };
    const [leadScope, accountScope, contactScope, oppScope, caseScope] = await Promise.all([
      this.sharing.readScope(user, 'Lead'),
      this.sharing.readScope(user, 'Account'),
      this.sharing.readScope(user, 'Contact'),
      this.sharing.readScope(user, 'Opportunity'),
      this.sharing.readScope(user, 'Case'),
    ]);

    const [leads, accounts, contacts, opportunities, cases, custom] = await Promise.all([
      this.prisma.lead.findMany({
        where: andWhere(leadScope, { isConverted: false }, { OR: [{ firstName: contains }, { lastName: contains }, { company: contains }, { email: contains }] }),
        take: 8,
      }),
      this.prisma.account.findMany({
        where: andWhere(accountScope, { OR: [{ name: contains }, { industry: contains }] }),
        take: 8,
      }),
      this.prisma.contact.findMany({
        where: andWhere(contactScope, { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] }),
        take: 8,
      }),
      this.prisma.opportunity.findMany({
        where: andWhere(oppScope, { name: contains }),
        take: 8,
      }),
      this.prisma.case.findMany({
        where: andWhere(caseScope, { OR: [{ subject: contains }, { description: contains }] }),
        take: 8,
      }),
      this.prisma.customRecord.findMany({
        where: { name: contains },
        include: { customObject: true },
        take: 8,
      }),
    ]);

    return [
      ...leads.map((row) => ({ type: 'Lead', id: row.id, title: `${row.firstName} ${row.lastName}`, subtitle: row.company, href: `/o/leads/${row.id}` })),
      ...accounts.map((row) => ({ type: 'Account', id: row.id, title: row.name, subtitle: row.industry || '', href: `/o/accounts/${row.id}` })),
      ...contacts.map((row) => ({ type: 'Contact', id: row.id, title: `${row.firstName} ${row.lastName}`, subtitle: row.email || '', href: `/o/contacts/${row.id}` })),
      ...opportunities.map((row) => ({ type: 'Opportunity', id: row.id, title: row.name, subtitle: row.stage, href: `/o/opportunities/${row.id}` })),
      ...cases.map((row) => ({ type: 'Case', id: row.id, title: row.subject, subtitle: row.status, href: `/o/cases/${row.id}` })),
      ...custom.map((row) => ({
        type: row.customObject.label,
        id: row.id,
        title: row.name,
        subtitle: row.customObject.pluralLabel,
        href: `/o/custom-${row.customObject.apiKey}/${row.id}`,
      })),
    ];
  }
}

@Controller('search')
export class SearchController {
  constructor(private search: SearchService) {}

  @Get()
  searchAll(@CurrentUser() user: AuthUser, @Query('q') q = '') {
    return this.search.search(user, q);
  }
}

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
