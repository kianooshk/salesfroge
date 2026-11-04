import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { andWhere, buildFilterWhere } from '../common/data';
import { aggregateRows } from '../common/aggregate';
import { OBJECT_BY_API, OPPORTUNITY_STAGES } from '../metadata/object-meta';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  async runDefinition(user: AuthUser, def: any) {
    const config = OBJECT_BY_API[def.objectType];
    if (!config) throw new BadRequestException(`Reports are not available for ${def.objectType}`);
    const scope = await this.sharing.readScope(user, config.objectType);
    const where = andWhere(scope, config.baseWhere || {}, buildFilterWhere(def.filters || []));
    const rows = await (this.prisma as any)[config.model].findMany({ where, take: 2000 });
    const order =
      def.objectType === 'Opportunity' && def.groupBy === 'stage'
        ? OPPORTUNITY_STAGES.map((stage) => stage.name)
        : def.objectType === 'Lead' && def.groupBy === 'status'
          ? ['New', 'Working', 'Nurturing', 'Qualified', 'Unqualified']
          : undefined;
    const result = aggregateRows(rows, def, order);
    return { ...result, objectType: def.objectType, chartType: def.chartType || 'bar', groupBy: def.groupBy, aggregate: def.aggregate || 'count' };
  }

  list() {
    return this.prisma.report.findMany({ orderBy: { name: 'asc' }, include: { owner: { select: { firstName: true, lastName: true } } } });
  }

  async get(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  create(user: AuthUser, input: any) {
    return this.prisma.report.create({
      data: {
        name: input.name || 'Untitled report',
        description: input.description || null,
        objectType: input.objectType,
        groupBy: input.groupBy || null,
        aggregate: input.aggregate || 'count',
        aggregateField: input.aggregateField || null,
        filters: input.filters || [],
        chartType: input.chartType || 'bar',
        ownerId: user.id,
      },
    });
  }

  async update(user: AuthUser, id: string, input: any) {
    const report = await this.get(id);
    if (report.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException();
    const data: any = {};
    for (const key of ['name', 'description', 'objectType', 'groupBy', 'aggregate', 'aggregateField', 'filters', 'chartType']) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    return this.prisma.report.update({ where: { id }, data });
  }

  async remove(user: AuthUser, id: string) {
    const report = await this.get(id);
    if (report.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException();
    await this.prisma.report.delete({ where: { id } });
    return { success: true };
  }

  async run(user: AuthUser, id: string) {
    const report = await this.get(id);
    const result = await this.runDefinition(user, report);
    return { report, result };
  }

  listDashboards() {
    return this.prisma.dashboard.findMany({ orderBy: { name: 'asc' } });
  }

  async createDashboard(user: AuthUser, input: any) {
    return this.prisma.dashboard.create({
      data: { name: input.name || 'Dashboard', widgets: input.widgets || [], ownerId: user.id },
    });
  }

  async updateDashboard(user: AuthUser, id: string, input: any) {
    const dashboard = await this.prisma.dashboard.findUnique({ where: { id } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    if (dashboard.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException();
    return this.prisma.dashboard.update({
      where: { id },
      data: {
        name: input.name ?? dashboard.name,
        widgets: input.widgets ?? dashboard.widgets,
      },
    });
  }

  async removeDashboard(user: AuthUser, id: string) {
    const dashboard = await this.prisma.dashboard.findUnique({ where: { id } });
    if (!dashboard) return { success: true };
    if (dashboard.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException();
    await this.prisma.dashboard.delete({ where: { id } });
    return { success: true };
  }

  async getDashboard(user: AuthUser, id: string) {
    const dashboard = await this.prisma.dashboard.findUnique({ where: { id } });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    const widgets = Array.isArray(dashboard.widgets) ? (dashboard.widgets as any[]) : [];
    const results: any[] = [];
    for (const widget of widgets) {
      if (!widget?.reportId) continue;
      const report = await this.prisma.report.findUnique({ where: { id: widget.reportId } });
      if (!report) continue;
      results.push({ report, result: await this.runDefinition(user, report), width: widget.width || 1 });
    }
    return { ...dashboard, results };
  }

  async summary(user: AuthUser) {
    const [leadScope, oppScope, caseScope, activityScope, accountScope, contactScope] = await Promise.all([
      this.sharing.readScope(user, 'Lead'),
      this.sharing.readScope(user, 'Opportunity'),
      this.sharing.readScope(user, 'Case'),
      this.sharing.readScope(user, 'Activity'),
      this.sharing.readScope(user, 'Account'),
      this.sharing.readScope(user, 'Contact'),
    ]);
    const [leads, opportunities, cases, tasks, accounts, contacts] = await Promise.all([
      this.prisma.lead.findMany({ where: andWhere(leadScope, { isConverted: false }), select: { status: true } }),
      this.prisma.opportunity.findMany({ where: oppScope, select: { stage: true, amount: true } }),
      this.prisma.case.findMany({ where: caseScope, select: { status: true, priority: true } }),
      this.prisma.activity.findMany({
        where: andWhere(activityScope, { type: 'Task', status: 'Open', ownerId: user.id }),
        orderBy: { dueDate: 'asc' },
        take: 8,
        include: { owner: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.account.count({ where: accountScope }),
      this.prisma.contact.count({ where: contactScope }),
    ]);
    return {
      counts: {
        leads: leads.length,
        accounts,
        contacts,
        opportunities: opportunities.length,
        openCases: cases.filter((row) => row.status !== 'Closed').length,
        openTasks: tasks.length,
      },
      pipeline: aggregateRows(opportunities, { groupBy: 'stage', aggregate: 'sum', aggregateField: 'amount' }, OPPORTUNITY_STAGES.map((s) => s.name)),
      leadsByStatus: aggregateRows(leads, { groupBy: 'status', aggregate: 'count' }, ['New', 'Working', 'Nurturing', 'Qualified', 'Unqualified']),
      casesByPriority: aggregateRows(cases.filter((row) => row.status !== 'Closed'), { groupBy: 'priority', aggregate: 'count' }, ['High', 'Medium', 'Low']),
      myTasks: tasks,
    };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get() list() { return this.reports.list(); }
  @Post('preview') preview(@CurrentUser() user: AuthUser, @Body() body: any) { return this.reports.runDefinition(user, body); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: any) { return this.reports.create(user, body); }
  @Get(':id') get(@Param('id') id: string) { return this.reports.get(id); }
  @Get(':id/run') run(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.reports.run(user, id); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.reports.update(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.reports.remove(user, id); }
}

@Controller('dashboards')
export class DashboardsController {
  constructor(private reports: ReportsService) {}

  @Get() list() { return this.reports.listDashboards(); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: any) { return this.reports.createDashboard(user, body); }
  @Get(':id') get(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.reports.getDashboard(user, id); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.reports.updateDashboard(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.reports.removeDashboard(user, id); }
}

@Controller('dashboard')
export class DashboardSummaryController {
  constructor(private reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.reports.summary(user);
  }
}

@Module({
  controllers: [ReportsController, DashboardsController, DashboardSummaryController],
  providers: [ReportsService],
})
export class ReportsModule {}
