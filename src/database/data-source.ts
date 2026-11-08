import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI Data Source configuration.
 *
 * This configuration is used by TypeORM CLI to:
 * - Connect to the PostgreSQL database.
 * - Discover entity files.
 * - Locate database migration files.
 *
 * Note:
 * NestJS uses its own TypeORM configuration inside AppModule.
 * This DataSource is specifically required for CLI operations
 * such as generating, running, and reverting migrations.
 */
const dataSource = new DataSource({
  /**
   * Database engine used by the application.
   */
  type: 'postgres',

  /**
   * Database server hostname.
   * Usually localhost when PostgreSQL runs locally.
   */
  host: process.env.DB_HOST,

  /**
   * PostgreSQL server port.
   * Defaults to 5432 when DB_PORT is not provided.
   */
  port: Number(process.env.DB_PORT ?? 5432),

  /**
   * PostgreSQL database username.
   */
  username: process.env.DB_USERNAME,

  /**
   * PostgreSQL database password.
   */
  password: process.env.DB_PASSWORD,

  /**
   * Name of the database used by the application.
   */
  database: process.env.DB_DATABASE,

  /**
   * Glob pattern used to discover TypeORM entity files.
   * Entities define the structure of database tables.
   */
  entities: ['src/**/*.entity.ts'],

  /**
   * Directory where TypeORM migration files are stored.
   * Migrations track and apply database schema changes.
   */
  migrations: ['src/database/migrations/*.ts'],

  /**
   * Prevents TypeORM from automatically modifying the database schema.
   * Database changes will be managed explicitly through migrations.
   */
  synchronize: false,
});

export default dataSource;
