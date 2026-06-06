import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VolunteerCodeTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;
}

export class VolunteerFormRegionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Costa Brava' })
  name: string;
}

export class VolunteerFormLookupResponseDto {
  @ApiProperty({ example: 'V-001' })
  volunteer_code: string;

  @ApiProperty({ example: 'Carlos López' })
  full_name: string;

  @ApiPropertyOptional({ example: 'carlos@example.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ example: '+34 600 000 000', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  car_seats: number | null;

  @ApiPropertyOptional({ example: 'Calle Mayor 1, Barcelona', nullable: true })
  hosting_address: string | null;

  @ApiPropertyOptional({ example: 41.3851, nullable: true })
  lat: number | null;

  @ApiPropertyOptional({ example: 2.1734, nullable: true })
  lng: number | null;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=41.3851,2.1734',
    nullable: true,
  })
  maps_link: string | null;

  @ApiProperty({ example: false })
  monday_morning: boolean;

  @ApiProperty({ example: false })
  monday_afternoon: boolean;

  @ApiProperty({ example: false })
  tuesday_morning: boolean;

  @ApiProperty({ example: false })
  tuesday_afternoon: boolean;

  @ApiProperty({ example: false })
  wednesday_morning: boolean;

  @ApiProperty({ example: false })
  wednesday_afternoon: boolean;

  @ApiProperty({ example: false })
  thursday_morning: boolean;

  @ApiProperty({ example: false })
  thursday_afternoon: boolean;

  @ApiProperty({ example: false })
  friday_morning: boolean;

  @ApiProperty({ example: false })
  friday_afternoon: boolean;

  @ApiProperty({ example: false })
  saturday_morning: boolean;

  @ApiProperty({ example: false })
  saturday_afternoon: boolean;

  @ApiProperty({ example: false })
  sunday_morning: boolean;

  @ApiProperty({ example: false })
  sunday_afternoon: boolean;

  @ApiProperty({ example: false })
  saturday_prev_morning: boolean;

  @ApiProperty({ example: false })
  saturday_prev_afternoon: boolean;

  @ApiProperty({ example: false })
  sunday_prev_morning: boolean;

  @ApiProperty({ example: false })
  sunday_prev_afternoon: boolean;

  @ApiProperty({ example: false })
  monday_next_morning: boolean;

  @ApiProperty({ example: false })
  monday_next_afternoon: boolean;

  @ApiProperty({ type: [VolunteerFormRegionDto] })
  regions: VolunteerFormRegionDto[];

  @ApiPropertyOptional({ example: true, nullable: true })
  terms_accepted: boolean | null;

  @ApiPropertyOptional({ example: '2026-06-01T10:30:00.000Z', nullable: true })
  terms_accepted_at: string | null;
}
