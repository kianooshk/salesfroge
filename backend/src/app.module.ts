import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { Public } from './common/decorators';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { AccountsModule } from './accounts/accounts.module';
import { ContactsModule } from './contacts/contacts.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { CasesModule } from './cases/cases.module';
import { ActivitiesModule } from './activities/activities.module';
import { UsersModule } from './users/users.module';
import { FeedModule } from './feed/feed.module';
import { ViewsModule } from './views/views.module';
import { SearchModule } from './search/search.module';
import { MetadataModule } from './metadata/metadata.module';
import { ReportsModule } from './reports/reports.module';
import { EmailModule } from './email/email.module';
import { FilesModule } from './files/files.module';
import { CustomModule } from './custom/custom.module';
import { ImportModule } from './import/import.module';
import { CalendarModule } from './calendar/calendar.module';

@Controller('health')
class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: 'salesfroge' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    LeadsModule,
    AccountsModule,
    ContactsModule,
    OpportunitiesModule,
    CasesModule,
    ActivitiesModule,
    FeedModule,
    ViewsModule,
    SearchModule,
    MetadataModule,
    ReportsModule,
    EmailModule,
    FilesModule,
    CustomModule,
    ImportModule,
    CalendarModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
