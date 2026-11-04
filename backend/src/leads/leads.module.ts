import { Module } from '@nestjs/common';
import { makeCrudController } from '../common/crud.controller';
import { LEAD } from './tokens';
import { LeadsConvertController } from './leads.controller';
import { LeadsService } from './leads.service';

const LeadCrudController = makeCrudController(LEAD);

@Module({
  controllers: [LeadCrudController, LeadsConvertController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
