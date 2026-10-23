import * as fs from 'fs';
import * as path from 'path';
import { QueueEngine } from './queue.engine';
import { WaitingQueueItem } from './queue.types';

describe('Bodhi Family Clinic - Queue Engine & Clinic.json Replay Suite', () => {
  let engine: QueueEngine;

  beforeEach(() => {
    engine = new QueueEngine();
  });

  describe('data/clinic.json full replay test', () => {
    it('should replay the exact example day from clinic.json and match all expected tokens, calls, and queue snapshots', () => {
      // Find clinic.json from data directory
      const clinicJsonPaths = [
        path.resolve(__dirname, '../../../data/clinic.json'),
        path.resolve(__dirname, '../../../../data/clinic.json'),
        path.resolve(__dirname, '../../data/clinic.json'),
      ];

      const foundPath = clinicJsonPaths.find((p) => fs.existsSync(p));
      expect(foundPath).toBeDefined();

      const rawData = fs.readFileSync(foundPath!, 'utf-8');
      const data = JSON.parse(rawData);

      const clinicConfig = data.clinic;
      expect(data.examples.length).toBeGreaterThan(0);

      for (const example of data.examples) {

      const queueEngine = new QueueEngine({
        averageConsultationMinutes: clinicConfig.averageConsultationMinutes,
        initialDoctors: clinicConfig.doctors,
      });

      const capturedSnapshots: { at: string; queue: WaitingQueueItem[] }[] = [];

      for (const event of example.events) {
        switch (event.type) {
          case 'check_in':
            queueEngine.checkIn(event.patient, event.at);
            break;
          case 'call_next':
            queueEngine.callNext(event.doctorId, event.at);
            break;
          case 'done':
            queueEngine.done(event.doctorId);
            break;
          case 'no_show':
            queueEngine.noShow(event.doctorId, event.at);
            break;
          case 'queue':
            const snapshot = queueEngine.getQueue(event.at);
            capturedSnapshots.push({
              at: event.at,
              queue: snapshot.waiting,
            });
            break;
          default:
            throw new Error(`Unknown event type: ${event.type}`);
        }
      }

      // 1. Verify Tokens
      const actualTokens = queueEngine.getTokensByName();
      expect(actualTokens).toEqual(example.expected.tokens);

      // 2. Verify Calls sequence and details
      const actualCalls = queueEngine.getFormattedCallHistory();
      expect(actualCalls).toEqual(example.expected.calls);

      // 3. Verify Queue snapshots (order and wait times)
      expect(capturedSnapshots.length).toBe(example.expected.queueSnapshots.length);
      for (let i = 0; i < capturedSnapshots.length; i++) {
        expect(capturedSnapshots[i].at).toBe(example.expected.queueSnapshots[i].at);
        expect(capturedSnapshots[i].queue).toEqual(example.expected.queueSnapshots[i].queue);
      }
      }
    });
  });

  describe('Edge case validations and rules', () => {
    it('treats patient checking in exactly 15 minutes late as an appointment (gets A token)', () => {
      const patient = engine.checkIn(
        {
          name: 'Punctual Borderline',
          age: 30,
          kind: 'appointment',
          appointmentTime: '2026-11-02T09:00:00+05:45',
        },
        '2026-11-02T09:15:00+05:45', // exactly 15 mins
      );
      expect(patient.token.startsWith('A-')).toBe(true);
      expect(patient.effectiveKind).toBe('appointment');
    });

    it('treats patient checking in 15 minutes and 1 second late as a walk-in (gets W token)', () => {
      const patient = engine.checkIn(
        {
          name: 'Late Patient',
          age: 30,
          kind: 'appointment',
          appointmentTime: '2026-11-02T09:00:00+05:45',
        },
        '2026-11-02T09:15:01+05:45', // > 15 mins
      );
      expect(patient.token.startsWith('W-')).toBe(true);
      expect(patient.effectiveKind).toBe('walk_in');
    });

    it('resets token counters per letter at Kathmandu midnight (Asia/Kathmandu UTC+05:45)', () => {
      // Day 1
      const p1 = engine.checkIn({ name: 'Day 1 Walkin', age: 25, kind: 'walk_in' }, '2026-11-02T23:59:00+05:45');
      expect(p1.token).toBe('W-001');

      // Day 2 (1 minute later, crosses Kathmandu midnight)
      const p2 = engine.checkIn({ name: 'Day 2 Walkin', age: 25, kind: 'walk_in' }, '2026-11-03T00:01:00+05:45');
      expect(p2.token).toBe('W-001'); // reset to 001!
    });

    it('throws 409 conflict when doctor calls next while already seeing a patient', () => {
      engine.checkIn({ name: 'First', age: 40, kind: 'walk_in' }, '2026-11-02T09:00:00+05:45');
      engine.checkIn({ name: 'Second', age: 40, kind: 'walk_in' }, '2026-11-02T09:01:00+05:45');

      engine.callNext('D1', '2026-11-02T09:05:00+05:45');
      expect(() => {
        engine.callNext('D1', '2026-11-02T09:06:00+05:45');
      }).toThrow('already seeing patient');
    });

    it('throws 409 conflict when doctor calls done or no-show without seeing a patient', () => {
      expect(() => {
        engine.done('D1');
      }).toThrow('not currently seeing any patient');

      expect(() => {
        engine.noShow('D1', '2026-11-02T09:00:00+05:45');
      }).toThrow('not currently seeing any patient');
    });

    it('prioritizes senior walk-ins (age >= 65) over younger walk-ins even if younger arrived earlier', () => {
      engine.checkIn({ name: 'Young Early', age: 25, kind: 'walk_in' }, '2026-11-02T09:00:00+05:45');
      engine.checkIn({ name: 'Senior Late', age: 72, kind: 'walk_in' }, '2026-11-02T09:05:00+05:45');

      const result = engine.callNext('D1', '2026-11-02T09:10:00+05:45');
      expect(result.patient?.name).toBe('Senior Late');
    });

    it('handles fairness rule: after 3 consecutive due appointment calls, walk-in is called next', () => {
      // 3 appointments due
      engine.checkIn(
        { name: 'Appt 1', age: 30, kind: 'appointment', appointmentTime: '2026-11-02T09:00:00+05:45' },
        '2026-11-02T08:50:00+05:45',
      );
      engine.checkIn(
        { name: 'Appt 2', age: 30, kind: 'appointment', appointmentTime: '2026-11-02T09:05:00+05:45' },
        '2026-11-02T08:50:00+05:45',
      );
      engine.checkIn(
        { name: 'Appt 3', age: 30, kind: 'appointment', appointmentTime: '2026-11-02T09:10:00+05:45' },
        '2026-11-02T08:50:00+05:45',
      );
      // Appt 4 also due
      engine.checkIn(
        { name: 'Appt 4', age: 30, kind: 'appointment', appointmentTime: '2026-11-02T09:15:00+05:45' },
        '2026-11-02T08:50:00+05:45',
      );
      // 1 walk-in waiting
      engine.checkIn({ name: 'Waiting Walkin', age: 40, kind: 'walk_in' }, '2026-11-02T08:55:00+05:45');

      // Call 1 -> Appt 1
      engine.callNext('D1', '2026-11-02T09:00:00+05:45');
      engine.done('D1');

      // Call 2 -> Appt 2
      engine.callNext('D1', '2026-11-02T09:05:00+05:45');
      engine.done('D1');

      // Call 3 -> Appt 3
      engine.callNext('D1', '2026-11-02T09:10:00+05:45');
      engine.done('D1');

      // Call 4 at 09:15: Appt 4 is due (09:15 <= 09:15 + 10m = 09:25).
      // BUT last 3 calls were due appointments! Fairness rule triggers!
      const call4 = engine.callNext('D1', '2026-11-02T09:15:00+05:45');
      expect(call4.patient?.name).toBe('Waiting Walkin');
    });

    it('removes patient from queue completely on second no-show', () => {
      engine.checkIn({ name: 'Absentee', age: 30, kind: 'walk_in' }, '2026-11-02T09:00:00+05:45');

      // 1st call
      const c1 = engine.callNext('D1', '2026-11-02T09:05:00+05:45');
      expect(c1.patient?.name).toBe('Absentee');
      // 1st no-show: goes back to queue as walk-in with same token
      engine.noShow('D1', '2026-11-02T09:10:00+05:45');

      // Queue still contains them
      const q1 = engine.getQueue('2026-11-02T09:11:00+05:45');
      expect(q1.waiting.length).toBe(1);
      expect(q1.waiting[0].name).toBe('Absentee');

      // 2nd call
      engine.callNext('D1', '2026-11-02T09:15:00+05:45');
      // 2nd no-show: permanently leaves
      engine.noShow('D1', '2026-11-02T09:16:00+05:45');

      const q2 = engine.getQueue('2026-11-02T09:20:00+05:45');
      expect(q2.waiting.length).toBe(0);

      const nextCall = engine.callNext('D1', '2026-11-02T09:25:00+05:45');
      expect(nextCall.patient).toBeNull();
    });

    it('persists queue state and survives a server restart using SQLite', () => {
      const { QueueStore } = require('./queue.store');
      const tempDbPath = path.resolve(__dirname, '../../../scratch/test_persistence.sqlite');
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }

      // 1. Initial server instance
      const store1 = new QueueStore(tempDbPath);
      const engine1 = new QueueEngine({ store: store1 });

      engine1.checkIn({ name: 'Persistent Ram', age: 45, kind: 'walk_in' }, '2026-11-02T09:00:00+05:45');
      engine1.checkIn({ name: 'Persistent Sita', age: 70, kind: 'walk_in' }, '2026-11-02T09:02:00+05:45');
      const call = engine1.callNext('D1', '2026-11-02T09:05:00+05:45');
      expect(call.patient?.name).toBe('Persistent Sita'); // senior first

      store1.close(); // Server stops / restarts

      // 2. New server instance boots up with the same database
      const store2 = new QueueStore(tempDbPath);
      const engine2 = new QueueEngine({ store: store2 });

      // Doctors state survived
      const doctors = engine2.getDoctors();
      const d1 = doctors.find((d) => d.id === 'D1');
      expect(d1?.currentPatient?.name).toBe('Persistent Sita');
      expect(d1?.currentPatient?.token).toBe('W-002');

      // Waiting queue survived
      const queue = engine2.getQueue('2026-11-02T09:06:00+05:45');
      expect(queue.waiting.length).toBe(1);
      expect(queue.waiting[0].name).toBe('Persistent Ram');
      expect(queue.waiting[0].token).toBe('W-001');

      // Next check-in preserves token numbering
      const p3 = engine2.checkIn({ name: 'Persistent Hari', age: 30, kind: 'walk_in' }, '2026-11-02T09:07:00+05:45');
      expect(p3.token).toBe('W-003');

      store2.close();
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    });
  });
});

