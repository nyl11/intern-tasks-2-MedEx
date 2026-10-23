import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentTime } from '../common/current-time.decorator';
import { CreateCheckInDto } from './dto/check-in.dto';
import { QueueService } from './queue.service';
import { Doctor, Patient, QueueResponse } from './queue.types';

@Controller('api')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * POST /api/check-ins
   * Check in a patient, assign a token, and add to waiting queue.
   */
  @Post('check-ins')
  @HttpCode(HttpStatus.CREATED)
  checkIn(
    @Body() dto: CreateCheckInDto,
    @CurrentTime() currentTime: string,
  ): Patient {
    return this.queueService.checkIn(dto, currentTime);
  }

  /**
   * POST /api/doctors/:id/call-next
   * Doctor calls the next patient in line.
   * Returns { patient: Patient | null }.
   * Throws 409 if doctor is already seeing a patient.
   */
  @Post('doctors/:id/call-next')
  @HttpCode(HttpStatus.OK)
  callNext(
    @Param('id') doctorId: string,
    @CurrentTime() currentTime: string,
  ): { patient: Patient | null } {
    return this.queueService.callNext(doctorId, currentTime);
  }

  /**
   * POST /api/doctors/:id/done
   * Doctor finishes with current patient.
   * Throws 409 if not seeing any patient.
   */
  @Post('doctors/:id/done')
  @HttpCode(HttpStatus.OK)
  done(@Param('id') doctorId: string): { success: boolean; message: string } {
    return this.queueService.done(doctorId);
  }

  /**
   * POST /api/doctors/:id/no-show
   * Doctor marks current patient as a no-show.
   * Throws 409 if not seeing any patient.
   */
  @Post('doctors/:id/no-show')
  @HttpCode(HttpStatus.OK)
  noShow(
    @Param('id') doctorId: string,
    @CurrentTime() currentTime: string,
  ): { success: boolean; message: string } {
    return this.queueService.noShow(doctorId, currentTime);
  }

  /**
   * GET /api/queue
   * Get live status: nowServing list and waiting list with positions and estimated wait times.
   */
  @Get('queue')
  getQueue(@CurrentTime() currentTime: string): QueueResponse {
    return this.queueService.getQueue(currentTime);
  }

  /**
   * GET /api/doctors
   * Get all registered doctors with their current consultation status.
   */
  @Get('doctors')
  getDoctors(): Doctor[] {
    return this.queueService.getDoctors();
  }

  /**
   * POST /api/reset
   * Reset all queue and doctor state (useful for demos and automated testing).
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset(): { success: boolean; message: string } {
    return this.queueService.reset();
  }
}
