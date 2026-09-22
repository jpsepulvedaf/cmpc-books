import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerEnabled } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);

  app.use(helmet());

  // Global prefix: every route lives under /api
  app.setGlobalPrefix('api');

  // Global request payload validation (whitelist + transform DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Conditional Swagger ────────────────────────────────────────────────
  // SWAGGER_ENABLED defaults to true. When disabled (production), the module
  // is NOT registered, so /api/docs does not exist at all.
  if (swaggerEnabled(config)) {
    const options = new DocumentBuilder()
      .setTitle('CMPC Libros API')
      .setDescription('Prueba Técnica Full Stack — CMPC Libros')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('API_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('FATAL — failed to start API', err);
  process.exit(1);
});