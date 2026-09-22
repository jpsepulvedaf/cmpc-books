import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerEnabled } from './config/swagger.config';
import { ensureUploadDirs, UPLOADS_ROOT } from './modules/books/image-upload.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  const config = app.get(ConfigService);

  // CORP disabled so the web app (different origin) can render <img> tags from
  // /uploads. In production these files would sit behind a CDN instead.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Global prefix: every route lives under /api
  app.setGlobalPrefix('api');

  // ─── Uploaded images ────────────────────────────────────────────────────
  // Ensure the upload folder exists, then serve it read-only:
  //   - write endpoints live under /api (choose role + validate, see BooksModule)
  //   - the static route is intentionally public and OUTSIDE the /api prefix,
  //     because <img> tags fetch the URL straight from the browser origin.
  await ensureUploadDirs();
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads', index: false });

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