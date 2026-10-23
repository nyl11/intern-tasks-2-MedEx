import React from 'react';
import { ClipboardList, Stethoscope, Tv, Activity } from 'lucide-react';

export type ScreenType = 'reception' | 'doctor' | 'display';

interface NavbarProps {
  activeScreen: ScreenType;
  onScreenChange: (screen: ScreenType) => void;
  waitingCount: number;
  nowServingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeScreen,
  onScreenChange,
  waitingCount,
  nowServingCount,
}) => {
  return (
    <header style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      padding: '0.85rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
    }}>
      {/* Clinic Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
        }}>
          <Activity size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Bodhi Family Clinic
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
            Kathmandu, Nepal • Token & Queue System
          </p>
        </div>
      </div>

      {/* Screen Navigation Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-input)',
        padding: '0.25rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        gap: '0.25rem',
      }}>
        <button
          type="button"
          onClick={() => onScreenChange('reception')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeScreen === 'reception' ? 'var(--primary)' : 'transparent',
            color: activeScreen === 'reception' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <ClipboardList size={16} />
          <span>Reception</span>
          {waitingCount > 0 && (
            <span style={{
              background: activeScreen === 'reception' ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
              color: activeScreen === 'reception' ? '#fff' : '#38bdf8',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.1rem 0.45rem',
              borderRadius: '999px',
            }}>
              {waitingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onScreenChange('doctor')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeScreen === 'doctor' ? 'var(--primary)' : 'transparent',
            color: activeScreen === 'doctor' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <Stethoscope size={16} />
          <span>Doctor View</span>
          {nowServingCount > 0 && (
            <span style={{
              background: activeScreen === 'doctor' ? 'rgba(255,255,255,0.25)' : 'var(--bg-card)',
              color: activeScreen === 'doctor' ? '#fff' : '#10b981',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.1rem 0.45rem',
              borderRadius: '999px',
            }}>
              {nowServingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onScreenChange('display')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeScreen === 'display' ? 'var(--primary)' : 'transparent',
            color: activeScreen === 'display' ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          <Tv size={16} />
          <span>Waiting Room TV</span>
        </button>
      </nav>
    </header>
  );
};
