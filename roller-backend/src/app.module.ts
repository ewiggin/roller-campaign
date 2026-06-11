import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesModule } from './activities/activities.module';
import { CartsModule } from './carts/carts.module';
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
        // No entity glob here: when bundled as a single-file sidecar (ncc +
        // pkg) there are no *.entity.js files on disk, so globs find nothing.
        // Every entity is registered via TypeOrmModule.forFeature.
        const database = config.get('DATABASE_PATH', 'app.db');
        if (database !== ':memory:') {
          mkdirSync(dirname(database), { recursive: true });
        }
        return {
          type: 'better-sqlite3',
          database,
          autoLoadEntities: true,
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
    CartsModule,
    VersionModule,
  ],
})
export class AppModule {}
