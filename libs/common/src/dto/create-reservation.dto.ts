import { IsEmail, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  restaurantId!: string;

  @IsUUID()
  tableId!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsInt()
  @Min(1)
  partySize!: number;

  @IsOptional()
  @IsString()
  guestName?: string;

  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
