# Bodhi Family Clinic — Queue & Token Management System
### MedEx Full-Stack Intern Take-Home Exercise (Task 2)

A resilient, deterministic clinic queue and token calling system built for **Bodhi Family Clinic** in Kathmandu, Nepal. The system provides fair patient scheduling, doctor consultation terminals, and a real-time waiting room TV display.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [How to Run Both Parts](#how-to-run-both-parts)
4. [Running Automated Tests](#running-automated-tests)
5. [Queue Logic & Business Rules](#queue-logic--business-rules)
6. [Time Testing & Simulation (`X-Now`)](#time-testing--simulation-x-now)
7. [API Endpoints](#api-endpoints)
8. [What I Would Improve with More Time](#what-i-would-improve-with-more-time)
9. [AI Tools Disclosure](#ai-tools-disclosure)

---

## Architecture Overview

- **Backend**: **NestJS + TypeScript**
  - Modular architecture (`QueueModule`, `QueueEngine`, `QueueStore`).
  - Native SQLite persistence via Node's built-in `node:sqlite` (zero native-compilation dependencies, survives server restarts).
  - Timezone calculations powered by **Luxon** (`Asia/Kathmandu`, `UTC+05:45`).
  - Robust DTO validation (`class-validator`) and domain exception filters returning standard HTTP status codes (`409 Conflict`, `400 Bad Request`, `201 Created`).
- **Frontend**: **React + Vite + TypeScript**
  - Designed for 3 dedicated use cases:
    1. **Reception Screen**: Patient check-in form with real-time validation, emergency toggle, instant token receipt card, and live queue monitoring.
    2. **Doctor Console**: Doctor switcher (`Dr. S. Karki [D1]` / `Dr. R. Joshi [D2]`), active consultation card, and action controls (`Call Next`, `Done`, `No-Show`) with conflict handling.
    3. **Waiting-Room TV Display**: High-contrast, large-font TV interface readable from across a room. Highlights newly called tokens with a pulsating glow for 7 seconds, auto-refreshes seamlessly without screen flickering, and features an explicit **Server Offline** warning banner if connection drops.
  - Interactive **Time Simulation Toolbar** for testing arbitrary times or running the clinic example day.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── current-time.decorator.ts   # Injects X-Now or live Kathmandu time
│   │   │   ├── http-exception.filter.ts    # Maps QueueConflictException -> 409
│   │   │   └── time.util.ts                # Luxon Kathmandu timezone & rule utilities
│   │   ├── queue/
│   │   │   ├── dto/check-in.dto.ts         # Validation rules for check-ins
│   │   │   ├── queue.controller.ts         # REST API endpoints
│   │   │   ├── queue.engine.ts             # Deterministic Rules 1–7 state machine
│   │   │   ├── queue.module.ts             # NestJS module declaration
│   │   │   ├── queue.replay.spec.ts        # Unit & data/clinic.json replay test suite
│   │   │   ├── queue.service.ts            # Service layer with SQLite integration
│   │   │   ├── queue.store.ts              # SQLite database adapter (survives restarts)
│   │   │   └── queue.types.ts              # TypeScript domain types & interfaces
│   │   ├── app.module.ts
│   │   └── main.ts                         # Bootstrap with CORS & validation
│   ├── test/
│   │   ├── app.e2e-spec.ts                 # Supertest API integration tests
│   │   └── jest-e2e.json
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DoctorScreen.tsx            # Doctor examination room terminal
│   │   │   ├── Navbar.tsx                  # Screen navigation & live count badges
│   │   │   ├── ReceptionScreen.tsx         # Check-in form & live queue table
│   │   │   ├── TimeSimulatorBar.tsx        # Dev toolbar for simulated timestamps
│   │   │   └── WaitingRoomScreen.tsx       # TV Display with new-call glow & offline banner
│   │   ├── services/api.ts                 # Fetch client with X-Now support
│   │   ├── types.ts                        # Frontend types
│   │   ├── App.tsx                         # Main app component & auto-polling
│   │   └── index.css                       # Medical theme & CSS animations
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── clinic.json                         # Take-home specification & replay events
├── .gitignore
└── README.md
```

---

## How to Run Both Parts

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`

### 1. Start the Backend API
```bash
cd backend
npm install
npm run start:dev
```
The backend starts on **`http://localhost:3001`**.

### 2. Start the Frontend Client
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend starts on **`http://localhost:5173`**. Open this URL in your browser to view the application.

---

## Running Automated Tests

The repository includes both pure domain replay tests and full HTTP integration tests.

### 1. Unit & Replay Test Suite
Replays the exact scenario from `data/clinic.json` and asserts 100% compliance with expected tokens, doctor calls, and queue snapshots, along with edge case tests:
```bash
cd backend
npm test
```
**Test Coverage Includes:**
- Exact replay of all events in `data/clinic.json`.
- 15-minute tardiness cutoff edge cases (exactly 15m is on time $\to$ `A` token; 15m 1s is late $\to$ `W` token).
- Midnight token counter reset per letter (`E`, `A`, `W`) in Asia/Kathmandu.
- Senior walk-in priority ($\ge 65$).
- Fairness rule triggering after 3 consecutive due appointments.
- No-show lifecycle (re-enters once as walk-in with same token; leaves on 2nd no-show).
- Concurrency and 409 conflict checks.
- SQLite state persistence surviving server restarts.

### 2. End-to-End API Integration Tests (Supertest)
Verifies HTTP endpoints, DTO validations, `X-Now` header parsing, and `409 Conflict` statuses:
```bash
cd backend
npm run test:e2e
```

---

## Queue Logic & Business Rules

The queue engine in [`backend/src/queue/queue.engine.ts`](backend/src/queue/queue.engine.ts) implements the clinic requirements deterministically:

### 1. Check-in & Groups (Rule 1)
- **Emergency**: Always highest priority. Receives an `E-XXX` token.
- **Appointment**: Has an `appointmentTime`. If the patient checks in **more than 15 minutes** after their appointment time, they are treated as a walk-in and receive a `W-XXX` token. Checking in *exactly* 15 minutes late is still considered on time and receives an `A-XXX` token.
- **Walk-in**: Receives a `W-XXX` token.

### 2. Daily Token Counters (Rule 2)
- Formats: `E-001`, `A-001`, `W-001`.
- Each letter has its own independent counter.
- Counters automatically reset to `001` at midnight local Kathmandu time (`Asia/Kathmandu`, `UTC+05:45`).

### 3. Doctor Call Priority (Rule 3)
When a doctor presses **Call next**, eligible waiting patients are selected in the following strict order:
1. **Emergencies**: Ordered by check-in time.
2. **Fairness Override (Rule 4)**: If triggered, calls a walk-in immediately (see Rule 4 below).
3. **Due Appointments**: Appointments where `appointmentTime <= currentTime + 10 minutes`. Ordered by appointment time first, then by check-in time.
4. **Walk-ins**: Patients aged **65 or older** are called first, followed by remaining walk-ins. Within each age group, ordered by check-in time.
5. **Early Appointments**: Appointments where `appointmentTime > currentTime + 10 minutes`. Ordered by appointment time.

### 4. Fairness Rule (Rule 4)
Walk-ins must not wait forever. If the last 3 non-emergency calls across all doctors were made under Rule 3.2 (Due Appointments), and at least one walk-in is waiting, the system calls the highest-priority walk-in instead of the next due appointment.

### 5. No-Shows (Rule 5)
When a doctor marks a patient as a no-show:
- **First No-Show**: Patient goes back to the queue as a walk-in. They retain their original token, and their check-in time is updated to the timestamp of the no-show.
- **Second No-Show**: Patient permanently leaves the queue.

### 6. Queue Projection & Wait Time Estimation (Rule 6)
- **Projected Order**: The queue endpoint simulates consecutive calls starting from the current time applying Rules 3 and 4 to display patients in the exact order they will be called.
- **Estimated Wait Time**:
  $$\text{Wait Minutes} = \left\lfloor \frac{\text{position}}{\text{number of doctors}} \right\rfloor \times 12\text{ minutes}$$
  With 2 doctors, positions 0 and 1 show **"Next"** (0 minutes).

### 7. Concurrency & Conflict Protection (Rule 7)
- A doctor sees one patient at a time.
- Pressing `Call next` while already seeing a patient returns `409 Conflict`.
- Pressing `Done` or `No-show` while not seeing anyone returns `409 Conflict`.
- Atomically marks the patient as `seeing` and binds them to the calling doctor.

---

## Time Testing & Simulation (`X-Now`)

Because clinic rules rely on the current time (appointment due threshold, 15-minute tardiness cutoff, midnight resets), the application supports simulated time injection:

- **HTTP Header**: Clients or tests pass the `X-Now: <ISO_8601_TIMESTAMP>` header (e.g. `X-Now: 2026-11-02T09:30:00+05:45`).
- **Resolver**: The `@CurrentTime()` decorator in NestJS extracts the header; if absent, it falls back to the live clock in `Asia/Kathmandu`.
- **UI Time Toolbar**: The frontend includes a top toolbar allowing evaluators to toggle between the live Kathmandu clock and pre-configured test timestamps (`08:50`, `09:00`, `09:14`, `09:26`, `09:35`, `10:00`) or input any custom ISO timestamp.

---

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/check-ins` | Check in patient & generate token | `201 Created`, `400 Bad Request` |
| `POST` | `/api/doctors/:id/call-next` | Doctor calls next patient in priority | `200 OK`, `409 Conflict` |
| `POST` | `/api/doctors/:id/done` | Finish current consultation | `200 OK`, `409 Conflict` |
| `POST` | `/api/doctors/:id/no-show` | Mark current patient as no-show | `200 OK`, `409 Conflict` |
| `GET` | `/api/queue` | Live `nowServing` and `waiting` lists | `200 OK` |
| `GET` | `/api/doctors` | List doctors & their current consultation status | `200 OK` |
| `POST` | `/api/reset` | Reset queue state for demo/test isolation | `200 OK` |

---

## What I Would Improve with More Time

1. **WebSockets / Server-Sent Events (SSE)**:
   - Replace the 3-second HTTP polling loop with an SSE or WebSocket stream so that token calls and queue updates push instantly to all connected screens.
2. **Audio Chime & Voice Calling on TV Display**:
   - Integrate a web audio chime and Web Speech API synthesizer (e.g. *"Token A-001, please proceed to Dr. Karki in Room 1"*) to assist elderly or visually impaired patients in the waiting area.
3. **Multi-Department & Counter Support**:
   - Extend the queue engine to support multiple departments (General Medicine, Pediatrics, Lab Collection, Pharmacy) with separate counters and multi-stage token routing.
4. **SMS / WhatsApp Token Alerts**:
   - Send an automated notification to walk-in patients when their estimated wait time is under 15 minutes, allowing them to step out of the clinic without missing their turn.
5. **Role-Based Authentication & Multi-Tenancy**:
   - Secure the Reception and Doctor screens with JWT auth while leaving the Waiting-Room TV screen in read-only public display mode.

---

## AI Tools Disclosure

As stated in the take-home instructions:
> *"AI tools are allowed. If you use them, say where in your README. In the interview we will ask you to explain your code and change it live, so make sure you understand every line."*

**Use of AI Tools:**
- **Architecture Planning**: AI was used to draft the multi-phase implementation plan and ensure complete coverage of the take-home requirements.
- **Test Scaffolding**: AI assisted in parsing the example event structure from `data/clinic.json` to write the automated replay test runner in Jest.
- **Boilerplate & CSS Styling**: AI generated the initial NestJS and Vite scaffolding and CSS color palette tokens for the medical theme.
- **Code Ownership**: Every business rule (fairness algorithm, no-show lifecycle, tardiness calculations, doctor locking, and projected waiting order) was thoroughly validated, tested, and reviewed line-by-line to ensure full understanding for the live technical interview.
