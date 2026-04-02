import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { text } from 'express';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/validation.exception-factory';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const importBodyLimit = process.env.IMPORT_BODY_LIMIT ?? '2mb';
  app.use(
    text({
      limit: importBodyLimit,
      type: ['text/plain', 'text/yaml', 'text/x-yaml', 'application/yaml', 'application/x-yaml'],
    }),
  );

  const port = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 4000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
