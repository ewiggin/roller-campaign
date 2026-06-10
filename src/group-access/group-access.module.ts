import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityPreachingGroup } from '../activities/entities/activity-preaching-group.entity';
import { Activity } from '../activities/entities/activity.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Guest } from '../guests/entities/guest.entity';
import { Region } from '../regions/entities/region.entity';
import { GroupActivityRequest } from './entities/group-activity-request.entity';
import { GroupAccessController } from './group-access.controller';
import { GroupAccessService } from './group-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GuestGroup,
      Guest,
      Activity,
      ActivityPreachingGroup,
      Region,
      GroupActivityRequest,
    ]),
  ],
  controllers: [GroupAccessController],
  providers: [GroupAccessService],
  exports: [GroupAccessService],
})
export class GroupAccessModule {}
