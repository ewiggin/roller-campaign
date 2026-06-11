import { Injectable } from '@nestjs/common';
// Static import so the version survives single-file bundling (ncc/pkg),
// where there is no package.json next to the process cwd.
import * as pkg from '../../package.json';
import { VersionResponseDto } from './dto/version-response.dto';

@Injectable()
export class VersionService {
  private readonly info: VersionResponseDto;

  constructor() {
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
