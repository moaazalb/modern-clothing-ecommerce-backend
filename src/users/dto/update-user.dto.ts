import { PartialType } from '@nestjs/swagger';

import { CreateUserDto } from './create-user.dto';

/**
 * Defines the optional data allowed when updating a user.
 *
 * Inherits CreateUserDto properties and validation rules,
 * while making all properties optional in Swagger documentation.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
