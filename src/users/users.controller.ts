import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from './entities/user.entity';

/**
 * Authenticated request information attached by JwtStrategy.
 */
interface AuthenticatedRequest {
  user: UserResponseDto & { sid: string };
}

/**
 * Users controller.
 *
 * Handles HTTP requests related to user accounts
 * and delegates business logic to UsersService.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  /**
   * Injects UsersService to handle user operations.
   *
   * @param usersService Service responsible for user business logic.
   */
  constructor(private readonly usersService: UsersService) {}

  /**
   * Allows access only to the account owner or to an administrator.
   *
   * @param request Authenticated request.
   * @param targetUserId UUID of the account being accessed.
   * @throws ForbiddenException If the caller is neither the owner nor an admin.
   */
  private assertSelfOrAdmin(
    request: AuthenticatedRequest,
    targetUserId: string,
  ): void {
    const isOwner = request.user.id === targetUserId;
    const isAdmin = request.user.role === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to access this account.',
      );
    }
  }

  /**
   * Creates a new user account.
   *
   * POST /users
   *
   * @param createUserDto Validated user registration data.
   * @returns The newly created user.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Registers a new customer account.',
  })
  @ApiCreatedResponse({
    description: 'User account created successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or unauthorized fields.',
  })
  @ApiConflictResponse({
    description: 'An account with this email already exists.',
  })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  /**
   * Retrieves all registered users.
   *
   * GET /users
   *
   * @returns An array of users.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieves all registered user accounts.',
  })
  @ApiOkResponse({
    description: 'Users retrieved successfully.',
    type: UserResponseDto,
    isArray: true,
  })
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  /**
   * Retrieves a user by their UUID.
   *
   * GET /users/:id
   *
   * @param request Authenticated request.
   * @param id User UUID.
   * @returns The requested user.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a user by ID',
    description:
      'Retrieves a specific user using their UUID. Allowed for the account owner or an administrator.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID.',
    example: '7ff6ebd8-8743-4b91-bcea-0307f9fd5210',
  })
  @ApiOkResponse({
    description: 'User retrieved successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token.',
  })
  @ApiForbiddenResponse({
    description:
      'The caller is neither the account owner nor an administrator.',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    this.assertSelfOrAdmin(request, id);

    return this.usersService.findOne(id);
  }

  /**
   * Updates an existing user.
   *
   * PATCH /users/:id
   *
   * @param request Authenticated request.
   * @param id User UUID.
   * @param updateUserDto Optional fields to update.
   * @returns The updated user.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update a user',
    description:
      'Updates the specified user account. Allowed for the account owner or an administrator.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID.',
  })
  @ApiOkResponse({
    description: 'User updated successfully.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID or input data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token.',
  })
  @ApiForbiddenResponse({
    description:
      'The caller is neither the account owner nor an administrator.',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  @ApiConflictResponse({
    description: 'The email address is already in use.',
  })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.assertSelfOrAdmin(request, id);

    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Permanently deletes a user account.
   *
   * DELETE /users/:id
   *
   * @param id User UUID.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes the specified user account. Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID.',
  })
  @ApiNoContentResponse({
    description: 'User deleted successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid access token.',
  })
  @ApiForbiddenResponse({
    description: 'Administrator role required.',
  })
  @ApiNotFoundResponse({
    description: 'User not found.',
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
