import { Controller, Get, Module, Query } from '@nestjs/common';
import { makeCrudController } from '../common/crud.controller';
import { CrudService } from '../common/crud.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { OBJECT_BY_KEY, OPPORTUNITY_STAGES } from '../metadata/object-meta';

const OPPORTUNITY = OBJECT_BY_KEY.opportunities;

@Controller('opportunities')
export class OpportunityBoardController {
  constructor(private crud: CrudService) {}

  @Get('board')
  async board(@CurrentUser() user: AuthUser, @Query() query: any) {
    const rows = await this.crud.list(user, OPPORTUNITY, { ...query, take: 500 });
    const stages = OPPORTUNITY_STAGES.map((stage) => {
      const records = rows.filter((row: any) => row.stage === stage.name);
      const total = records.reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
      return { ...stage, count: records.length, total, records };
    });
    return { stages };
  }
}

@Module({
  controllers: [OpportunityBoardController, makeCrudController(OPPORTUNITY)],
})
export class OpportunitiesModule {}
