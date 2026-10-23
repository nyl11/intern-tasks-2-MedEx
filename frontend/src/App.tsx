import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import type { ScreenType } from './components/Navbar';
import { TimeSimulatorBar } from './components/TimeSimulatorBar';
import { ReceptionScreen } from './components/ReceptionScreen';
import { DoctorScreen } from './components/DoctorScreen';
import { WaitingRoomScreen } from './components/WaitingRoomScreen';
import type { Doctor, QueueResponse } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('reception');
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const [queueRes, doctorsRes] = await Promise.all([
        api.getQueue(),
        api.getDoctors(),
      ]);
      setQueueData(queueRes);
      setDoctors(doctorsRes);
      setServerError(null);
    } catch (err: any) {
      setServerError(err.message || 'Cannot connect to backend server at http://localhost:3001');
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-polling every 3 seconds
  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const waitingCount = queueData?.waiting.length ?? 0;
  const nowServingCount = queueData?.nowServing.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Time Simulation & Preset Toolbar */}
      <TimeSimulatorBar
        onStateReset={() => fetchStatus(false)}
        onTimeChange={() => fetchStatus(false)}
      />

      {/* Main Navigation */}
      <Navbar
        activeScreen={activeScreen}
        onScreenChange={setActiveScreen}
        waitingCount={waitingCount}
        nowServingCount={nowServingCount}
      />

      {/* Main Screen Content */}
      <main className="app-container" style={{ flex: 1, paddingBottom: '3rem' }}>
        {activeScreen === 'reception' && (
          <ReceptionScreen
            queueData={queueData}
            onRefreshQueue={() => fetchStatus(false)}
            isLoading={isLoading}
            serverError={serverError}
          />
        )}

        {activeScreen === 'doctor' && (
          <DoctorScreen
            doctors={doctors}
            onRefreshAll={() => fetchStatus(false)}
            waitingCount={waitingCount}
            serverError={serverError}
          />
        )}

        {activeScreen === 'display' && (
          <WaitingRoomScreen
            queueData={queueData}
            doctors={doctors}
            serverError={serverError}
          />
        )}
      </main>

      {/* Subtle Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '1.25rem',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-subtle)',
        fontSize: '0.8rem',
      }}>
        Bodhi Family Clinic Queue System • Kathmandu (UTC+05:45) • MedEx Full-Stack Take-Home
      </footer>
    </div>
  );
};

export default App;
