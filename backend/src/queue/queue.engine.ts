import {
  formatKathmanduHHmm,
  getKathmanduDayString,
  isAppointmentDue,
  isMoreThan15MinutesLate,
  parseDate,
} from '../common/time.util';
import {
  CallRecord,
  CallRule,
  CheckInDto,
  Doctor,
  NowServingItem,
  Patient,
  PatientKind,
  QueueResponse,
  TokenPrefix,
  WaitingQueueItem,
} from './queue.types';
import { QueueStore } from './queue.store';

export class QueueConflictException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueConflictException';
  }
}

export class QueueValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueValidationException';
  }
}

export interface QueueEngineOptions {
  averageConsultationMinutes?: number;
  initialDoctors?: { id: string; name: string }[];
  store?: QueueStore;
}

export class QueueEngine {
  private readonly averageConsultationMinutes: number;
  private readonly store?: QueueStore;
  private doctors: Map<string, Doctor> = new Map();
  private patients: Map<string, Patient> = new Map();
  private tokenCounters: Map<string, Map<TokenPrefix, number>> = new Map(); // dayString -> { E: 0, A: 0, W: 0 }
  private callHistory: CallRecord[] = [];
  private nextPatientId = 1;

  constructor(options?: QueueEngineOptions) {
    this.averageConsultationMinutes = options?.averageConsultationMinutes ?? 12;
    this.store = options?.store;

    const initialDoctors = options?.initialDoctors ?? [
      { id: 'D1', name: 'Dr. S. Karki' },
      { id: 'D2', name: 'Dr. R. Joshi' },
    ];

    if (this.store) {
      const persisted = this.store.loadAllState();
      this.patients = persisted.patients;
      this.doctors = persisted.doctors;
      this.tokenCounters = persisted.tokenCounters;
      this.callHistory = persisted.callHistory;

      // Seed doctors if none exist in store
      if (this.doctors.size === 0) {
        for (const doc of initialDoctors) {
          const docEntity = {
            id: doc.id,
            name: doc.name,
            currentPatient: null,
          };
          this.doctors.set(doc.id, docEntity);
          this.store.saveDoctor(docEntity);
        }
      }

      // Calculate nextPatientId
      for (const key of this.patients.keys()) {
        const num = parseInt(key.replace('p_', ''), 10);
        if (!isNaN(num) && num >= this.nextPatientId) {
          this.nextPatientId = num + 1;
        }
      }
    } else {
      for (const doc of initialDoctors) {
        this.doctors.set(doc.id, {
          id: doc.id,
          name: doc.name,
          currentPatient: null,
        });
      }
    }
  }

  /**
   * Reset all state (useful for test isolation)
   */
  public reset(initialDoctors?: { id: string; name: string }[]): void {
    if (this.store) {
      this.store.clearAll();
    }
    this.doctors.clear();
    this.patients.clear();
    this.tokenCounters.clear();
    this.callHistory = [];
    this.nextPatientId = 1;

    const docs = initialDoctors ?? [
      { id: 'D1', name: 'Dr. S. Karki' },
      { id: 'D2', name: 'Dr. R. Joshi' },
    ];
    for (const doc of docs) {
      const docEntity = {
        id: doc.id,
        name: doc.name,
        currentPatient: null,
      };
      this.doctors.set(doc.id, docEntity);
      if (this.store) {
        this.store.saveDoctor(docEntity);
      }
    }
  }

  /**
   * Get or initialize token counter for a given Kathmandu local calendar day
   */
  private getNextToken(prefix: TokenPrefix, time: string | Date): string {
    const day = getKathmanduDayString(time);
    if (!this.tokenCounters.has(day)) {
      this.tokenCounters.set(day, new Map<TokenPrefix, number>());
    }
    const dayCounters = this.tokenCounters.get(day)!;
    const current = dayCounters.get(prefix) ?? 0;
    const next = current + 1;
    dayCounters.set(prefix, next);
    if (this.store) {
      this.store.saveTokenCounter(day, prefix, next);
    }

    const formattedNumber = String(next).padStart(3, '0');
    return `${prefix}-${formattedNumber}`;
  }

  /**
   * Validate and perform check-in
   */
  public checkIn(dto: CheckInDto, checkInTime: string | Date): Patient {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new QueueValidationException('Patient name is required.');
    }
    if (typeof dto.age !== 'number' || dto.age < 0 || dto.age > 120) {
      throw new QueueValidationException('Patient age must be between 0 and 120.');
    }
    if (dto.kind === 'appointment' && !dto.appointmentTime) {
      throw new QueueValidationException('Appointment requires an appointmentTime.');
    }

    const checkInIso = parseDate(checkInTime).toISOString();
    const isEmergency = Boolean(dto.emergency);

    let effectiveKind: PatientKind = dto.kind;
    let tokenPrefix: TokenPrefix = 'W';

    if (isEmergency) {
      tokenPrefix = 'E';
    } else if (dto.kind === 'appointment') {
      const isLate = isMoreThan15MinutesLate(dto.appointmentTime!, checkInTime);
      if (isLate) {
        effectiveKind = 'walk_in';
        tokenPrefix = 'W';
      } else {
        effectiveKind = 'appointment';
        tokenPrefix = 'A';
      }
    } else {
      effectiveKind = 'walk_in';
      tokenPrefix = 'W';
    }

    const token = this.getNextToken(tokenPrefix, checkInTime);
    const patientId = `p_${this.nextPatientId++}`;

    const patient: Patient = {
      id: patientId,
      name: dto.name.trim(),
      age: dto.age,
      kind: dto.kind,
      effectiveKind,
      appointmentTime: dto.appointmentTime,
      isEmergency,
      token,
      checkInTime: checkInIso,
      status: 'waiting',
      noShowCount: 0,
      seeingByDoctorId: null,
    };

    this.patients.set(patientId, patient);
    if (this.store) {
      this.store.savePatient(patient);
    }
    return patient;
  }

  /**
   * Internal pure helper to select the next patient from an active waiting pool
   */
  private selectNextPatientFromPool(
    waitingPool: Patient[],
    history: CallRecord[],
    currentTime: string | Date,
  ): { patient: Patient; ruleApplied: CallRule } | null {
    if (waitingPool.length === 0) {
      return null;
    }

    // 1. Emergencies first, ordered by check-in time
    const emergencies = waitingPool
      .filter((p) => p.isEmergency)
      .sort((a, b) => parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime());

    if (emergencies.length > 0) {
      return {
        patient: emergencies[0],
        ruleApplied: '3.1_emergency',
      };
    }

    // Helper to get ordered walk-ins (>= 65 first, then others, sorted by check-in time)
    const getOrderedWalkIns = (): Patient[] => {
      const walkIns = waitingPool.filter((p) => p.effectiveKind === 'walk_in' && !p.isEmergency);
      const seniors = walkIns
        .filter((p) => p.age >= 65)
        .sort((a, b) => parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime());
      const others = walkIns
        .filter((p) => p.age < 65)
        .sort((a, b) => parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime());
      return [...seniors, ...others];
    };

    // Helper to get ordered due appointments
    const getOrderedDueAppointments = (): Patient[] => {
      return waitingPool
        .filter(
          (p) =>
            p.effectiveKind === 'appointment' &&
            !p.isEmergency &&
            p.appointmentTime &&
            isAppointmentDue(p.appointmentTime, currentTime),
        )
        .sort((a, b) => {
          const apptDiff = parseDate(a.appointmentTime!).getTime() - parseDate(b.appointmentTime!).getTime();
          if (apptDiff !== 0) return apptDiff;
          return parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime();
        });
    };

    // 2. Check Fairness Rule 4:
    // "If the last 3 calls, ignoring emergencies and counting both doctors,
    // were all made under rule 3.2 (due appointments), and a walk-in is waiting,
    // call the walk-in instead of the next due appointment."
    const nonEmergencyCalls = history.filter((c) => !c.isEmergency);
    const lastThreeNonEmergency = nonEmergencyCalls.slice(-3);
    const isFairnessActive =
      lastThreeNonEmergency.length === 3 &&
      lastThreeNonEmergency.every((c) => c.ruleApplied === '3.2_due_appointment');

    const orderedWalkIns = getOrderedWalkIns();
    const orderedDueAppts = getOrderedDueAppointments();

    if (isFairnessActive && orderedWalkIns.length > 0) {
      return {
        patient: orderedWalkIns[0],
        ruleApplied: '4_fairness_walk_in',
      };
    }

    // 3. Due appointments (Rule 3.2)
    if (orderedDueAppts.length > 0) {
      return {
        patient: orderedDueAppts[0],
        ruleApplied: '3.2_due_appointment',
      };
    }

    // 4. Walk-ins (Rule 3.3)
    if (orderedWalkIns.length > 0) {
      return {
        patient: orderedWalkIns[0],
        ruleApplied: '3.3_walk_in',
      };
    }

    // 5. Early appointments (Rule 3.4)
    // "If nobody above is waiting, the appointment with the earliest appointment time, even though it isn't due yet."
    const earlyAppts = waitingPool
      .filter(
        (p) =>
          p.effectiveKind === 'appointment' &&
          !p.isEmergency &&
          p.appointmentTime &&
          !isAppointmentDue(p.appointmentTime, currentTime),
      )
      .sort((a, b) => {
        const apptDiff = parseDate(a.appointmentTime!).getTime() - parseDate(b.appointmentTime!).getTime();
        if (apptDiff !== 0) return apptDiff;
        return parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime();
      });

    if (earlyAppts.length > 0) {
      return {
        patient: earlyAppts[0],
        ruleApplied: '3.4_early_appointment',
      };
    }

    return null;
  }

  /**
   * Doctor presses Call Next
   */
  public callNext(doctorId: string, currentTime: string | Date): { patient: Patient | null } {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) {
      throw new QueueConflictException(`Doctor ${doctorId} does not exist.`);
    }
    if (doctor.currentPatient) {
      throw new QueueConflictException(
        `Doctor ${doctorId} is already seeing patient ${doctor.currentPatient.token} (${doctor.currentPatient.name}). Must call Done or No-show first.`,
      );
    }

    const waitingPool = Array.from(this.patients.values()).filter((p) => p.status === 'waiting');
    const selected = this.selectNextPatientFromPool(waitingPool, this.callHistory, currentTime);

    const callAtIso = parseDate(currentTime).toISOString();

    if (!selected) {
      // Record empty call in history
      const emptyRecord: CallRecord = {
        at: callAtIso,
        doctorId,
        token: null,
        name: null,
        isEmergency: false,
      };
      this.callHistory.push(emptyRecord);
      if (this.store) {
        this.store.saveCallRecord(emptyRecord);
      }
      return { patient: null };
    }

    const patient = selected.patient;
    patient.status = 'seeing';
    patient.seeingByDoctorId = doctorId;
    doctor.currentPatient = patient;

    const callRecord: CallRecord = {
      at: callAtIso,
      doctorId,
      token: patient.token,
      name: patient.name,
      ruleApplied: selected.ruleApplied,
      isEmergency: patient.isEmergency,
    };
    this.callHistory.push(callRecord);

    if (this.store) {
      this.store.savePatient(patient);
      this.store.saveDoctor(doctor);
      this.store.saveCallRecord(callRecord);
    }

    return { patient };
  }

  /**
   * Doctor marks current patient as Done
   */
  public done(doctorId: string): void {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) {
      throw new QueueConflictException(`Doctor ${doctorId} does not exist.`);
    }
    if (!doctor.currentPatient) {
      throw new QueueConflictException(`Doctor ${doctorId} is not currently seeing any patient.`);
    }

    const patient = doctor.currentPatient;
    patient.status = 'done';
    patient.seeingByDoctorId = null;
    doctor.currentPatient = null;

    if (this.store) {
      this.store.savePatient(patient);
      this.store.saveDoctor(doctor);
    }
  }

  /**
   * Doctor marks current patient as No-Show
   */
  public noShow(doctorId: string, currentTime: string | Date): void {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) {
      throw new QueueConflictException(`Doctor ${doctorId} does not exist.`);
    }
    if (!doctor.currentPatient) {
      throw new QueueConflictException(`Doctor ${doctorId} is not currently seeing any patient.`);
    }

    const patient = doctor.currentPatient;
    patient.noShowCount += 1;
    doctor.currentPatient = null;
    patient.seeingByDoctorId = null;

    if (patient.noShowCount === 1) {
      // Rule 5: First time: patient goes back to queue as walk-in.
      // Keeps token, check-in time becomes time of no-show.
      patient.effectiveKind = 'walk_in';
      patient.checkInTime = parseDate(currentTime).toISOString();
      patient.status = 'waiting';
    } else {
      // Second time: leaves the queue
      patient.status = 'no_show_left';
    }

    if (this.store) {
      this.store.savePatient(patient);
      this.store.saveDoctor(doctor);
    }
  }

  /**
   * Calculate live queue view (nowServing and waiting list with wait times)
   */
  public getQueue(currentTime: string | Date): QueueResponse {
    const numDoctors = this.doctors.size || 1;

    // 1. Now Serving
    const nowServing: NowServingItem[] = [];
    for (const doc of this.doctors.values()) {
      if (doc.currentPatient) {
        nowServing.push({
          doctorId: doc.id,
          token: doc.currentPatient.token,
          name: doc.currentPatient.name,
        });
      }
    }

    // 2. Projected Waiting Queue:
    // "the queue shows waiting patients in the order they would be called if the doctors
    // kept pressing Call next right now, applying rules 3 and 4."
    const waitingPool = Array.from(this.patients.values())
      .filter((p) => p.status === 'waiting')
      .map((p) => ({ ...p })); // clone to avoid mutation during simulation

    const simulatedHistory = [...this.callHistory];
    const orderedWaitingPatients: Patient[] = [];

    while (waitingPool.length > 0) {
      const next = this.selectNextPatientFromPool(waitingPool, simulatedHistory, currentTime);
      if (!next) {
        break;
      }
      orderedWaitingPatients.push(next.patient);
      simulatedHistory.push({
        at: parseDate(currentTime).toISOString(),
        doctorId: 'SIM',
        token: next.patient.token,
        name: next.patient.name,
        ruleApplied: next.ruleApplied,
        isEmergency: next.patient.isEmergency,
      });

      const idx = waitingPool.findIndex((p) => p.id === next.patient.id);
      if (idx !== -1) {
        waitingPool.splice(idx, 1);
      }
    }

    // Calculate waiting times:
    // "each patient's estimate is floor(position / number of doctors) * 12 minutes"
    const waiting: WaitingQueueItem[] = orderedWaitingPatients.map((p, position) => {
      const estimatedWaitMinutes = Math.floor(position / numDoctors) * this.averageConsultationMinutes;
      return {
        position,
        token: p.token,
        name: p.name,
        estimatedWaitMinutes,
      };
    });

    return {
      nowServing,
      waiting,
    };
  }

  /**
   * Get all registered doctors and their current status
   */
  public getDoctors(): Doctor[] {
    return Array.from(this.doctors.values());
  }

  /**
   * Get complete call history (useful for tests and audits)
   */
  public getCallHistory(): CallRecord[] {
    return [...this.callHistory];
  }

  /**
   * Get formatted call history for clinic.json comparison:
   * { at: "09:00", doctorId: "D1", token: "A-001", name: "Ram" }
   */
  public getFormattedCallHistory(): { at: string; doctorId: string; token: string | null; name: string | null }[] {
    return this.callHistory.map((c) => ({
      at: formatKathmanduHHmm(c.at),
      doctorId: c.doctorId,
      token: c.token,
      name: c.name,
    }));
  }

  /**
   * Get snapshot of tokens assigned to patients by name
   */
  public getTokensByName(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const patient of this.patients.values()) {
      result[patient.name] = patient.token;
    }
    return result;
  }
}
