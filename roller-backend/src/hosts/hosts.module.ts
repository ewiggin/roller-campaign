import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Host } from './entities/host.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import { HostsService } from './hosts.service';
import { HostsController } from './hosts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Host, GuestGroup, Guest, User, Region])],
  controllers: [HostsController],
  providers: [HostsService],
  exports: [HostsService],
})
export class HostsModule {}
