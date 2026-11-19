import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { PaymentWebhookService } from '../services/payment-webhook.service';

/**
 * Receives the webhooks of the payment provider.
 *
 * No login: the provider cannot send one. Trust comes only from the
 * signature, verified on the raw body. The rate limit is off for this
 * route because a provider may send bursts of legitimate events.
 *
 * It answers 200 for a processed, repeated or ignored event, 400 for a
 * webhook that cannot be trusted, and 500 when processing failed (the
 * provider then sends the event again).
 */
@ApiTags('Payments / Webhooks')
@SkipThrottle()
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  /**
   * Injects the webhook service.
   *
   * @param webhookService Webhook processing.
   */
  constructor(private readonly webhookService: PaymentWebhookService) {}

  /**
   * Receives one webhook.
   *
   * @param provider Provider named in the address.
   * @param request The request (the raw body is needed for the signature).
   * @returns An acknowledgement.
   */
  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment provider webhook',
    description:
      'Called by the payment provider, never by the frontend. The signature is verified on the raw body.',
  })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({
    schema: { type: 'object', properties: { received: { type: 'boolean' } } },
  })
  @ApiBadRequestResponse({ description: 'Invalid signature or body.' })
  @ApiNotFoundResponse({ description: 'Unknown provider.' })
  async receive(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    if (!request.rawBody) {
      throw new BadRequestException('Invalid webhook.');
    }

    await this.webhookService.handle(
      provider,
      request.rawBody,
      request.headers,
    );

    return { received: true };
  }
}