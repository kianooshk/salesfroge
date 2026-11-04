import { Body, Controller, Param, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { AuthUser, CurrentUser } from '../common/decorators';

@Controller('leads')
export class LeadsConvertController {
  constructor(private leads: LeadsService) {}

  @Post(':id/convert')
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.leads.convert(user, id, body || {});
  }
}
