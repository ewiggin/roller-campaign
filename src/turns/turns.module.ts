import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Turn } from './entities/turn.entity';
import { Volunteer } from '../volunteers/entities/volunteer.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { TurnsService } from './turns.service';
import { TurnsController } from './turns.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Turn, Volunteer, Region, User])],
  controllers: [TurnsController],
  providers: [TurnsService],
  exports: [TurnsService],
})
export class TurnsModule {}
