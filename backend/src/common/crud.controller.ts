import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CrudService } from './crud.service';
import { AuthUser, CurrentUser } from './decorators';
import { ObjectConfig } from '../metadata/object-meta';

export function makeCrudController(config: ObjectConfig) {
  @Controller(config.key)
  class GenericCrudController {
    constructor(public crud: CrudService) {}

    @Get()
    findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
      return this.crud.list(user, config, query);
    }

    @Get(':id')
    findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
      return this.crud.get(user, config, id);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() body: any) {
      return this.crud.create(user, config, body);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
      return this.crud.update(user, config, id, body);
    }

    @Delete(':id')
    remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
      return this.crud.remove(user, config, id);
    }
  }
  Object.defineProperty(GenericCrudController, 'name', { value: `${config.label}Controller` });
  return GenericCrudController;
}
