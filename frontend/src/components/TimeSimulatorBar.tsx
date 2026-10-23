import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, Play, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface TimeSimulatorBarProps {
  onStateReset?: () => void;
  onTimeChange?: (time: string | null) => void;
}

export const TimeSimulatorBar: React.FC<TimeSimulatorBarProps> = ({
  onStateReset,
  onTimeChange,
}) => {
  const [mode, setMode] = useState<'live' | 'simulated'>('live');
  const [customTime, setCustomTime] = useState<string>('2026-11-02T09:26:00+05:45');
  const [liveKathmanduTime, setLiveKathmanduTime] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const updateLiveClock = () => {
      const now = new Date();
      // Kathmandu is UTC +05:45
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setLiveKathmanduTime(formatter.format(now));
    };

    updateLiveClock();
    const interval = setInterval(updateLiveClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleModeChange = (newMode: 'live' | 'simulated') => {
    setMode(newMode);
    if (newMode === 'live') {
      api.setSimulatedTime(null);
      onTimeChange?.(null);
      showNotice('Switched to live Asia/Kathmandu time');
    } else {
      api.setSimulatedTime(customTime);
      onTimeChange?.(customTime);
      showNotice(`Simulating clinic time: ${customTime}`);
    }
  };

  const handleCustomTimeApply = (timeVal: string) => {
    setCustomTime(timeVal);
    setMode('simulated');
    api.setSimulatedTime(timeVal);
    onTimeChange?.(timeVal);
    showNotice(`Applied time: ${timeVal}`);
  };

  const handleReset = async () => {
    if (window.confirm('Reset queue and doctors state back to initial morning state?')) {
      try {
        await api.resetQueue();
        onStateReset?.();
        showNotice('Queue and doctor states reset successfully');
      } catch (err: any) {
        alert(err.message || 'Failed to reset queue');
      }
    }
  };

  const showNotice = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.6rem 1.25rem',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
      fontSize: '0.85rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600 }}>
          <Clock size={16} />
          <span>Clinic Time (Asia/Kathmandu):</span>
        </div>

        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-input)',
          borderRadius: '6px',
          padding: '2px',
          border: '1px solid var(--border-color)',
        }}>
          <button
            type="button"
            onClick={() => handleModeChange('live')}
            style={{
              background: mode === 'live' ? 'var(--primary)' : 'transparent',
              color: mode === 'live' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            Live ({liveKathmanduTime})
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('simulated')}
            style={{
              background: mode === 'simulated' ? 'var(--primary)' : 'transparent',
              color: mode === 'simulated' ? '#fff' : 'var(--text-muted)',
              border: 'none',
              padding: '0.25rem 0.65rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          >
            Simulated (X-Now)
          </button>
        </div>

        {mode === 'simulated' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <select
              value={customTime}
              onChange={(e) => handleCustomTimeApply(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
              }}
            >
              <option value="2026-11-02T08:50:00+05:45">08:50 (Morning Check-in)</option>
              <option value="2026-11-02T09:00:00+05:45">09:00 (Dr. Karki Call Next)</option>
              <option value="2026-11-02T09:14:00+05:45">09:14 (Maya Call Next)</option>
              <option value="2026-11-02T09:26:00+05:45">09:26 (Snapshot 1 - 5 waiting)</option>
              <option value="2026-11-02T09:35:00+05:45">09:35 (Fairness Triggered)</option>
              <option value="2026-11-02T10:00:00+05:45">10:00 (Snapshot 2 - Gita)</option>
            </select>

            <input
              type="text"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              placeholder="YYYY-MM-DDTHH:mm:ss+05:45"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                width: '230px',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              type="button"
              onClick={() => handleCustomTimeApply(customTime)}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.78rem',
              }}
            >
              <Play size={12} /> Apply
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {statusMsg && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.8rem' }}>
            <CheckCircle2 size={14} /> {statusMsg}
          </span>
        )}
        <button
          type="button"
          onClick={handleReset}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            padding: '0.25rem 0.65rem',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
          title="Reset clinic queue and doctors"
        >
          <RotateCcw size={13} /> Reset Day
        </button>
      </div>
    </div>
  );
};
