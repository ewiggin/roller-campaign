import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from './activities/activities.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { GroupAccessModule } from './group-access/group-access.module';
import { AuthModule } from './auth/auth.module';
import { GuestGroupsModule } from './guest-groups/guest-groups.module';
import { GuestsModule } from './guests/guests.module';
import { HostsModule } from './hosts/hosts.module';
import { RegionsModule } from './regions/regions.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { VersionModule } from './version/version.module';
import { VolunteersModule } from './volunteers/volunteers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 60_000 }),
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
    ActivitiesModule,
    HostsModule,
    AuditLogsModule,
    SettingsModule,
    GroupAccessModule,
    StorageModule,
    VersionModule,
  ],
})
export class AppModule {}
