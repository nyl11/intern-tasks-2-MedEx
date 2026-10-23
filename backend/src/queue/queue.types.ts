export type PatientKind = 'appointment' | 'walk_in';

export type TokenPrefix = 'E' | 'A' | 'W';

export type PatientStatus = 'waiting' | 'seeing' | 'done' | 'no_show_left';

export type CallRule =
  | '3.1_emergency'
  | '3.2_due_appointment'
  | '3.3_walk_in'
  | '3.4_early_appointment'
  | '4_fairness_walk_in';

export interface Patient {
  id: string;
  name: string;
  age: number;
  kind: PatientKind; // original requested kind
  effectiveKind: PatientKind; // becomes walk_in if > 15m late or after 1st no-show
  appointmentTime?: string;
  isEmergency: boolean;
  token: string;
  checkInTime: string; // ISO string; updated to no-show timestamp if no-show occurs
  status: PatientStatus;
  noShowCount: number;
  seeingByDoctorId?: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  currentPatient: Patient | null;
}

export interface CallRecord {
  at: string;
  doctorId: string;
  token: string | null;
  name: string | null;
  ruleApplied?: CallRule;
  isEmergency: boolean;
}

export interface WaitingQueueItem {
  position: number;
  token: string;
  name: string;
  estimatedWaitMinutes: number;
}

export interface NowServingItem {
  doctorId: string;
  token: string;
  name: string;
}

export interface QueueResponse {
  nowServing: NowServingItem[];
  waiting: WaitingQueueItem[];
}

export interface CheckInDto {
  name: string;
  age: number;
  kind: PatientKind;
  appointmentTime?: string;
  emergency?: boolean;
}
