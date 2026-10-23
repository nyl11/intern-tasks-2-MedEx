import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalHttpExceptionFilter } from '../src/common/http-exception.filter';

describe('Clinic Queue API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Use an in-memory SQLite database for clean test isolation
    process.env.DB_PATH = ':memory:';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await request(app.getHttpServer()).post('/api/reset').expect(200);
  });

  describe('Input Validation on POST /api/check-ins', () => {
    it('returns 400 when name is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: '', age: 30, kind: 'walk_in' })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('name is required');
    });

    it('returns 400 when age is negative or greater than 120', async () => {
      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Invalid Age', age: -5, kind: 'walk_in' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Too Old', age: 125, kind: 'walk_in' })
        .expect(400);
    });

    it('returns 400 when appointment kind is missing appointmentTime', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Ram', age: 30, kind: 'appointment' })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('An appointment needs appointmentTime');
    });

    it('successfully checks in a valid appointment patient and returns 201 with token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/check-ins')
        .set('X-Now', '2026-11-02T08:50:00+05:45')
        .send({
          name: 'Ram',
          age: 45,
          kind: 'appointment',
          appointmentTime: '2026-11-02T09:00:00+05:45',
        })
        .expect(201);

      expect(res.body.token).toBe('A-001');
      expect(res.body.name).toBe('Ram');
      expect(res.body.status).toBe('waiting');
    });

    it('successfully checks in an emergency patient with E token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/check-ins')
        .set('X-Now', '2026-11-02T09:05:00+05:45')
        .send({
          name: 'Bikash',
          age: 25,
          kind: 'walk_in',
          emergency: true,
        })
        .expect(201);

      expect(res.body.token).toBe('E-001');
      expect(res.body.isEmergency).toBe(true);
    });
  });

  describe('Doctor Workflow & 409 Conflict Handling', () => {
    it('returns 409 when doctor tries to call next while already seeing a patient', async () => {
      // Check in two patients
      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Patient 1', age: 30, kind: 'walk_in' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Patient 2', age: 30, kind: 'walk_in' })
        .expect(201);

      // D1 calls first patient
      const call1 = await request(app.getHttpServer())
        .post('/api/doctors/D1/call-next')
        .expect(200);

      expect(call1.body.patient.name).toBe('Patient 1');

      // D1 calls again without finishing -> 409 Conflict
      const callConflict = await request(app.getHttpServer())
        .post('/api/doctors/D1/call-next')
        .expect(409);

      expect(callConflict.body.statusCode).toBe(409);
      expect(callConflict.body.message).toContain('already seeing patient');
    });

    it('returns 409 when doctor calls done or no-show while idle', async () => {
      const doneConflict = await request(app.getHttpServer())
        .post('/api/doctors/D1/done')
        .expect(409);

      expect(doneConflict.body.statusCode).toBe(409);
      expect(doneConflict.body.message).toContain('not currently seeing any patient');

      const noShowConflict = await request(app.getHttpServer())
        .post('/api/doctors/D1/no-show')
        .expect(409);

      expect(noShowConflict.body.statusCode).toBe(409);
      expect(noShowConflict.body.message).toContain('not currently seeing any patient');
    });

    it('allows doctor to complete Done and call next patient', async () => {
      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Patient 1', age: 30, kind: 'walk_in' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/check-ins')
        .send({ name: 'Patient 2', age: 30, kind: 'walk_in' })
        .expect(201);

      // Call Patient 1
      await request(app.getHttpServer()).post('/api/doctors/D1/call-next').expect(200);

      // Finish with Patient 1
      await request(app.getHttpServer()).post('/api/doctors/D1/done').expect(200);

      // Call Patient 2 -> Succeeds
      const call2 = await request(app.getHttpServer())
        .post('/api/doctors/D1/call-next')
        .expect(200);

      expect(call2.body.patient.name).toBe('Patient 2');
    });
  });

  describe('GET /api/queue status and X-Now header', () => {
    it('returns correct nowServing and waiting list structure with estimatedWaitMinutes', async () => {
      // Check in two patients
      await request(app.getHttpServer())
        .post('/api/check-ins')
        .set('X-Now', '2026-11-02T09:00:00+05:45')
        .send({ name: 'Anil', age: 68, kind: 'walk_in' });

      await request(app.getHttpServer())
        .post('/api/check-ins')
        .set('X-Now', '2026-11-02T09:01:00+05:45')
        .send({ name: 'Hari', age: 30, kind: 'walk_in' });

      // D1 calls Anil
      await request(app.getHttpServer())
        .post('/api/doctors/D1/call-next')
        .set('X-Now', '2026-11-02T09:05:00+05:45')
        .expect(200);

      const queueRes = await request(app.getHttpServer())
        .get('/api/queue')
        .set('X-Now', '2026-11-02T09:06:00+05:45')
        .expect(200);

      expect(queueRes.body).toHaveProperty('nowServing');
      expect(queueRes.body).toHaveProperty('waiting');

      expect(queueRes.body.nowServing.length).toBe(1);
      expect(queueRes.body.nowServing[0]).toEqual({
        doctorId: 'D1',
        token: 'W-001',
        name: 'Anil',
      });

      expect(queueRes.body.waiting.length).toBe(1);
      expect(queueRes.body.waiting[0]).toEqual({
        position: 0,
        token: 'W-002',
        name: 'Hari',
        estimatedWaitMinutes: 0,
      });
    });

    it('returns patient: null when nobody is waiting', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/doctors/D1/call-next')
        .expect(200);

      expect(res.body.patient).toBeNull();
    });
  });
});
