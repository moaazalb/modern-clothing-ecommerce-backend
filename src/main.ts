import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { PostgresExceptionFilter } from './common/filters/postgres-exception.filter';

/**
 * Initializes the NestJS application.
 *
 * Configures request validation, cookie parsing, CORS,
 * global exception handling, Swagger documentation,
 * and starts the HTTP server.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  /**
   * Serves uploaded product images as public static files.
   *
   * Maps the local uploads directory to the /uploads URL prefix.
   */
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  /**
   * Parses incoming cookies and attaches them to the request.
   *
   * This allows authentication endpoints to access
   * the HttpOnly refresh token cookie.
   */
  app.use(cookieParser());

  /**
   * Enables cross-origin requests from the frontend.
   *
   * Credentials are required for the browser to send
   * and receive authentication cookies.
   */
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://192.168.31.1:3000',
      'http://192.168.31.1:3001'   
    ],
    credentials: true,
  });

  /**
   * Applies validation rules to all incoming requests.
   *
   * whitelist:
   * Removes properties that are not defined in the DTO.
   *
   * forbidNonWhitelisted:
   * Rejects requests containing properties not defined in the DTO.
   *
   * transform:
   * Automatically transforms incoming payloads into DTO instances.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * Translates PostgreSQL errors into safe HTTP responses.
   */
  app.useGlobalFilters(new PostgresExceptionFilter());

  /**
   * Configures Swagger documentation metadata.
   */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Modern Clothing API')
    .setDescription(
      'REST API documentation for the Modern Clothing ecommerce application.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token.',
      },
      'access-token',
    )
    .build();

  /**
   * Generates the OpenAPI document from application routes.
   */
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  /**
   * Exposes Swagger UI at /api/docs.
   */
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}

void bootstrap();
