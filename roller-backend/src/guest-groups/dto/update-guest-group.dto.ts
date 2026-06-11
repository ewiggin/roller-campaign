import { PartialType } from '@nestjs/swagger';
import { CreateGuestGroupDto } from './create-guest-group.dto';

export class UpdateGuestGroupDto extends PartialType(CreateGuestGroupDto) {}
