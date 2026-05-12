import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RegionsModule } from './regions/regions.module';
import { GuestGroupsModule } from './guest-groups/guest-groups.module';
import { GuestsModule } from './guests/guests.module';

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
            synchronize: false,
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
  ],
})
export class AppModule {}
