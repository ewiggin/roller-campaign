import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CaptainActivityResponseDto } from './dto/captain-activity-response.dto';
import { GroupLookupResponseDto } from './dto/group-lookup-response.dto';
import { GroupAccessService } from './group-access.service';

@ApiTags('group-access')
@Controller('group-access')
export class GroupAccessController {
  constructor(private readonly service: GroupAccessService) {}

  @Get('lookup')
  @ApiOkResponse({ type: GroupLookupResponseDto })
  @ApiNotFoundResponse({ description: 'Código de grupo no encontrado' })
  lookup(@Query('code') code: string): Promise<GroupLookupResponseDto> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.service.lookup(code);
  }

  @Get('activities')
  @ApiOkResponse({ type: [CaptainActivityResponseDto] })
  @ApiNotFoundResponse({ description: 'Código de grupo no encontrado' })
  getActivities(
    @Query('code') code: string,
  ): Promise<CaptainActivityResponseDto[]> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.service.getActivities(code);
  }

  @Post('activities/:id/enroll')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'El aforo está completo' })
  enroll(
    @Param('id') activityId: string,
    @Query('code') code: string,
  ): Promise<void> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.service.enroll(code, activityId);
  }

  @Delete('activities/:id/enroll')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  unenroll(
    @Param('id') activityId: string,
    @Query('code') code: string,
  ): Promise<void> {
    if (!code) throw new NotFoundException('Código requerido');
    return this.service.unenroll(code, activityId);
  }
}
