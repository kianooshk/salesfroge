import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CurrentUser, AuthUser } from '../common/decorators';

@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.leads.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.findOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.leads.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.leads.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leads.remove(user, id);
  }

  @Post(':id/convert')
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.leads.convert(user, id, body);
  }
}
