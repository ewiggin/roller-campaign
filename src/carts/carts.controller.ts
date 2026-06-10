import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartsService } from './carts.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import {
  ImportCartCommitDto,
  ImportCartCommitResponseDto,
  ImportCartParseResponseDto,
} from './dto/import-cart.dto';

@ApiTags('carts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('carts')
export class CartsController {
  constructor(private readonly svc: CartsService) {}

  @Get('export')
  @ApiOkResponse({ description: 'Excel with all carts' })
  async exportExcel(@Res() res: Response): Promise<void> {
    const buffer = await this.svc.exportExcel();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="carts.xlsx"',
    });
    res.send(buffer);
  }

  @Get('import/template')
  @ApiOkResponse({ description: 'Excel template for carts import' })
  downloadTemplate(@Res() res: Response): void {
    const buffer = this.svc.downloadTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-carts.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/parse')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ type: ImportCartParseResponseDto })
  parseImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportCartParseResponseDto> {
    return this.svc.parseImport(file.buffer);
  }

  @Post('import/commit')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ImportCartCommitResponseDto })
  commitImport(
    @Body() dto: ImportCartCommitDto,
  ): Promise<ImportCartCommitResponseDto> {
    return this.svc.commitImport(dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: CartResponseDto })
  create(@Body() dto: CreateCartDto): Promise<CartResponseDto> {
    return this.svc.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [CartResponseDto] })
  findAll(): Promise<CartResponseDto[]> {
    return this.svc.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: CartResponseDto })
  findOne(@Param('id') id: string): Promise<CartResponseDto> {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CartResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCartDto,
  ): Promise<CartResponseDto> {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }
}
