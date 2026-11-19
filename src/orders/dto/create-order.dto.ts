import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { EmptyStringToUndefined } from '../../common/transforms/optional.transforms';
import {
  ToUpperCase,
  Trim,
} from '../../common/transforms/string.transforms';
import { PaymentMethod } from '../enums/payment-method.enum';
import { NormalizePhone } from '../transforms/normalize-phone.transform';

/**
 * Defines the data required to place an order from the cart.
 *
 * The items and the prices come from the cart and the database, never from
 * the client. The idempotency key is sent in the Idempotency-Key header.
 */
export class CreateOrderDto {
  /**
   * Name of the person who receives the order.
   */
  @ApiProperty({ example: 'Moaaz Albari', maxLength: 150 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  shippingName: string;

  /**
   * Contact phone number. Spaces, hyphens and parentheses are removed.
   */
  @ApiProperty({
    description: 'Phone number: 7 to 15 digits with an optional leading +.',
    example: '+963912345678',
  })
  @Trim()
  @NormalizePhone()
  @IsString()
  @Matches(/^[+]?[0-9]{7,15}$/, {
    message: 'shippingPhone must be 7 to 15 digits with an optional leading +.',
  })
  shippingPhone: string;

  /**
   * Country as a two-letter ISO code (normalized to uppercase).
   */
  @ApiProperty({ description: 'Two-letter ISO country code.', example: 'SY' })
  @Trim()
  @ToUpperCase()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'shippingCountry must be a two-letter ISO country code.',
  })
  shippingCountry: string;

  /**
   * Delivery city.
   */
  @ApiProperty({ example: 'Damascus', maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shippingCity: string;

  /**
   * Delivery address.
   */
  @ApiProperty({ example: 'Al-Mazzeh, Street 12, Building 4', maxLength: 300 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  shippingAddress: string;

  /**
   * Optional delivery instructions.
   */
  @ApiPropertyOptional({ maxLength: 300 })
  @EmptyStringToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(300)
  shippingNotes?: string;

  /**
   * Optional note from the customer.
   */
  @ApiPropertyOptional({ maxLength: 500 })
  @EmptyStringToUndefined()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  /**
   * Payment method. Only cash on delivery exists for now (the default).
   */
  @ApiPropertyOptional({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    default: PaymentMethod.COD,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}