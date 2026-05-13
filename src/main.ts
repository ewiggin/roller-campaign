import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  if (process.env.NODE_ENV === 'production') {
    const dataSource = app.get(DataSource);
    const pending = await dataSource.showMigrations();
    if (pending) {
      logger.log('Running pending migrations…');
      const ran = await dataSource.runMigrations({ transaction: 'each' });
      logger.log(`Migrations executed: ${ran.map((m) => m.name).join(', ') || 'none'}`);
    } else {
      logger.log('No pending migrations.');
    }
  }

  const config = new DocumentBuilder()
    .setTitle('Roller Campaign API')
    .setDescription('API para la gestión de la campaña de predicación')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
