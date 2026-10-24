import React, { useState, useEffect, useRef } from 'react';
import { Tv, Clock, WifiOff, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import type { Doctor, QueueResponse } from '../types';
import { api } from '../services/api';

interface WaitingRoomScreenProps {
  queueData: QueueResponse | null;
  doctors: Doctor[];
  serverError: string | null;
}

export const WaitingRoomScreen: React.FC<WaitingRoomScreenProps> = ({
  queueData,
  doctors,
  serverError,
}) => {
  const [kathmanduTime, setKathmanduTime] = useState<string>('');
  const [kathmanduDate, setKathmanduDate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [newlyCalledTokens, setNewlyCalledTokens] = useState<Set<string>>(new Set());

  const previousTokensRef = useRef<Map<string, string>>(new Map()); // doctorId -> token

  // Track newly called tokens to pulse them for 7 seconds
  useEffect(() => {
    if (!queueData) return;

    const currentServing = queueData.nowServing || [];
    const prevMap = previousTokensRef.current;
    const newTokens = new Set<string>();

    for (const item of currentServing) {
      const prevToken = prevMap.get(item.doctorId);
      if (item.token && item.token !== prevToken) {
        // A new token was called for this doctor!
        newTokens.add(item.token);
      }
    }

    if (newTokens.size > 0) {
      setNewlyCalledTokens((prev) => new Set([...prev, ...newTokens]));
      // Remove highlight after 7 seconds
      setTimeout(() => {
        setNewlyCalledTokens((current) => {
          const updated = new Set(current);
          for (const t of newTokens) {
            updated.delete(t);
          }
          return updated;
        });
      }, 7000);
    }

    // Update ref
    const nextMap = new Map<string, string>();
    for (const item of currentServing) {
      if (item.token) {
        nextMap.set(item.doctorId, item.token);
      }
    }
    previousTokensRef.current = nextMap;
  }, [queueData]);

  // Clock in Asia/Kathmandu
  useEffect(() => {
    const updateTime = () => {
      const simulated = api.getSimulatedTime();
      const now = simulated ? new Date(simulated) : new Date();
      const timeFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const dateFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setKathmanduTime(timeFmt.format(now));
      setKathmanduDate(dateFmt.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const getTokenColor = (token: string) => {
    if (token.startsWith('E-')) return { bg: 'rgba(225, 29, 72, 0.15)', text: '#fb7185', border: 'rgba(225, 29, 72, 0.5)' };
    if (token.startsWith('A-')) return { bg: 'rgba(2, 132, 199, 0.15)', text: '#38bdf8', border: 'rgba(2, 132, 199, 0.5)' };
    return { bg: 'rgba(217, 119, 6, 0.15)', text: '#fbbf24', border: 'rgba(217, 119, 6, 0.5)' };
  };

  return (
    <div style={{
      background: '#070b14',
      minHeight: '88vh',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      boxShadow: 'var(--shadow-xl)',
    }}>
      {/* TV Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.25rem',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'var(--primary)',
            padding: '0.6rem',
            borderRadius: '10px',
            color: '#fff',
            boxShadow: '0 0 15px rgba(2, 132, 199, 0.5)',
          }}>
            <Tv size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              BODHI FAMILY CLINIC
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Kathmandu • Patient Token Calling Display
            </p>
          </div>
        </div>

        {/* Live Clock & Fullscreen Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2rem',
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '0.05em',
            }}>
              {kathmanduTime || '00:00:00'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
              {kathmanduDate} (Asia/Kathmandu)
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              padding: '0.65rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Prominent Server Down Disconnection Banner */}
      {serverError && (
        <div style={{
          background: 'rgba(225, 29, 72, 0.95)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          boxShadow: '0 0 30px rgba(225, 29, 72, 0.8)',
          animation: 'urgentPulse 1.5s infinite ease-in-out',
        }}>
          <WifiOff size={40} style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase' }}>
              ⚠️ SERVER OFFLINE — RECONNECTING
            </h3>
            <p style={{ fontSize: '1rem', marginTop: '0.25rem', opacity: 0.95 }}>
              Connection to clinic queue server is currently lost. Please listen for direct staff announcements. Do not rely on previous screen data.
            </p>
          </div>
        </div>
      )}

      {/* "NOW SERVING" Section - Massive TV View */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.1)',
            padding: '0.25rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}>
            NOW SERVING
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Please proceed to the designated doctor's examination room
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
        }}>
          {doctors.map((doc) => {
            const patient = doc.currentPatient;
            const isNew = patient ? newlyCalledTokens.has(patient.token) : false;
            const tokenColors = patient ? getTokenColor(patient.token) : null;

            return (
              <div
                key={doc.id}
                style={{
                  background: isNew ? 'rgba(30, 41, 59, 0.95)' : 'var(--bg-card)',
                  border: isNew ? '3px solid #38bdf8' : '2px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '260px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isNew ? '0 0 35px rgba(56, 189, 248, 0.5)' : 'var(--shadow-md)',
                  transition: 'all 0.3s ease',
                  opacity: serverError ? 0.45 : 1,
                }}
                className={isNew ? 'animate-new-call' : ''}
              >
                {/* Doctor Room Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      color: 'var(--text-subtle)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}>
                      Room • {doc.id}
                    </span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.1rem' }}>
                      {doc.name}
                    </h3>
                  </div>

                  {isNew && (
                    <div style={{
                      background: '#0284c7',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 0 15px rgba(2, 132, 199, 0.8)',
                    }}>
                      <Sparkles size={13} /> JUST CALLED
                    </div>
                  )}
                </div>

                {/* Patient Token Display (Massive & High Contrast) */}
                <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                  {patient ? (
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '4.5rem',
                        fontWeight: 900,
                        letterSpacing: '0.04em',
                        color: tokenColors?.text || '#38bdf8',
                        lineHeight: 1,
                        textShadow: isNew ? '0 0 25px rgba(56, 189, 248, 0.7)' : 'none',
                      }}>
                        {patient.token}
                      </div>
                      <div style={{
                        fontSize: '1.6rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        marginTop: '0.5rem',
                      }}>
                        {patient.name}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: 'var(--text-subtle)',
                      }}>
                        ---
                      </div>
                      <div style={{ fontSize: '1.1rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
                        Waiting for Next Patient
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer status */}
                <div style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}>
                  <span>Status:</span>
                  <span style={{
                    fontWeight: 700,
                    color: patient ? '#34d399' : 'var(--text-subtle)',
                  }}>
                    {patient ? 'Consultation Active' : 'Available for Calling'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* "UPCOMING IN QUEUE" Section */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '1.75rem',
        opacity: serverError ? 0.45 : 1,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>Upcoming In Queue</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Estimated wait times update dynamically</p>
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}>
            Total in line: <strong style={{ color: '#38bdf8' }}>{queueData?.waiting.length ?? 0}</strong>
          </div>
        </div>

        {(!queueData?.waiting || queueData.waiting.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-subtle)', fontSize: '1rem' }}>
            No patients currently in the waiting queue.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
          }}>
            {queueData.waiting.slice(0, 8).map((item) => (
              <div
                key={item.token}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: item.position < 2 ? '#38bdf8' : 'var(--text-muted)',
                    width: '24px',
                  }}>
                    #{item.position + 1}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#f8fafc',
                    }}>
                      {item.token}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {item.name}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {item.estimatedWaitMinutes === 0 ? (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.25rem 0.55rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}>
                      Next
                    </span>
                  ) : (
                    <span style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <Clock size={12} /> ~{item.estimatedWaitMinutes}m
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
