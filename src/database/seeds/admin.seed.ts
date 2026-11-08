
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { User, UserRole } from '../../users/entities/user.entity';

/**
 * Creates the initial admin account if it does not already exist.
 *
 * This seed is intended for local development and initial setup.
 */
async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error(
        'ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env',
      );
    }

    if (adminPassword.length < 12) {
      throw new Error('Admin password must be at least 12 characters long.');
    }

    await dataSource.initialize();

    const userRepository = dataSource.getRepository(User);

    const existingUser = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingUser) {
      if (existingUser.role === UserRole.ADMIN) {
        console.log('Admin account already exists.');
        return;
      }

      throw new Error(
        'This email already belongs to a non-admin user. No changes were made.',
      );
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = userRepository.create({
      firstName: 'System',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await userRepository.save(admin);

    console.log('Admin account created successfully.');
    console.log(`Admin email: ${adminEmail}`);
  } catch (error) {
    console.error('Failed to create admin account:', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void seedAdmin();
