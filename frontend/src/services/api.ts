import type { CheckInFormData, Doctor, Patient, QueueResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private simulatedTime: string | null = null;

  public setSimulatedTime(isoTime: string | null) {
    this.simulatedTime = isoTime;
  }

  public getSimulatedTime(): string | null {
    return this.simulatedTime;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.simulatedTime) {
      headers['X-Now'] = this.simulatedTime;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let errorMsg = `Server error (${res.status})`;
      try {
        const body = await res.json();
        errorMsg = body.message || errorMsg;
      } catch {
        // use default
      }
      throw new Error(errorMsg);
    }
    return res.json();
  }

  public async getQueue(): Promise<QueueResponse> {
    const res = await fetch(`${API_BASE_URL}/queue`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<QueueResponse>(res);
  }

  public async getDoctors(): Promise<Doctor[]> {
    const res = await fetch(`${API_BASE_URL}/doctors`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<Doctor[]>(res);
  }

  public async checkIn(data: CheckInFormData): Promise<Patient> {
    const payload: any = {
      name: data.name.trim(),
      age: Number(data.age),
      kind: data.kind,
      emergency: Boolean(data.emergency),
    };
    if (data.kind === 'appointment' && data.appointmentTime) {
      payload.appointmentTime = data.appointmentTime;
    }

    const res = await fetch(`${API_BASE_URL}/check-ins`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<Patient>(res);
  }

  public async callNext(doctorId: string): Promise<{ patient: Patient | null }> {
    const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}/call-next`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ patient: Patient | null }>(res);
  }

  public async done(doctorId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}/done`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ success: boolean; message: string }>(res);
  }

  public async noShow(doctorId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}/no-show`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ success: boolean; message: string }>(res);
  }

  public async resetQueue(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/reset`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ success: boolean; message: string }>(res);
  }

  public async replayScenario(untilTime?: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const res = await fetch(`${API_BASE_URL}/replay`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ until: untilTime }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback to client-side sequential replay
    }

    // Client-side replay fallback using clinic.json events
    const clinicModule = await import('../data/clinic.json');
    const clinicData = clinicModule.default || clinicModule;
    await this.resetQueue();

    let count = 0;
    if (clinicData.examples && clinicData.examples.length > 0) {
      const events: any[] = (clinicData.examples[0] as any).events;
      for (const event of events) {
        if (untilTime && event.at > untilTime) break;
        this.setSimulatedTime(event.at);
        switch (event.type) {
          case 'check_in':
            if (event.patient) await this.checkIn(event.patient);
            count++;
            break;
          case 'call_next':
            if (event.doctorId) await this.callNext(event.doctorId);
            count++;
            break;
          case 'done':
            if (event.doctorId) await this.done(event.doctorId);
            count++;
            break;
          case 'no_show':
            if (event.doctorId) await this.noShow(event.doctorId);
            count++;
            break;
        }
      }
    }

    this.setSimulatedTime(untilTime || null);
    return {
      success: true,
      message: `Loaded clinic scenario (${count} events up to ${untilTime?.split('T')[1]?.substring(0, 5) || 'end'})`,
      count,
    };
  }
}

export const api = new ApiService();
