import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MOCK_PROVIDER_NAME } from '../constants/payment.constants';

/**
 * Lets a request through only when the mock payment provider is the
 * configured one and the app does not run in production. Otherwise the
 * route behaves as if it did not exist.
 */
@Injectable()
export class MockProviderGuard implements CanActivate {
  /**
   * Injects the configuration service.
   *
   * @param configService Provides environment configuration.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Checks that the mock provider is active outside production.
   *
   * @returns True when the request may continue.
   * @throws NotFoundException Otherwise.
   */
  canActivate(): boolean {
    const provider = this.configService
      .get<string>('PAYMENT_PROVIDER')
      ?.trim()
      .toLowerCase();

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (provider !== MOCK_PROVIDER_NAME || isProduction) {
      throw new NotFoundException();
    }

    return true;
  }
}