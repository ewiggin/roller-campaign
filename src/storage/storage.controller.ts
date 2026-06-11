import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileAccessQueryDto } from './dto/file-access-query.dto';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { PresignDownloadRequestDto } from './dto/presign-download-request.dto';
import { PresignDownloadResponseDto } from './dto/presign-download-response.dto';
import { PresignUploadRequestDto } from './dto/presign-upload-request.dto';
import { PresignUploadResponseDto } from './dto/presign-upload-response.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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

  // ── Local storage driver endpoints ──────────────────────────────────────
  // S3-style semantics: no Authorization header (an <img src> can't send
  // one); the short-lived token in the query string IS the credential,
  // issued by the presign endpoints above. Only active in local mode.

  @Put('files')
  @ApiOkResponse({ type: FileUploadResponseDto })
  async uploadFile(
    @Query() query: FileAccessQueryDto,
    @Req() req: Request,
  ): Promise<FileUploadResponseDto> {
    await this.storageService.verifyFileToken(query.token, query.key, 'upload');
    const size = await this.storageService.saveLocalFile(query.key, req);
    return { key: query.key, size };
  }

  @Get('files')
  @ApiOkResponse({ description: 'Raw file contents (binary)' })
  async downloadFile(
    @Query() query: FileAccessQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.storageService.verifyFileToken(
      query.token,
      query.key,
      'download',
    );
    const path = this.storageService.getLocalFilePath(query.key);
    res.sendFile(path);
  }
}
