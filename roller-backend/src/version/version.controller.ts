import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { VersionResponseDto } from './dto/version-response.dto';
import { VersionService } from './version.service';

@ApiTags('version')
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  @ApiOkResponse({ type: VersionResponseDto })
  getVersion(): VersionResponseDto {
    return this.versionService.getVersion();
  }
}
