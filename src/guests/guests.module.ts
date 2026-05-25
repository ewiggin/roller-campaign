import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { Host } from '../hosts/entities/host.entity';
import { Region } from '../regions/entities/region.entity';
import { User } from '../users/entities/user.entity';
import { Guest } from './entities/guest.entity';
import { GuestAccessController } from './guest-access.controller';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guest, GuestGroup, User, Region, Host, Activity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [GuestsController, GuestAccessController],
  providers: [GuestsService],
  exports: [GuestsService],
})
export class GuestsModule {}
