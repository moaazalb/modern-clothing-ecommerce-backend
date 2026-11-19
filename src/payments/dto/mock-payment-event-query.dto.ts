import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Optional query of the mock payment endpoints.
 */
export class MockPaymentEventQueryDto {
  /**
   * Event id to use. Sending the same id twice simulates the gateway
   * delivering the same event again.
   */
  @ApiPropertyOptional({ example: 'evt_test_1' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,100}$/, {
    message: 'eventId must be 1 to 100 letters, digits, "_" or "-".',
  })
  eventId?: string;
}