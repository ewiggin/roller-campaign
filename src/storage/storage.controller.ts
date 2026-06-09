import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignDownloadRequestDto } from './dto/presign-download-request.dto';
import { PresignDownloadResponseDto } from './dto/presign-download-response.dto';
import { PresignUploadRequestDto } from './dto/presign-upload-request.dto';
import { PresignUploadResponseDto } from './dto/presign-upload-response.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign/upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: PresignUploadResponseDto })
  async presignUpload(
    @Body() dto: PresignUploadRequestDto,
  ): Promise<PresignUploadResponseDto> {
    const expiresIn = dto.expiresIn ?? 300;
    const url = await this.storageService.getPresignedUploadUrl(
      dto.key,
      dto.contentType,
      expiresIn,
    );
    return { url, key: dto.key, expiresIn };
  }

  @Get('presign/download')
  @ApiOkResponse({ type: PresignDownloadResponseDto })
  async presignDownload(
    @Query() dto: PresignDownloadRequestDto,
  ): Promise<PresignDownloadResponseDto> {
    const expiresIn = dto.expiresIn ?? 3600;
    const url = await this.storageService.getPresignedDownloadUrl(
      dto.key,
      expiresIn,
    );
    return { url, key: dto.key, expiresIn };
  }
}
