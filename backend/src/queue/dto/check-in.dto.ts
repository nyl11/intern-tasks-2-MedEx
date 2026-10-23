import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PatientKind } from '../queue.types';

export class CreateCheckInDto {
  @IsString({ message: 'Patient name must be a string' })
  @IsNotEmpty({ message: 'Patient name is required' })
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'Age must be an integer' })
  @Min(0, { message: 'Age must be at least 0' })
  @Max(120, { message: 'Age must be at most 120' })
  age: number;

  @IsIn(['appointment', 'walk_in'], { message: "kind must be either 'appointment' or 'walk_in'" })
  kind: PatientKind;

  @ValidateIf((o) => o.kind === 'appointment')
  @IsNotEmpty({ message: 'An appointment needs appointmentTime' })
  @IsString({ message: 'appointmentTime must be an ISO date string' })
  @IsISO8601({ strict: true }, { message: 'appointmentTime must be a valid ISO 8601 date' })
  appointmentTime?: string;

  @IsOptional()
  @IsBoolean({ message: 'emergency must be a boolean' })
  emergency?: boolean;
}
