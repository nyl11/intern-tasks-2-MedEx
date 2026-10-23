export type PatientKind = 'appointment' | 'walk_in';

export interface Patient {
  id: string;
  name: string;
  age: number;
  kind: PatientKind;
  effectiveKind: PatientKind;
  appointmentTime?: string;
  isEmergency: boolean;
  token: string;
  checkInTime: string;
  status: 'waiting' | 'seeing' | 'done' | 'no_show_left';
  noShowCount: number;
  seeingByDoctorId?: string | null;
}

export interface NowServingItem {
  doctorId: string;
  token: string;
  name: string;
}

export interface WaitingQueueItem {
  position: number;
  token: string;
  name: string;
  estimatedWaitMinutes: number;
}

export interface QueueResponse {
  nowServing: NowServingItem[];
  waiting: WaitingQueueItem[];
}

export interface Doctor {
  id: string;
  name: string;
  currentPatient: Patient | null;
}

export interface CheckInFormData {
  name: string;
  age: number | '';
  kind: PatientKind;
  appointmentTime?: string;
  emergency?: boolean;
}
