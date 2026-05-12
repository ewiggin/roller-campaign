import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Guest } from './entities/guest.entity';
import { GuestGroup } from '../guest-groups/entities/guest-group.entity';
import { User } from '../users/entities/user.entity';
import { Region } from '../regions/entities/region.entity';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';
import { GuestAccessController } from './guest-access.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guest, GuestGroup, User, Region]),
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
