import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { Guest } from '../guests/entities/guest.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Host } from '../hosts/entities/host.entity';
import { Volunteer } from '../volunteers/entities/volunteer.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Guest, GuestGroup, Host, Volunteer, Region, User])],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
