import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Session } from './entities/session.entity';
import { SessionCleanupService } from './session-cleanup.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/**
 * Sessions module.
 *
 * Stores the authentication sessions and cleans up the old ones.
 * ScheduleModule.forRoot() may also be imported by another module: Nest
 * keeps a single instance of it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Session]), ScheduleModule.forRoot()],
  controllers: [SessionsController],
  providers: [SessionsService, SessionCleanupService],
  exports: [SessionsService],
})
export class SessionsModule {}