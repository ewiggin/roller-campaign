import { ApiProperty } from '@nestjs/swagger';

export class GuestFormLookupResponseDto {
  @ApiProperty({ example: 'ABCD-1234' })
  guest_code: string;

  @ApiProperty({ example: 'Costa Brava' })
  region_name: string;
}
