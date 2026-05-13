import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { GuestGroupsModule } from './guest-groups/guest-groups.module';
import { GuestsModule } from './guests/guests.module';
import { HostsModule } from './hosts/hosts.module';
import { RegionsModule } from './regions/regions.module';
import { TurnsModule } from './turns/turns.module';
import { UsersModule } from './users/users.module';
import { VolunteersModule } from './volunteers/volunteers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';
        if (isProduction) {
          return {
            type: 'postgres',
            url: config.get('DATABASE_URL'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/migrations/*{.ts,.js}'],
            synchronize: false,
            logging: ['error', 'migration'],
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'better-sqlite3',
          database: config.get('DATABASE_PATH', 'app.db'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
        };
      },
    }),
    AuthModule,
    UsersModule,
    RegionsModule,
    GuestGroupsModule,
    GuestsModule,
    VolunteersModule,
    TurnsModule,
    HostsModule,
  ],
})
export class AppModule {}
