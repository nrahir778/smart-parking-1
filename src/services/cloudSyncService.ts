// Cloud Synchronization Service for Smart Parking System
// Enables real-time telemetry sharing from Gateway device to Cloud & Public QR Viewers

import { SlotStatus, CarVisualConfig } from '../types';

export interface ParkingCloudState {
  slots: {
    id: 1 | 2 | 3;
    name: string;
    status: SlotStatus;
    distance: number;
    unit: string;
    updatedAt: string;
    hasHardwareReading?: boolean;
    currentCharge?: number;
    parkedSince?: number | null;
    car?: CarVisualConfig;
  }[];
  gate: 'OPEN' | 'CLOSED';
  gateAngle: number;
  buzzerOn: boolean;
  totalOccupied: number;
  totalSlots: number;
  lastUpdated: number;
  isHardwareConnected?: boolean;
  isOnline?: boolean;
  statusMessage?: string;
  source: 'gateway_bt' | 'gateway_usb' | 'simulator' | 'cloud' | 'disconnected';
}

class CloudSyncService {
  private isBroadcasting = true;
  private lastBroadcastTime = 0;
  private minBroadcastInterval = 800; // ms throttle
  private pollingTimer: any = null;
  private activeListeners: ((state: ParkingCloudState) => void)[] = [];
  private lastKnownState: ParkingCloudState | null = null;
  private lastSuccessfulSync = 0;

  constructor() {
    // Check if cloud broadcast is saved in localStorage
    const saved = localStorage.getItem('smartparking_cloud_broadcast');
    if (saved !== null) {
      this.isBroadcasting = saved === 'true';
    }
  }

  public setBroadcasting(enabled: boolean) {
    this.isBroadcasting = enabled;
    localStorage.setItem('smartparking_cloud_broadcast', String(enabled));
  }

  public getBroadcasting(): boolean {
    return this.isBroadcasting;
  }

  public getLastSyncTime(): number {
    return this.lastSuccessfulSync;
  }

  // Called when Bluetooth disconnects to immediately inform Cloud viewers
  public async broadcastDisconnected(): Promise<boolean> {
    try {
      const payload: ParkingCloudState = {
        slots: [
          { id: 1, name: 'LOT 1', status: 'UNKNOWN', distance: 0, unit: 'cm', updatedAt: new Date().toISOString(), hasHardwareReading: false },
          { id: 2, name: 'LOT 2', status: 'UNKNOWN', distance: 0, unit: 'cm', updatedAt: new Date().toISOString(), hasHardwareReading: false },
          { id: 3, name: 'LOT 3', status: 'UNKNOWN', distance: 0, unit: 'cm', updatedAt: new Date().toISOString(), hasHardwareReading: false },
        ],
        gate: 'OPEN',
        gateAngle: 0,
        buzzerOn: false,
        totalOccupied: 0,
        totalSlots: 3,
        lastUpdated: Date.now(),
        isHardwareConnected: false,
        isOnline: false,
        source: 'disconnected',
        statusMessage: 'Bluetooth disconnected from main phone',
      };

      this.lastBroadcastTime = Date.now();
      const res = await fetch('/api/parking/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.lastKnownState = payload;
        this.lastSuccessfulSync = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Called by Master device connected to Arduino/HC-05 or Simulator
  public async broadcastState(state: Omit<ParkingCloudState, 'lastUpdated'>): Promise<boolean> {
    if (!this.isBroadcasting) return false;

    const now = Date.now();
    if (now - this.lastBroadcastTime < this.minBroadcastInterval) {
      return false; // throttled
    }

    this.lastBroadcastTime = now;

    try {
      const payload: ParkingCloudState = {
        ...state,
        isHardwareConnected: state.isHardwareConnected !== false,
        lastUpdated: now,
      };

      const res = await fetch('/api/parking/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.lastSuccessfulSync = now;
        this.lastKnownState = payload;
        return true;
      }
      return false;
    } catch {
      // Silently catch network failures so offline Bluetooth is unaffected
      return false;
    }
  }

  // Called to fetch current cloud state once
  public async fetchLatestState(): Promise<ParkingCloudState | null> {
    try {
      const res = await fetch('/api/parking/state', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: ParkingCloudState = await res.json();
        this.lastKnownState = data;
        this.lastSuccessfulSync = data.lastUpdated || Date.now();
        return data;
      }
    } catch {
      // Offline / error
    }
    return null;
  }

  // Subscribe to live cloud updates (for QR code viewers or public displays)
  public startLivePolling(onUpdate: (state: ParkingCloudState) => void, intervalMs: number = 2000) {
    this.activeListeners.push(onUpdate);

    // Initial fetch immediately
    this.fetchLatestState().then((state) => {
      if (state) onUpdate(state);
    });

    if (!this.pollingTimer) {
      this.pollingTimer = setInterval(async () => {
        const state = await this.fetchLatestState();
        if (state) {
          this.activeListeners.forEach((fn) => fn(state));
        }
      }, intervalMs);
    }
  }

  public stopLivePolling(onUpdate?: (state: ParkingCloudState) => void) {
    if (onUpdate) {
      this.activeListeners = this.activeListeners.filter((l) => l !== onUpdate);
    } else {
      this.activeListeners = [];
    }

    if (this.activeListeners.length === 0 && this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

export const cloudSync = new CloudSyncService();
