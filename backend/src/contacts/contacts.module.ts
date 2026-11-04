import { Module } from '@nestjs/common';
import { makeCrudController } from '../common/crud.controller';
import { OBJECT_BY_KEY } from '../metadata/object-meta';

@Module({ controllers: [makeCrudController(OBJECT_BY_KEY.contacts)] })
export class ContactsModule {}
