import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Initializes the NestJS application.
 *
 * Configures global request validation and starts
 * the HTTP server on the configured port.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
   * Generates the OpenAPI document from the application routes.
   */
  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  /**
   * Exposes Swagger UI at /api/docs.
   */
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();