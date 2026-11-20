import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionsModule } from '../sessions/sessions.module';

/**
 * Users module.
 *
 * Responsible for user-related functionality,
 * including accessing and managing user records.
 * It imports SessionsModule to end the other sessions of a user whose
 * password or email changed.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), SessionsModule],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}