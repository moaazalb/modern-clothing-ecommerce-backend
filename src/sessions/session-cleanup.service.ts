import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import {
  SESSION_CLEANUP_BATCH_SIZE,
  SESSION_RETENTION_DAYS,
} from './constants/session.constants';
import { SessionsService } from './sessions.service';

/**
 * Deletes old sessions so the table does not grow forever.
 *
 * It runs every day at 03:00, and once when the server starts. A session
 * is deleted SESSION_RETENTION_DAYS days after it expired or was revoked.
 * Set SESSION_CLEANUP_ENABLED=false to switch it off (tests).
 */
@Injectable()
export class SessionCleanupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SessionCleanupService.name);
  private readonly enabled: boolean;
  private running = false;

  /**
   * Reads the cleanup setting.
   *
   * @param configService Provides SESSION_CLEANUP_ENABLED.
   * @param sessionsService Deletes the old sessions.
   */
  constructor(
    configService: ConfigService,
    private readonly sessionsService: SessionsService,
  ) {
    this.enabled = configService.get<string>('SESSION_CLEANUP_ENABLED') !== 'false';
  }

  /**
   * Starts a cleanup in the background when the server starts, without
   * delaying the startup.
   */
  onApplicationBootstrap(): void {
    void this.run();
  }

  /**
   * Deletes the old sessions. A run that starts while the previous one is
   * still going is skipped, and a failure is logged without crashing.
   */
  @Cron('0 3 * * *')
  async run(): Promise<void> {
    if (!this.enabled || this.running) {
      return;
    }

    this.running = true;

    try {
      const deleted = await this.sessionsService.deleteStaleSessions(
        SESSION_RETENTION_DAYS,
        SESSION_CLEANUP_BATCH_SIZE,
      );

      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} old session(s).`);
      }
    } catch (error) {
      this.logger.error(
        'The session cleanup failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}