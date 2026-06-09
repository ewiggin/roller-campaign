import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { VersionResponseDto } from './dto/version-response.dto';

@Injectable()
export class VersionService {
  private readonly info: VersionResponseDto;

  constructor() {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { name: string; version: string };
    this.info = {
      name: pkg.name,
      version: pkg.version,
      environment: process.env.NODE_ENV ?? 'development',
    };
  }

  getVersion(): VersionResponseDto {
    return this.info;
  }
}
