import { Global, Module } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { FiltersService } from './filters.service';
import { NotificationsService } from './notifications.service';
import { CrudService } from './crud.service';

@Global()
@Module({
  providers: [SharingService, FiltersService, NotificationsService, CrudService],
  exports: [SharingService, FiltersService, NotificationsService, CrudService],
})
export class CommonModule {}
