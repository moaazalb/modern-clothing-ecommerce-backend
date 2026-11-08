import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Users service.
 *
 * Handles user-related business logic and database operations.
 */
@Injectable()
export class UsersService {
  /**
   * Injects the User repository to interact with the users table.
   *
   * @param usersRepository TypeORM repository for User entities.
   */
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Converts a User entity into a safe response object.
   *
   * Sensitive fields such as passwords are excluded.
   *
   * @param user User entity retrieved from the database.
   * @returns Public user information.
   */
  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Finds a user entity by its unique identifier.
   *
   * @param id User UUID.
   * @returns The matching user entity.
   * @throws NotFoundException If the user does not exist.
   */
  private async findUserEntity(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} was not found.`);
    }

    return user;
  }

  /**
   * Creates a new user account.
   *
   * @param createUserDto Validated user registration data.
   * @returns The created user without the password.
   * @throws ConflictException If the email is already registered.
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const email = createUserDto.email.trim().toLowerCase();

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const user = this.usersRepository.create({
      ...createUserDto,
      email,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    return this.toResponseDto(savedUser);
  }

  /**
   * Retrieves all users from the database.
   *
   * @returns An array of users without password fields.
   */
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => this.toResponseDto(user));
  }

  /**
   * Retrieves a user by their UUID.
   *
   * @param id User UUID.
   * @returns The matching user without the password.
   * @throws NotFoundException If the user does not exist.
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findUserEntity(id);

    return this.toResponseDto(user);
  }

  /**
   * Updates an existing user's information.
   *
   * Hashes the password if a new password is provided.
   * Checks email uniqueness before saving.
   *
   * @param id User UUID.
   * @param updateUserDto Fields to update.
   * @returns The updated user without the password.
   * @throws NotFoundException If the user does not exist.
   * @throws ConflictException If the new email is already in use.
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.findUserEntity(id);

    const updateData = { ...updateUserDto };

    if (updateData.email !== undefined) {
      const email = updateData.email.trim().toLowerCase();

      const existingUser = await this.usersRepository.findOne({
        where: { email },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      updateData.email = email;
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    const updatedUser = this.usersRepository.merge(user, updateData);

    const savedUser = await this.usersRepository.save(updatedUser);

    return this.toResponseDto(savedUser);
  }

  /**
   * Permanently deletes a user account.
   *
   * @param id User UUID.
   * @throws NotFoundException If the user does not exist.
   */
  async remove(id: string): Promise<void> {
    const user = await this.findUserEntity(id);

    await this.usersRepository.remove(user);
  }

  /**
   * Finds a user by email, including the password hash.
   *
   * The password field is explicitly selected because
   * it is excluded from normal queries using select: false.
   *
   * This method is intended for authentication purposes only.
   *
   * @param email User's email address.
   * @returns The user entity including the password hash, or null.
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', {
        email: email.trim().toLowerCase(),
      })
      .getOne();
  }
}
