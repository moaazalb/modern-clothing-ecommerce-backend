import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    // Load environment variables globally.
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Configure PostgreSQL connection through TypeORM.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),

        autoLoadEntities: true,

        // manage database changes using migrations.
        synchronize: false,
      }),
    }),

    // Rate limiting: default 100 requests per minute per IP.
    // Override with THROTTLE_TTL_MS and THROTTLE_LIMIT in the environment.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get<string>('THROTTLE_TTL_MS') ?? 60000),
          limit: Number(configService.get<string>('THROTTLE_LIMIT') ?? 100),
        },
      ],
    }),

    UsersModule,
    AuthModule,
    SessionsModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Applies rate limiting to every route.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
