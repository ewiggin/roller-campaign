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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { AddCoordinatorDto } from './dto/add-coordinator.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import { RegionStatsDto } from './dto/region-stats.dto';
import {
  ImportRegionCommitDto,
  ImportRegionCommitResponseDto,
  ImportRegionParseResponseDto,
} from './dto/import-region.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('regions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Get('export')
  @Roles('region_admin')
  @ApiOkResponse({ description: 'Excel con todas las regiones' })
  async exportExcel(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.regionsService.exportExcel(user);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="regiones.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @Roles('superadmin')
  @ApiOkResponse({
    description: 'Plantilla Excel para importación de regiones',
  })
  downloadTemplate(@Res() res: Response): void {
    const buffer = this.regionsService.downloadTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-regiones.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/parse')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImportRegionParseResponseDto })
  parseImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportRegionParseResponseDto> {
    return this.regionsService.parseImport(file.buffer);
  }

  @Post('import/commit')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportRegionCommitResponseDto })
  commitImport(
    @Body() dto: ImportRegionCommitDto,
  ): Promise<ImportRegionCommitResponseDto> {
    return this.regionsService.commitImport(dto);
  }

  @Post()
  @Roles('superadmin')
  @ApiCreatedResponse({ type: RegionResponseDto })
  create(@Body() dto: CreateRegionDto): Promise<RegionResponseDto> {
    return this.regionsService.create(dto);
  }

  @Get('stats')
  @Roles('region_admin')
  @ApiOkResponse({ type: [RegionStatsDto] })
  getStats(@CurrentUser() user: JwtPayload): Promise<RegionStatsDto[]> {
    return this.regionsService.getStats(user);
  }

  @Get()
  @Roles('region_admin')
  @ApiOkResponse({ type: [RegionResponseDto] })
  findAll(@CurrentUser() user: JwtPayload): Promise<RegionResponseDto[]> {
    return this.regionsService.findAll(user);
  }

  @Get(':id')
  @Roles('region_admin')
  @ApiOkResponse({ type: RegionResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegionResponseDto> {
    return this.regionsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('superadmin')
  @ApiOkResponse({ type: RegionResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<RegionResponseDto> {
    return this.regionsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.regionsService.remove(id);
  }

  @Post(':id/coordinators')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RegionResponseDto })
  addCoordinator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCoordinatorDto,
  ): Promise<RegionResponseDto> {
    return this.regionsService.addCoordinator(id, dto.userId);
  }

  @Delete(':id/coordinators/:userId')
  @Roles('superadmin')
  @ApiOkResponse({ type: RegionResponseDto })
  removeCoordinator(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<RegionResponseDto> {
    return this.regionsService.removeCoordinator(id, userId);
  }
}
