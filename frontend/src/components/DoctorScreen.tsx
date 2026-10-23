import React, { useState } from 'react';
import {
  Stethoscope,
  PhoneCall,
  CheckCircle,
  UserX,
  AlertTriangle,
  Activity,
  Flame,
} from 'lucide-react';
import type { Doctor, Patient } from '../types';
import { api } from '../services/api';

interface DoctorScreenProps {
  doctors: Doctor[];
  onRefreshAll: () => void;
  waitingCount: number;
  serverError: string | null;
}

export const DoctorScreen: React.FC<DoctorScreenProps> = ({
  doctors,
  onRefreshAll,
  waitingCount,
  serverError,
}) => {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('D1');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  const seeingPatient: Patient | null = currentDoctor?.currentPatient || null;

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setErrorNotice(null);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorNotice(msg);
    setSuccessNotice(null);
  };

  const handleCallNext = async () => {
    setActionLoading(true);
    setErrorNotice(null);
    try {
      const res = await api.callNext(selectedDoctorId);
      if (res.patient) {
        showSuccess(`Called patient ${res.patient.token} (${res.patient.name})`);
      } else {
        showSuccess('Nobody is currently waiting in the queue.');
      }
      onRefreshAll();
    } catch (err: any) {
      showError(err.message || 'Failed to call next patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDone = async () => {
    setActionLoading(true);
    setErrorNotice(null);
    try {
      await api.done(selectedDoctorId);
      showSuccess(`Consultation finished for ${currentDoctor?.name}`);
      onRefreshAll();
    } catch (err: any) {
      showError(err.message || 'Failed to mark patient as done');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!seeingPatient) return;
    if (window.confirm(`Mark ${seeingPatient.name} (${seeingPatient.token}) as a No-Show?`)) {
      setActionLoading(true);
      setErrorNotice(null);
      try {
        await api.noShow(selectedDoctorId);
        showSuccess(`Marked ${seeingPatient.name} as No-Show.`);
        onRefreshAll();
      } catch (err: any) {
        showError(err.message || 'Failed to record no-show');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const getTokenClass = (token: string) => {
    if (token.startsWith('E-')) return 'token-badge-e';
    if (token.startsWith('A-')) return 'token-badge-a';
    return 'token-badge-w';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Doctor Tabs Selector */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            background: 'rgba(2, 132, 199, 0.15)',
            padding: '0.4rem',
            borderRadius: '8px',
            color: 'var(--primary)',
          }}>
            <Stethoscope size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Doctor Selection</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose your active consultation terminal</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {doctors.map((doc) => {
            const isSelected = doc.id === selectedDoctorId;
            const isBusy = Boolean(doc.currentPatient);
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  setSelectedDoctorId(doc.id);
                  setErrorNotice(null);
                }}
                style={{
                  background: isSelected ? 'var(--primary)' : 'var(--bg-input)',
                  border: `1px solid ${isSelected ? 'var(--border-focus)' : 'var(--border-color)'}`,
                  color: isSelected ? '#fff' : 'var(--text-main)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.35)' : 'none',
                }}
              >
                <span>{doc.name}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '999px',
                  background: isSelected ? 'rgba(255,255,255,0.25)' : isBusy ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: isSelected ? '#fff' : isBusy ? '#fbbf24' : '#34d399',
                  fontWeight: 700,
                }}>
                  {isBusy ? 'Seeing Patient' : 'Available'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Server Disconnection Warning */}
      {serverError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '0.85rem 1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>Server offline: {serverError}</span>
        </div>
      )}

      {/* Notifications */}
      {errorNotice && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.9rem',
        }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 700 }}>Action Conflict (409)</p>
            <p style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>{errorNotice}</p>
          </div>
        </div>
      )}

      {successNotice && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6ee7b7',
          padding: '0.85rem 1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.88rem',
          fontWeight: 600,
        }}>
          <CheckCircle size={18} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Active Consultation Console */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '2rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{currentDoctor?.name} ({currentDoctor?.id})</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Examination Room Consultation Terminal</p>
          </div>
          <div style={{
            background: seeingPatient ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${seeingPatient ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            color: seeingPatient ? '#fbbf24' : '#34d399',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <Activity size={14} />
            {seeingPatient ? 'Consultation In Progress' : 'Idle / Terminal Ready'}
          </div>
        </div>

        {seeingPatient ? (
          <div>
            <div style={{
              background: 'var(--bg-input)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              padding: '1.75rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-subtle)', fontWeight: 700 }}>
                    Current Patient
                  </span>
                  {seeingPatient.isEmergency && (
                    <span style={{
                      background: 'rgba(225, 29, 72, 0.2)',
                      color: '#fb7185',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}>
                      <Flame size={11} /> Emergency
                    </span>
                  )}
                </div>
                <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>{seeingPatient.name}</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Age: <strong style={{ color: '#fff' }}>{seeingPatient.age}</strong> • Type: <strong style={{ color: '#fff' }}>{seeingPatient.effectiveKind}</strong>
                  {seeingPatient.noShowCount > 0 && ` • (${seeingPatient.noShowCount} prior no-show)`}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className={`token-badge ${getTokenClass(seeingPatient.token)}`} style={{ fontSize: '2rem', padding: '0.5rem 1.4rem' }}>
                  {seeingPatient.token}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                  Checked in at: {new Date(seeingPatient.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Action Buttons for Active Patient */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                type="button"
                onClick={handleDone}
                disabled={actionLoading}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                }}
              >
                <CheckCircle size={20} />
                <span>Finish Consultation (Done)</span>
              </button>

              <button
                type="button"
                onClick={handleNoShow}
                disabled={actionLoading}
                style={{
                  background: 'rgba(225, 29, 72, 0.15)',
                  color: '#fb7185',
                  border: '1px solid rgba(225, 29, 72, 0.4)',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                }}
              >
                <UserX size={20} />
                <span>Mark No-Show</span>
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.75rem', textAlign: 'center' }}>
              Rule: 1st no-show re-enters queue as walk-in with same token; 2nd no-show permanently leaves.
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(2, 132, 199, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}>
              <PhoneCall size={30} />
            </div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>No Patient Currently in Consultation</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {waitingCount > 0
                ? `${waitingCount} patients are waiting in the queue according to priority rules.`
                : 'The waiting queue is currently empty.'}
            </p>

            <button
              type="button"
              onClick={handleCallNext}
              disabled={actionLoading}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '0.9rem 2.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '1.05rem',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
              }}
            >
              <PhoneCall size={18} />
              <span>{actionLoading ? 'Calling Next...' : 'Call Next Patient'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Both Doctors Overview */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '1.25rem',
      }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-muted)' }}>
          Clinic Doctors Live Status
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {doctors.map((doc) => (
            <div
              key={doc.id}
              style={{
                background: 'var(--bg-input)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{doc.name} ({doc.id})</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {doc.currentPatient ? `With: ${doc.currentPatient.name}` : 'Terminal Idle'}
                </p>
              </div>
              {doc.currentPatient ? (
                <span className={`token-badge ${getTokenClass(doc.currentPatient.token)}`}>
                  {doc.currentPatient.token}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700 }}>Ready</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
