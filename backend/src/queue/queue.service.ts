import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { QueueEngine } from './queue.engine';
import { QueueStore } from './queue.store';
import { CheckInDto, Doctor, Patient, QueueResponse } from './queue.types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly engine: QueueEngine;
  private readonly store: QueueStore;

  constructor() {
    const dbPath =
      process.env.DB_PATH ||
      path.resolve(__dirname, '../../data/clinic_queue.sqlite');

    this.store = new QueueStore(dbPath);

    this.engine = new QueueEngine({
      averageConsultationMinutes: 12,
      initialDoctors: [
        { id: 'D1', name: 'Dr. S. Karki' },
        { id: 'D2', name: 'Dr. R. Joshi' },
      ],
      store: this.store,
    });
  }

  public checkIn(dto: CheckInDto, currentTime: string): Patient {
    return this.engine.checkIn(dto, currentTime);
  }

  public callNext(doctorId: string, currentTime: string): { patient: Patient | null } {
    return this.engine.callNext(doctorId, currentTime);
  }

  public done(doctorId: string): { success: boolean; message: string } {
    this.engine.done(doctorId);
    return { success: true, message: `Doctor ${doctorId} marked consultation as done.` };
  }

  public noShow(doctorId: string, currentTime: string): { success: boolean; message: string } {
    this.engine.noShow(doctorId, currentTime);
    return { success: true, message: `Doctor ${doctorId} marked patient as no-show.` };
  }

  public getQueue(currentTime: string): QueueResponse {
    return this.engine.getQueue(currentTime);
  }

  public getDoctors(): Doctor[] {
    return this.engine.getDoctors();
  }

  public reset(): { success: boolean; message: string } {
    this.engine.reset();
    return { success: true, message: 'Queue and doctor state have been reset.' };
  }

  public replay(untilTime?: string): { success: boolean; message: string; count: number } {
    const clinicJsonPaths = [
      path.resolve(__dirname, '../../../data/clinic.json'),
      path.resolve(__dirname, '../../../../data/clinic.json'),
      path.resolve(__dirname, '../../data/clinic.json'),
    ];
    const foundPath = clinicJsonPaths.find((p: string) => fs.existsSync(p));
    if (!foundPath) {
      throw new Error('clinic.json file not found');
    }
    const data = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));
    this.engine.reset();
    let count = 0;
    if (data.examples && data.examples.length > 0) {
      for (const event of data.examples[0].events) {
        if (untilTime && event.at > untilTime) break;
        switch (event.type) {
          case 'check_in':
            this.engine.checkIn(event.patient, event.at);
            count++;
            break;
          case 'call_next':
            this.engine.callNext(event.doctorId, event.at);
            count++;
            break;
          case 'done':
            this.engine.done(event.doctorId);
            count++;
            break;
          case 'no_show':
            this.engine.noShow(event.doctorId, event.at);
            count++;
            break;
        }
      }
    }
    return {
      success: true,
      message: `Replayed ${count} clinic events up to ${untilTime || 'full day'}.`,
      count,
    };
  }

  onModuleDestroy() {
    this.store.close();
  }
}
