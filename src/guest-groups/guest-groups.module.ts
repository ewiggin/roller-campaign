import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestGroup } from './entities/guest-group.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import { Guest } from '../guests/entities/guest.entity';
import { GuestGroupsService } from './guest-groups.service';
import { GuestGroupsController } from './guest-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GuestGroup, User, Region, Guest])],
  controllers: [GuestGroupsController],
  providers: [GuestGroupsService],
  exports: [GuestGroupsService],
})
export class GuestGroupsModule {}
