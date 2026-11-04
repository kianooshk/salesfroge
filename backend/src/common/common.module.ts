import { Global, Module } from '@nestjs/common';
import { SharingService } from './sharing.service';

@Global()
@Module({
  providers: [SharingService],
  exports: [SharingService],
})
export class CommonModule {}
