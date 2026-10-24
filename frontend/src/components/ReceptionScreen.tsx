import React, { useState } from 'react';
import {
  UserPlus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Users,
  Flame,
  Search,
} from 'lucide-react';
import type { CheckInFormData, Patient, QueueResponse } from '../types';
import { api } from '../services/api';

interface ReceptionScreenProps {
  queueData: QueueResponse | null;
  onRefreshQueue: () => void;
  isLoading: boolean;
  serverError: string | null;
}

export const ReceptionScreen: React.FC<ReceptionScreenProps> = ({
  queueData,
  onRefreshQueue,
  isLoading,
  serverError,
}) => {
  const [formData, setFormData] = useState<CheckInFormData>({
    name: '',
    age: '',
    kind: 'walk_in',
    appointmentTime: '',
    emergency: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState<Patient | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.name.trim()) {
      errs.name = 'Patient name is required.';
    }

    if (formData.age === '' || isNaN(Number(formData.age))) {
      errs.age = 'Age is required.';
    } else {
      const ageNum = Number(formData.age);
      if (ageNum < 0 || ageNum > 120) {
        errs.age = 'Age must be between 0 and 120.';
      }
    }

    if (formData.kind === 'appointment') {
      if (!formData.appointmentTime) {
        errs.appointmentTime = 'Appointment time is required for appointments.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const patient = await api.checkIn(formData);
      setLastCheckedIn(patient);
      // Reset form
      setFormData({
        name: '',
        age: '',
        kind: 'walk_in',
        appointmentTime: '',
        emergency: false,
      });
      setErrors({});
      onRefreshQueue();
    } catch (err: any) {
      setSubmitError(err.message || 'Check-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTokenClass = (token: string) => {
    if (token.startsWith('E-')) return 'token-badge-e';
    if (token.startsWith('A-')) return 'token-badge-a';
    return 'token-badge-w';
  };

  const filteredWaiting = (queueData?.waiting || []).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.token.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '1.75rem', alignItems: 'start' }}>
      {/* Left Column: Check-in Form */}
      <div>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <div style={{
              background: 'rgba(2, 132, 199, 0.15)',
              padding: '0.4rem',
              borderRadius: '8px',
              color: 'var(--primary)',
            }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Patient Check-In</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Generate token and place patient in queue</p>
            </div>
          </div>

          {submitError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Patient Full Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ram Bahadur"
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: `1px solid ${errors.name ? 'var(--danger)' : 'var(--border-color)'}`,
                  color: '#fff',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {errors.name && (
                <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.name}</p>
              )}
            </div>

            {/* Age Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                Age <span style={{ color: 'var(--danger)' }}>*</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-subtle)', marginLeft: '0.4rem' }}>
                  (Seniors ≥ 65 receive walk-in priority)
                </span>
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="0 - 120"
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: `1px solid ${errors.age ? 'var(--danger)' : 'var(--border-color)'}`,
                  color: '#fff',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              {errors.age && (
                <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.age}</p>
              )}
            </div>

            {/* Kind Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Arrival Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, kind: 'walk_in' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: `1px solid ${formData.kind === 'walk_in' ? 'var(--walkin)' : 'var(--border-color)'}`,
                    background: formData.kind === 'walk_in' ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-input)',
                    color: formData.kind === 'walk_in' ? '#fbbf24' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  <User size={15} />
                  <span>Walk-in</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, kind: 'appointment' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: `1px solid ${formData.kind === 'appointment' ? 'var(--appointment)' : 'var(--border-color)'}`,
                    background: formData.kind === 'appointment' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-input)',
                    color: formData.kind === 'appointment' ? '#38bdf8' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  <Calendar size={15} />
                  <span>Appointment</span>
                </button>
              </div>
            </div>

            {/* Appointment Time Field (Conditional) */}
            {formData.kind === 'appointment' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  Appointment Time <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: `1px solid ${errors.appointmentTime ? 'var(--danger)' : 'var(--border-color)'}`,
                    color: '#fff',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    outline: 'none',
                    colorScheme: 'dark',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 15 * 60000);
                      setFormData((prev) => ({ ...prev, appointmentTime: d.toISOString().slice(0, 16) }));
                    }}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: '#38bdf8',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 30 * 60000);
                      setFormData((prev) => ({ ...prev, appointmentTime: d.toISOString().slice(0, 16) }));
                    }}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: '#38bdf8',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    +30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 60 * 60000);
                      setFormData((prev) => ({ ...prev, appointmentTime: d.toISOString().slice(0, 16) }));
                    }}
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: '#38bdf8',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    +1 hr
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                  Rule: Check-in &gt; 15 mins late converts to walk-in with 'W' token.
                </p>
                {errors.appointmentTime && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.appointmentTime}</p>
                )}
              </div>
            )}

            {/* Emergency Checkbox */}
            <div style={{
              background: formData.emergency ? 'rgba(225, 29, 72, 0.15)' : 'var(--bg-input)',
              border: `1px solid ${formData.emergency ? 'var(--emergency)' : 'var(--border-color)'}`,
              padding: '0.75rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setFormData({ ...formData, emergency: !formData.emergency })}
            >
              <input
                type="checkbox"
                id="emergencyCheckbox"
                checked={formData.emergency}
                onChange={(e) => setFormData({ ...formData, emergency: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--emergency)' }}
              />
              <label htmlFor="emergencyCheckbox" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: formData.emergency ? '#fb7185' : 'var(--text-main)' }}>
                <Flame size={16} /> Mark as Emergency Case (Always called first)
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: formData.emergency ? 'var(--emergency)' : 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '0.8rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: formData.emergency ? '0 4px 12px rgba(225, 29, 72, 0.4)' : '0 4px 12px rgba(2, 132, 199, 0.4)',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {isSubmitting ? 'Issuing Token...' : 'Confirm Check-In & Issue Token'}
            </button>
          </form>
        </div>

        {/* Token Issued Notification Card */}
        {lastCheckedIn && (
          <div style={{
            marginTop: '1.25rem',
            background: 'var(--bg-card)',
            border: '2px solid var(--primary)',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Token Issued Successfully!</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '1.15rem', fontWeight: 800 }}>{lastCheckedIn.name}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Age: {lastCheckedIn.age} • Status: {lastCheckedIn.effectiveKind}
                  {lastCheckedIn.effectiveKind !== lastCheckedIn.kind && ' (Late Appt -> Walk-in)'}
                </p>
              </div>
              <div className={`token-badge ${getTokenClass(lastCheckedIn.token)}`} style={{ fontSize: '1.35rem', padding: '0.4rem 1rem' }}>
                {lastCheckedIn.token}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Live Waiting Queue */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Header & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.15)',
              padding: '0.4rem',
              borderRadius: '8px',
              color: '#38bdf8',
            }}>
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Live Waiting Queue</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {queueData?.waiting.length ?? 0} patients waiting in ordered priority
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search token or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Server error warning */}
        {serverError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertCircle size={16} />
            <span>Connection issue: {serverError}</span>
          </div>
        )}

        {/* Queue Table */}
        {isLoading && !queueData ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading queue status...
          </div>
        ) : filteredWaiting.length === 0 ? (
          <div style={{
            padding: '3.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-subtle)',
            background: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)',
          }}>
            <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
            <p style={{ fontWeight: 600 }}>No patients currently waiting</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Check in new patients using the form on the left</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-subtle)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Pos</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Token</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Patient Name</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Est. Wait Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaiting.map((item) => (
                  <tr
                    key={item.token}
                    style={{
                      borderBottom: '1px solid rgba(38, 53, 74, 0.6)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, color: item.position < 2 ? '#38bdf8' : 'var(--text-muted)' }}>
                      #{item.position + 1}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <span className={`token-badge ${getTokenClass(item.token)}`}>
                        {item.token}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                      {item.estimatedWaitMinutes === 0 ? (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}>
                          <Clock size={12} /> Next
                        </span>
                      ) : (
                        <span style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}>
                          <Clock size={13} style={{ color: 'var(--text-subtle)' }} />
                          ~{item.estimatedWaitMinutes} min
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
