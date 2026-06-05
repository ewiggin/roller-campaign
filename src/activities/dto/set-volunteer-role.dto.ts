import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SetVolunteerRoleDto {
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  role_id: string | null;
}
