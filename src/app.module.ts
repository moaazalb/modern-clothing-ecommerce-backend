import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/sessions.module';

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

    UsersModule,
    AuthModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}