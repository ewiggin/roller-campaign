import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlaceDetails, PlacePrediction, PlacesService } from './places.service';

@ApiTags('places')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('places')
export class PlacesController {
  constructor(private readonly svc: PlacesService) {}

  @Get('autocomplete')
  @ApiOkResponse({ description: 'Google Places autocomplete predictions' })
  autocomplete(@Query('input') input: string): Promise<PlacePrediction[]> {
    if (!input?.trim()) throw new BadRequestException('input is required');
    return this.svc.autocomplete(input);
  }

  @Get('details')
  @ApiOkResponse({ description: 'Place details (address + coordinates)' })
  async details(@Query('place_id') placeId: string): Promise<PlaceDetails> {
    if (!placeId?.trim()) throw new BadRequestException('place_id is required');
    const result = await this.svc.details(placeId);
    if (!result) throw new NotFoundException('Place not found');
    return result;
  }
}
