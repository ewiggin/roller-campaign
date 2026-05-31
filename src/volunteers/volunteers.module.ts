import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Volunteer } from './entities/volunteer.entity';
import { VolunteerRole } from './entities/volunteer-role.entity';
import { VolunteerAvailability } from './entities/volunteer-availability.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';
import { VolunteerAccessController } from './volunteer-access.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Volunteer,
      VolunteerRole,
      VolunteerAvailability,
      Region,
      User,
    ]),
  ],
  controllers: [VolunteersController, VolunteerAccessController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
