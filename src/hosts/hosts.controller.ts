import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HostsService } from './hosts.service';
import {
  CreateHostDto,
  UpdateHostDto,
  HostResponseDto,
  GroupSuggestionsResponseDto,
} from './dto/host.dto';
import {
  ImportHostCommitDto,
  ImportHostCommitResponseDto,
  ImportHostParseResponseDto,
} from './dto/import-host.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('hosts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hosts')
export class HostsController {
  constructor(private readonly service: HostsService) {}

  @Get('export')
  @ApiOkResponse({ description: 'Excel con todas las congregaciones' })
  async exportExcel(
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.exportExcel(regionId, user);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="congregaciones.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @ApiOkResponse({
    description: 'Plantilla Excel para importación de congregaciones',
  })
  downloadTemplate(@Res() res: Response): void {
    const buffer = this.service.downloadTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="plantilla-congregaciones.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/parse')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImportHostParseResponseDto })
  parseImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportHostParseResponseDto> {
    return this.service.parseImport(file.buffer);
  }

  @Post('import/commit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportHostCommitResponseDto })
  commitImport(
    @Body() dto: ImportHostCommitDto,
  ): Promise<ImportHostCommitResponseDto> {
    return this.service.commitImport(dto);
  }

  @Post()
  @ApiCreatedResponse({ type: HostResponseDto })
  create(
    @Body() dto: CreateHostDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto> {
    return this.service.create(dto, user);
  }

  @Get(':id')
  @ApiOkResponse({ type: HostResponseDto })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto> {
    return this.service.getOne(id, user);
  }

  @Get(':id/group-suggestions')
  @ApiOkResponse({ type: GroupSuggestionsResponseDto })
  getGroupSuggestions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GroupSuggestionsResponseDto> {
    return this.service.getGroupSuggestions(id, user);
  }

  @Get()
  @ApiOkResponse({ type: [HostResponseDto] })
  findAll(
    @Query('regionId') regionId: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto[]> {
    return this.service.findAll(regionId, user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: HostResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHostDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<HostResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Get(':id/guests/export')
  @ApiOkResponse({ description: 'Excel con invitados asignados al host' })
  async exportGuests(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportGuestsByHost(
      id,
      user,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
