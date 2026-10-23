import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { CallRecord, Doctor, Patient, TokenPrefix } from './queue.types';

export class QueueStore {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        kind TEXT NOT NULL,
        effective_kind TEXT NOT NULL,
        appointment_time TEXT,
        is_emergency INTEGER NOT NULL,
        token TEXT NOT NULL,
        check_in_time TEXT NOT NULL,
        status TEXT NOT NULL,
        no_show_count INTEGER NOT NULL,
        seeing_by_doctor_id TEXT
      );

      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        current_patient_id TEXT
      );

      CREATE TABLE IF NOT EXISTS token_counters (
        day_string TEXT NOT NULL,
        prefix TEXT NOT NULL,
        count INTEGER NOT NULL,
        PRIMARY KEY (day_string, prefix)
      );

      CREATE TABLE IF NOT EXISTS call_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        token TEXT,
        name TEXT,
        rule_applied TEXT,
        is_emergency INTEGER NOT NULL
      );
    `);
  }

  public savePatient(p: Patient): void {
    const stmt = this.db.prepare(`
      INSERT INTO patients (
        id, name, age, kind, effective_kind, appointment_time,
        is_emergency, token, check_in_time, status, no_show_count, seeing_by_doctor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        age = excluded.age,
        kind = excluded.kind,
        effective_kind = excluded.effective_kind,
        appointment_time = excluded.appointment_time,
        is_emergency = excluded.is_emergency,
        token = excluded.token,
        check_in_time = excluded.check_in_time,
        status = excluded.status,
        no_show_count = excluded.no_show_count,
        seeing_by_doctor_id = excluded.seeing_by_doctor_id;
    `);
    stmt.run(
      p.id,
      p.name,
      p.age,
      p.kind,
      p.effectiveKind,
      p.appointmentTime ?? null,
      p.isEmergency ? 1 : 0,
      p.token,
      p.checkInTime,
      p.status,
      p.noShowCount,
      p.seeingByDoctorId ?? null,
    );
  }

  public saveDoctor(doc: Doctor): void {
    const stmt = this.db.prepare(`
      INSERT INTO doctors (id, name, current_patient_id)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        current_patient_id = excluded.current_patient_id;
    `);
    stmt.run(doc.id, doc.name, doc.currentPatient ? doc.currentPatient.id : null);
  }

  public saveTokenCounter(dayString: string, prefix: TokenPrefix, count: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO token_counters (day_string, prefix, count)
      VALUES (?, ?, ?)
      ON CONFLICT(day_string, prefix) DO UPDATE SET
        count = excluded.count;
    `);
    stmt.run(dayString, prefix, count);
  }

  public saveCallRecord(record: CallRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO call_history (at, doctor_id, token, name, rule_applied, is_emergency)
      VALUES (?, ?, ?, ?, ?, ?);
    `);
    stmt.run(
      record.at,
      record.doctorId,
      record.token ?? null,
      record.name ?? null,
      record.ruleApplied ?? null,
      record.isEmergency ? 1 : 0,
    );
  }

  public loadAllState(): {
    patients: Map<string, Patient>;
    doctors: Map<string, Doctor>;
    tokenCounters: Map<string, Map<TokenPrefix, number>>;
    callHistory: CallRecord[];
  } {
    const patients = new Map<string, Patient>();
    const patientRows = this.db.prepare('SELECT * FROM patients').all() as any[];
    for (const r of patientRows) {
      patients.set(r.id, {
        id: r.id,
        name: r.name,
        age: Number(r.age),
        kind: r.kind,
        effectiveKind: r.effective_kind,
        appointmentTime: r.appointment_time || undefined,
        isEmergency: Boolean(r.is_emergency),
        token: r.token,
        checkInTime: r.check_in_time,
        status: r.status,
        noShowCount: Number(r.no_show_count),
        seeingByDoctorId: r.seeing_by_doctor_id || null,
      });
    }

    const doctors = new Map<string, Doctor>();
    const doctorRows = this.db.prepare('SELECT * FROM doctors').all() as any[];
    for (const d of doctorRows) {
      doctors.set(d.id, {
        id: d.id,
        name: d.name,
        currentPatient: d.current_patient_id ? patients.get(d.current_patient_id) ?? null : null,
      });
    }

    const tokenCounters = new Map<string, Map<TokenPrefix, number>>();
    const tokenRows = this.db.prepare('SELECT * FROM token_counters').all() as any[];
    for (const t of tokenRows) {
      if (!tokenCounters.has(t.day_string)) {
        tokenCounters.set(t.day_string, new Map<TokenPrefix, number>());
      }
      tokenCounters.get(t.day_string)!.set(t.prefix as TokenPrefix, Number(t.count));
    }

    const callRows = this.db.prepare('SELECT * FROM call_history ORDER BY id ASC').all() as any[];
    const callHistory: CallRecord[] = callRows.map((c) => ({
      at: c.at,
      doctorId: c.doctor_id,
      token: c.token,
      name: c.name,
      ruleApplied: c.rule_applied || undefined,
      isEmergency: Boolean(c.is_emergency),
    }));

    return {
      patients,
      doctors,
      tokenCounters,
      callHistory,
    };
  }

  public clearAll(): void {
    this.db.exec(`
      DELETE FROM patients;
      DELETE FROM doctors;
      DELETE FROM token_counters;
      DELETE FROM call_history;
    `);
  }

  public close(): void {
    this.db.close();
  }
}
