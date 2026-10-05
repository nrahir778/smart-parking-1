import React, { useState, useEffect, useCallback } from 'react';
import {
  SlotData,
  ConnectionMode,
  BuzzerState,
  SerialLogEntry,
  SlotId,
  GateState,
  ThemeMode,
  ArduinoSummaryData,
  ParkingReceipt,
  PARKING_RATE_PER_MINUTE,
  CHARGE_UPDATE_INTERVAL_MS,
} from './types';
import { HeaderBar } from './components/HeaderBar';
import { TopSummary } from './components/TopSummary';
import { IsometricParkingLot } from './components/IsometricParkingLot';
import { BuzzerIndicator } from './components/BuzzerIndicator';
import { SlotCard } from './components/SlotCard';
import { SerialConsole } from './components/SerialConsole';
import { ArduinoGuideModal } from './components/ArduinoGuideModal';
import { BluetoothConnectModal } from './components/BluetoothConnectModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { PermissionPromptModal } from './components/PermissionPromptModal';
import { ReceiptsModal } from './components/ReceiptsModal';
import { ChromeOSGuideModal } from './components/ChromeOSGuideModal';
import { InAppToastContainer } from './components/InAppToastContainer';
import { BluetoothDiagnostics } from './components/BluetoothDiagnostics';
import { notificationService } from './services/notificationService';
import { downloadArduinoInoFile } from './utils/downloadFirmware';
import {
  serialManager,
  SerialLineParser,
  ArduinoSerialManager,
} from './services/webSerial';
import { hc05Bluetooth, HC05BluetoothManager } from './services/webBluetooth';
import { buzzerAudio } from './services/audioBuzzer';

const INITIAL_SLOTS: SlotData[] = [
  {
    id: 1,
    name: 'LOT 1',
    status: 'UNKNOWN',
    distance: 0.0,
    unit: 'cm',
    pressure: 0,
    fsr: 0,
    lastUpdated: 0,
    hasHardwareReading: false,
    currentCharge: 0,
    totalCollection: 0, // Clean start: no demo testing charges
    parkedSince: null,
    car: {
      bodyColor: '#1e3a8a', // Metallic Sapphire Blue
      roofColor: '#172554',
      accentColor: '#38bdf8',
      modelName: 'Executive Sedan',
      plate: 'GJ 12 AK 4589',
      type: 'sedan',
    },
  },
  {
    id: 2,
    name: 'LOT 2',
    status: 'UNKNOWN',
    distance: 0.0,
    unit: 'cm',
    pressure: 0,
    fsr: 0,
    lastUpdated: 0,
    hasHardwareReading: false,
    currentCharge: 0,
    totalCollection: 0, // Clean start: no demo testing charges
    parkedSince: null,
    car: {
      bodyColor: '#e2e8f0', // Pearl Titanium Silver
      roofColor: '#0f172a',
      accentColor: '#94a3b8',
      modelName: 'Urban Compact SUV',
      plate: 'GJ 12 BP 2024',
      type: 'suv',
    },
  },
  {
    id: 3,
    name: 'LOT 3',
    status: 'UNKNOWN',
    distance: 0.0,
    unit: 'cm',
    pressure: 0,
    fsr: 0,
    lastUpdated: 0,
    hasHardwareReading: false,
    currentCharge: 0,
    totalCollection: 0, // Clean start: no demo testing charges
    parkedSince: null,
    car: {
      bodyColor: '#dc2626', // Sport Crimson Metallic
      roofColor: '#991b1b',
      accentColor: '#f87171',
      modelName: 'Sport Coupe',
      plate: 'GJ 12 CR 8831',
      type: 'hatchback',
    },
  },
];

export default function App() {
  const [slots, setSlots] = useState<SlotData[]>(INITIAL_SLOTS);
  const [receipts, setReceipts] = useState<ParkingReceipt[]>([]); // Clean start: no fake receipts
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);

  const [arduinoSummary, setArduinoSummary] = useState<ArduinoSummaryData | null>(null);
  const [lastDataReceivedAt, setLastDataReceivedAt] = useState<number | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('disconnected');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<SerialLogEntry[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | undefined>(undefined);
  const [isArduinoGuideOpen, setIsArduinoGuideOpen] = useState(false);
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isPermissionPromptOpen, setIsPermissionPromptOpen] = useState(false);
  const [portLabel, setPortLabel] = useState<string | undefined>(undefined);
  const [isParkingLotFullscreen, setIsParkingLotFullscreen] = useState(false);
  const [isChromeOSModalOpen, setIsChromeOSModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  // Diagnostics counters
  const [validMessageCount, setValidMessageCount] = useState(0);
  const [lastRawMessage, setLastRawMessage] = useState<string>('');

  // Detect ChromeOS user agent
  const isChromeOS = typeof navigator !== 'undefined' && /CrOS|Chromebook/i.test(navigator.userAgent);

  const isConnected = connectionMode === 'connected_usb' || connectionMode === 'connected_bt';

  // Listen for PWA Install Prompt (ChromeOS Shelf / Launcher)
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPWAInstalled(true);
      }
      setDeferredPrompt(null);
    } catch {}
  };

  // Handle ChromeOS Shelf Shortcuts
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get('action');
      if (action === 'connect_usb') {
        setTimeout(() => handleConnectUSB(), 600);
      } else if (action === 'connect_bt') {
        setTimeout(() => setIsBluetoothModalOpen(true), 600);
      } else if (action === 'fullscreen') {
        setTimeout(() => setIsParkingLotFullscreen(true), 600);
      }
    } catch {}
  }, []);

  // Check on first app launch if permissions were granted
  useEffect(() => {
    try {
      const alreadyGranted = localStorage.getItem('smartparking_permissions_granted');
      if (!alreadyGranted) {
        const timer = setTimeout(() => {
          setIsPermissionPromptOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  // Manage body overflow when in fullscreen mode
  useEffect(() => {
    if (isParkingLotFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isParkingLotFullscreen]);

  // MG995 Gate Servo State: 0° = Open, 90° = Closed (Lot Full)
  const [gateState, setGateState] = useState<GateState>({
    angle: 0,
    status: 'OPEN',
  });

  // Buzzer State: Pin D8 hardware state + sequence pulse state
  const [buzzerState, setBuzzerState] = useState<BuzzerState>({
    active: false,
    pulseCount: 1,
    currentPulse: 0,
    audioEnabled: true,
    lastTriggered: 0,
    hardwareBuzzerOn: false,
  });

  // Manage dark/light class on HTML root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Log append helper
  const addLog = useCallback(
    (line: string, type: 'incoming' | 'system' | 'buzzer' | 'error' = 'incoming') => {
      const entry: SerialLogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        line,
        type,
      };
      setLogs((prev) => [...prev.slice(-150), entry]);
    },
    []
  );

  // Trigger Piezo Buzzer Pulse Pattern (1, 2, or 3 pulses)
  const triggerBuzzer = useCallback(
    async (pulseCount: 1 | 2 | 3) => {
      setBuzzerState((prev) => ({
        ...prev,
        active: true,
        pulseCount,
        currentPulse: 1,
        lastTriggered: Date.now(),
      }));

      addLog(`[BUZZER] Alert: ${pulseCount} pulse(s)`, 'buzzer');

      await buzzerAudio.playPattern(pulseCount, (currentPulseIndex) => {
        setBuzzerState((prev) => ({
          ...prev,
          currentPulse: currentPulseIndex,
        }));
      });

      setBuzzerState((prev) => ({
        ...prev,
        active: false,
        currentPulse: 0,
      }));
    },
    [addLog]
  );

  // Helper to sync Gate Servo and Buzzer state from slot conditions
  const syncGateAndBuzzer = useCallback((currentSlots: SlotData[]) => {
    const allOccupied = currentSlots.every((s) => s.status === 'OCCUPIED');
    if (allOccupied) {
      setGateState({ angle: 90, status: 'CLOSED' });
      setBuzzerState((prev) => ({ ...prev, hardwareBuzzerOn: true }));
    } else {
      setGateState({ angle: 0, status: 'OPEN' });
      setBuzzerState((prev) => ({ ...prev, hardwareBuzzerOn: false }));
    }
  }, []);

  // AUTOMATIC PARKING CHARGE CALCULATION TIMER:
  // ONLY starts counting after Arduino is connected with Bluetooth (or USB)
  useEffect(() => {
    // If not connected to Arduino hardware, DO NOT run the billing counter!
    if (!isConnected) {
      return;
    }

    const interval = setInterval(() => {
      setSlots((currentSlots) => {
        let changed = false;
        const now = Date.now();

        const updated = currentSlots.map((slot) => {
          if (slot.status === 'OCCUPIED' && slot.hasHardwareReading) {
            const parkedSince = slot.parkedSince || now;
            const elapsedSeconds = Math.max(0, Math.floor((now - parkedSince) / 1000));
            // Rate: ₹10 per minute = (elapsedSeconds / 60) * 10
            const computedCharge = Math.round((elapsedSeconds / 60) * PARKING_RATE_PER_MINUTE * 100) / 100;

            if (computedCharge !== slot.currentCharge || !slot.parkedSince) {
              changed = true;
              return {
                ...slot,
                parkedSince,
                currentCharge: computedCharge,
              };
            }
          }
          return slot;
        });

        return changed ? updated : currentSlots;
      });
    }, CHARGE_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Helper to settle a vehicle's departure and cut money automatically
  const settleSlotDeparture = useCallback(
    (slotId: SlotId, currentSlots: SlotData[]): { receipt: ParkingReceipt; finalAmount: number } | null => {
      const slot = currentSlots.find((s) => s.id === slotId);
      if (!slot) return null;

      const now = Date.now();
      const entryTime = slot.parkedSince || now;
      const durationSeconds = Math.max(1, Math.floor((now - entryTime) / 1000));
      // Final amount: at least ₹0.50 (minimum 3 seconds), or computed charge
      const computedFee = Math.round((durationSeconds / 60) * PARKING_RATE_PER_MINUTE * 100) / 100;
      const finalAmount = Math.max(0.5, slot.currentCharge || computedFee);

      const receipt: ParkingReceipt = {
        id: `rc-${Math.random().toString(36).substring(2, 9)}`,
        slotId: slot.id,
        slotName: slot.name,
        plate: slot.car.plate,
        modelName: slot.car.modelName,
        entryTime,
        exitTime: now,
        durationSeconds,
        amountPaid: finalAmount,
        timestamp: now,
      };

      setReceipts((prev) => [receipt, ...prev.slice(0, 49)]);

      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      addLog(`[PAYMENT] ${slot.name} (${slot.car.plate}) exited. Duration: ${mins}m ${secs}s. Auto-deducted: ₹${finalAmount.toFixed(2)}`, 'system');
      notificationService.notifyPaymentDeducted(slotId, slot.car.plate, finalAmount, durationSeconds);

      return { receipt, finalAmount };
    },
    [addLog]
  );

  // Process incoming line from Arduino hardware (USB or HC-05 Bluetooth)
  const handleIncomingSerialLine = useCallback(
    (rawLine: string) => {
      const clean = rawLine.trim();
      if (!clean) return;

      addLog(clean, 'incoming');

      const parsed = SerialLineParser.parse(clean);

      if (parsed.type === 'ignored') {
        return;
      }

      // Record valid message for diagnostics
      setValidMessageCount((prev) => prev + 1);
      setLastRawMessage(clean);

      // 1. Individual Lot / Slot reading line
      // e.g. "Lot 1 | Distance: 3.1 cm | Status: EMPTY"
      if (parsed.type === 'slot') {
        const { slotId, distance, unit, status, fsr } = parsed.data;
        setLastDataReceivedAt(Date.now());

        setSlots((currentSlots) => {
          const prevSlot = currentSlots.find((s) => s.id === slotId);
          const wasEmpty = prevSlot ? (prevSlot.status === 'EMPTY' || prevSlot.status === 'AVAILABLE') : false;
          const wasOccupied = prevSlot ? prevSlot.status === 'OCCUPIED' : false;

          // If a slot transitions from OCCUPIED to EMPTY: CAR DEPARTED!
          // Automatically cut money, log receipt, and reset active charge to 0 for next car!
          if (wasOccupied && (status === 'EMPTY' || status === 'AVAILABLE')) {
            const departure = settleSlotDeparture(slotId, currentSlots);
            const fee = departure?.finalAmount || prevSlot?.currentCharge || 0;
            const freeCount = currentSlots.filter((s) => (s.id === slotId ? true : (s.status === 'EMPTY' || s.status === 'AVAILABLE'))).length;
            notificationService.notifySpotAvailable(slotId, freeCount);

            return currentSlots.map((s) => {
              if (s.id === slotId) {
                return {
                  ...s,
                  status,
                  distance,
                  unit: unit || 'cm',
                  pressure: fsr ?? s.pressure,
                  fsr: fsr ?? s.fsr,
                  lastUpdated: Date.now(),
                  hasHardwareReading: true,
                  currentCharge: 0, // Reset to 0 for next car!
                  parkedSince: null,
                  totalCollection: (s.totalCollection || 0) + fee,
                  lastDeduction: departure?.receipt || null,
                };
              }
              return s;
            });
          }

          // If a slot transitions from EMPTY to OCCUPIED: NEW CAR ARRIVED!
          // Start live counting from 0 now that Bluetooth is connected!
          if (wasEmpty && status === 'OCCUPIED') {
            triggerBuzzer(slotId);
            const occupiedCount = currentSlots.filter((s) => (s.id === slotId ? true : s.status === 'OCCUPIED')).length;
            notificationService.notifyVehicleParked(slotId, occupiedCount);

            return currentSlots.map((s) => {
              if (s.id === slotId) {
                return {
                  ...s,
                  status,
                  distance,
                  unit: unit || 'cm',
                  pressure: fsr ?? s.pressure,
                  fsr: fsr ?? s.fsr,
                  lastUpdated: Date.now(),
                  hasHardwareReading: true,
                  currentCharge: 0, // Starts at 0
                  parkedSince: Date.now(),
                };
              }
              return s;
            });
          }

          // Standard telemetry update
          return currentSlots.map((s) => {
            if (s.id === slotId) {
              return {
                ...s,
                status,
                distance,
                unit: unit || 'cm',
                pressure: fsr ?? s.pressure,
                fsr: fsr ?? s.fsr,
                lastUpdated: Date.now(),
                hasHardwareReading: true,
              };
            }
            return s;
          });
        });
      }
      // 2. Total Summary line
      else if (parsed.type === 'summary') {
        setLastDataReceivedAt(Date.now());
        setArduinoSummary({
          ...parsed.data,
          lastUpdated: Date.now(),
        });

        const isClosed = parsed.data.gate === 'CLOSED';
        setGateState({
          angle: isClosed ? 90 : 0,
          status: parsed.data.gate,
        });

        const allOccupied = parsed.data.totalOccupied >= parsed.data.totalSlots;
        if (allOccupied) {
          notificationService.notifyParkingFull();
        }
        setBuzzerState((prev) => ({
          ...prev,
          hardwareBuzzerOn: allOccupied || isClosed,
        }));
      }
      // 3. Standalone Gate / Buzzer status lines
      else if (parsed.type === 'gate_buzzer') {
        setLastDataReceivedAt(Date.now());
        const { gateAngle, gateStatus, buzzerOn, pulseCount } = parsed.data;

        if (gateAngle !== undefined || gateStatus !== undefined) {
          const angle = gateAngle !== undefined ? gateAngle : gateStatus === 'CLOSED' ? 90 : 0;
          const stat = gateStatus || (angle >= 45 ? 'CLOSED' : 'OPEN');
          setGateState({ angle, status: stat });
        }

        if (buzzerOn !== undefined) {
          setBuzzerState((prev) => ({ ...prev, hardwareBuzzerOn: buzzerOn }));
        }

        if (pulseCount) {
          triggerBuzzer(pulseCount);
        }
      }
    },
    [addLog, triggerBuzzer, settleSlotDeparture]
  );

  // Check Web Serial and Web Bluetooth support on mount
  useEffect(() => {
    const supported = ArduinoSerialManager.isSupported() || HC05BluetoothManager.isSupported();
    setIsBrowserSupported(supported);
  }, []);

  const effectiveOccupiedCount = arduinoSummary
    ? arduinoSummary.totalOccupied
    : slots.filter((s) => s.status === 'OCCUPIED').length;

  // Connect via USB Cable (9600 Baud)
  const handleConnectUSB = async () => {
    setErrorMessage(null);
    try {
      setConnectionMode('connecting');
      addLog('[SYSTEM] Opening USB Serial connection at 9600 baud...', 'system');

      serialManager.setCallbacks(
        (line) => {
          handleIncomingSerialLine(line);
        },
        (error) => {
          if (error) {
            addLog(`[ERROR] USB Serial disconnected: ${error.message}`, 'error');
            setErrorMessage(error.message);
          } else {
            addLog('[SYSTEM] USB Serial disconnected cleanly.', 'system');
          }
          setConnectionMode('disconnected');
          setPortLabel(undefined);
        }
      );

      await serialManager.connect(9600);
      const portInfo = serialManager.getPortInfo();
      const detectedLabel = portInfo?.label || 'Arduino Uno (USB)';
      setPortLabel(detectedLabel);
      setConnectionMode('connected_usb');
      addLog(`[SYSTEM] Connected to ${detectedLabel} @ 9600 baud. Receiving live hardware data.`, 'system');
      notificationService.notifyHardwareConnected(detectedLabel);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'USB connection failed.';
      setErrorMessage(msg);
      addLog(`[SYSTEM] USB Connection aborted: ${msg}`, 'error');
      setConnectionMode('disconnected');
      setPortLabel(undefined);
    }
  };

  // Connect via HC-05 Bluetooth Module
  const handleConnectBluetooth = async (targetDeviceId?: string) => {
    setErrorMessage(null);
    try {
      setConnectionMode('connecting');
      addLog('[SYSTEM] Opening HC-05 Bluetooth connection...', 'system');

      hc05Bluetooth.setCallbacks(
        (line) => {
          handleIncomingSerialLine(line);
        },
        (error) => {
          if (error) {
            addLog(`[ERROR] Bluetooth disconnected: ${error.message}`, 'error');
            setErrorMessage(error.message);
            notificationService.notifyHardwareDisconnected(error.message);
          } else {
            addLog('[SYSTEM] Bluetooth disconnected.', 'system');
            notificationService.notifyHardwareDisconnected();
          }
          setConnectionMode('disconnected');
          setPortLabel(undefined);
        }
      );

      await hc05Bluetooth.connect(targetDeviceId);
      const devName = hc05Bluetooth.getDeviceName();
      setPortLabel(devName);
      setConnectionMode('connected_bt');
      addLog(`[SYSTEM] Connected to ${devName} wirelessly. Receiving live hardware data.`, 'system');
      notificationService.notifyHardwareConnected(devName);
      setIsBluetoothModalOpen(false);
    } catch (err: unknown) {
      try {
        serialManager.setCallbacks(
          (line) => {
            handleIncomingSerialLine(line);
          },
          (error) => {
            if (error) {
              addLog(`[ERROR] Bluetooth COM disconnected: ${error.message}`, 'error');
              setErrorMessage(error.message);
              notificationService.notifyHardwareDisconnected(error.message);
            } else {
              addLog('[SYSTEM] Bluetooth COM disconnected.', 'system');
              notificationService.notifyHardwareDisconnected();
            }
            setConnectionMode('disconnected');
            setPortLabel(undefined);
          }
        );

        await serialManager.connect(9600);
        setPortLabel('HC-05 (Bluetooth COM @ 9600)');
        setConnectionMode('connected_bt');
        addLog('[SYSTEM] Connected to HC-05 via Bluetooth COM port @ 9600 baud.', 'system');
        notificationService.notifyHardwareConnected('HC-05 Bluetooth COM');
        setIsBluetoothModalOpen(false);
        return;
      } catch {
        // Fallback did not apply
      }

      const msg = err instanceof Error ? err.message : 'Bluetooth connection failed.';
      setErrorMessage(msg);
      addLog(`[SYSTEM] Bluetooth Connection aborted: ${msg}`, 'error');
      setConnectionMode('disconnected');
      setPortLabel(undefined);
      throw err;
    }
  };

  const handleDisconnect = async () => {
    try {
      if (connectionMode === 'connected_usb') {
        await serialManager.disconnect();
      } else if (connectionMode === 'connected_bt') {
        if (hc05Bluetooth.isConnected()) {
          hc05Bluetooth.disconnect();
        } else {
          await serialManager.disconnect();
        }
      }
      setConnectionMode('disconnected');
      setPortLabel(undefined);
      notificationService.notifyHardwareDisconnected();
      addLog('[SYSTEM] Disconnected from hardware. Meter paused.', 'system');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error closing connection';
      addLog(`[ERROR] ${msg}`, 'error');
    }
  };

  const handleToggleAudio = () => {
    const nextState = !buzzerState.audioEnabled;
    buzzerAudio.setMuted(!nextState);
    setBuzzerState((prev) => ({ ...prev, audioEnabled: nextState }));
  };

  // Physical Keyboard Shortcuts for ChromeOS & Laptops
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // '?' -> Open ChromeOS Keyboard Shortcuts Guide
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsChromeOSModalOpen((prev) => !prev);
        return;
      }

      // 'Escape' -> Close modals or exit fullscreen
      if (e.key === 'Escape') {
        if (isParkingLotFullscreen) {
          setIsParkingLotFullscreen(false);
        }
        setIsChromeOSModalOpen(false);
        setIsBluetoothModalOpen(false);
        setIsArduinoGuideOpen(false);
        setIsNotificationModalOpen(false);
        setIsReceiptsModalOpen(false);
        setIsPermissionPromptOpen(false);
        return;
      }

      // '1', '2', '3' -> Select Parking Bay
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const slotNum = parseInt(e.key, 10);
        setSelectedSlotId((prev) => (prev === slotNum ? undefined : slotNum));
        return;
      }

      // 'Space' -> Trigger Hardware Buzzer Test Pulse
      if (e.code === 'Space') {
        e.preventDefault();
        triggerBuzzer(1);
        return;
      }

      // 'G' / 'g' -> Toggle Barrier Gate
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setGateState((prev) => {
          const nextStatus = prev.status === 'OPEN' ? 'CLOSED' : 'OPEN';
          const nextAngle = nextStatus === 'CLOSED' ? 90 : 0;
          addLog(`[GATE] Keyboard toggle: Gate is now ${nextStatus}`, 'system');
          return { angle: nextAngle, status: nextStatus };
        });
        return;
      }

      // 'F' / 'f' -> Toggle Fullscreen 3D View
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsParkingLotFullscreen((prev) => !prev);
        return;
      }

      // 'U' / 'u' -> Trigger USB Connection (Direct Chromebook Web Serial)
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        if (connectionMode === 'disconnected') {
          handleConnectUSB();
        }
        return;
      }

      // 'C' / 'c' -> Open Bluetooth Connection Modal
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsBluetoothModalOpen((prev) => !prev);
        return;
      }

      // 'T' / 't' -> Toggle Theme (Light / Dark)
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleTheme();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isParkingLotFullscreen,
    connectionMode,
    triggerBuzzer,
    toggleTheme,
    handleConnectUSB,
    addLog,
  ]);

  const isLight = theme === 'light';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isLight
          ? 'bg-slate-100 text-slate-900 selection:bg-cyan-500/20'
          : 'bg-[#080c14] text-slate-100 selection:bg-cyan-500/20'
      }`}
    >
      {/* Clean Top Header Bar */}
      <HeaderBar
        connectionMode={connectionMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onConnectUSB={handleConnectUSB}
        onConnectBluetooth={() => setIsBluetoothModalOpen(true)}
        onDisconnect={handleDisconnect}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onOpenChromeOSGuide={() => setIsChromeOSModalOpen(true)}
        portLabel={portLabel}
        isFullscreen={isParkingLotFullscreen}
        onToggleFullscreen={() => setIsParkingLotFullscreen((prev) => !prev)}
      />

      {/* In-App Live Notification Toast HUD */}
      <InAppToastContainer isLightMode={isLight} />

      {/* Dedicated True Fullscreen View for 3D Parking Yard (Covers entire screen with zero background bleed) */}
      {isParkingLotFullscreen && (
        <div className="fixed inset-0 z-[100] w-screen h-screen overflow-hidden bg-[#080c14] flex flex-col items-center justify-start">
          <IsometricParkingLot
            slots={slots}
            gateState={gateState}
            hardwareBuzzerOn={buzzerState.hardwareBuzzerOn}
            onSlotClick={(id) => {
              setSelectedSlotId(id);
            }}
            selectedSlotId={selectedSlotId}
            isLightMode={isLight}
            isFullscreen={true}
            onToggleFullscreen={(val) => setIsParkingLotFullscreen(val)}
            isConnected={isConnected}
          />
        </div>
      )}

      {/* Main Container - Optimized Spacing for Mobile Screens */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2.5 sm:px-6 md:px-8 py-3 sm:py-6 space-y-3 sm:space-y-5">
        {/* Top Summary Bar (2x2 Grid on Mobile) */}
        <TopSummary
          slots={slots}
          arduinoSummary={arduinoSummary}
          gateState={gateState}
          hardwareBuzzerOn={buzzerState.hardwareBuzzerOn}
          connectionMode={connectionMode}
          portLabel={portLabel}
          isLightMode={isLight}
          lastDataReceivedAt={lastDataReceivedAt}
          onConnectBluetooth={() => setIsBluetoothModalOpen(true)}
          onOpenReceipts={() => setIsReceiptsModalOpen(true)}
          onOpenChromeOSGuide={() => setIsChromeOSModalOpen(true)}
          isChromeOS={isChromeOS}
        />

        {/* 3D Isometric Parking Yard (Sleek Mobile Controls & Realistic Graphics) */}
        <IsometricParkingLot
          slots={slots}
          gateState={gateState}
          hardwareBuzzerOn={buzzerState.hardwareBuzzerOn}
          onSlotClick={(id) => {
            setSelectedSlotId(id);
          }}
          selectedSlotId={selectedSlotId}
          isLightMode={isLight}
          isFullscreen={false}
          onToggleFullscreen={(val) => setIsParkingLotFullscreen(val)}
          isConnected={isConnected}
        />

        {/* Common Buzzer Indicator */}
        <BuzzerIndicator
          buzzerState={buzzerState}
          onTriggerPulse={triggerBuzzer}
          onToggleAudio={handleToggleAudio}
          isLightMode={isLight}
        />

        {/* Live Slot Cards (Price, Live 3s Billing, Total Collection, Proximity Gauge) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              isConnected={isConnected}
              isLightMode={isLight}
            />
          ))}
        </div>

        {/* Real-Time Bluetooth Hardware Diagnostics */}
        <BluetoothDiagnostics
          connectionMode={connectionMode}
          portLabel={portLabel}
          lastRawMessage={lastRawMessage}
          lastDataReceivedAt={lastDataReceivedAt}
          validMessageCount={validMessageCount}
          isLightMode={isLight}
        />

        {/* Arduino Serial Monitor Console */}
        <SerialConsole
          logs={logs}
          connectionMode={connectionMode}
          onClearLogs={() => setLogs([])}
          onSendSerialCommand={(cmd) => handleIncomingSerialLine(cmd)}
          isBrowserSupported={isBrowserSupported}
          errorMessage={errorMessage}
          isLightMode={isLight}
        />
      </main>

      {/* Clean, Minimal Footer */}
      <footer
        className={`w-full border-t py-3 px-4 text-center text-xs font-mono transition-colors ${
          isLight ? 'border-slate-200 text-slate-500 bg-white' : 'border-slate-800/80 text-slate-500 bg-[#080c14]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span>Smart Parking</span>
          <span className="opacity-30">·</span>
          <span className="font-gujarati font-bold text-amber-500">લાખાપર પાર્કિંગ વિસ્તાર</span>
          <span className="opacity-30">·</span>
          <span className="font-gujarati text-slate-500">શ્રી સરકારી માધ્યમિક શાળા લાખાપર</span>
          <span className="opacity-30">·</span>
          <button
            onClick={() => downloadArduinoInoFile()}
            className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-bold"
          >
            📥 Download Arduino Firmware (.ino)
          </button>
          <span className="opacity-30">·</span>
          <button
            onClick={() => setIsArduinoGuideOpen(true)}
            className="text-slate-500 hover:text-slate-400 hover:underline cursor-pointer"
          >
            Wiring Diagram
          </button>
          <span className="opacity-30">·</span>
          <button
            onClick={() => setIsChromeOSModalOpen(true)}
            className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-bold"
          >
            💻 ChromeOS Shortcuts
          </button>
        </div>
      </footer>

      {/* Receipts & Collection History Modal */}
      <ReceiptsModal
        isOpen={isReceiptsModalOpen}
        onClose={() => setIsReceiptsModalOpen(false)}
        receipts={receipts}
        slots={slots}
        isLightMode={isLight}
      />

      {/* First Launch Permissions Onboarding Modal */}
      <PermissionPromptModal
        isOpen={isPermissionPromptOpen}
        onClose={() => setIsPermissionPromptOpen(false)}
        isLightMode={isLight}
      />

      {/* Arduino Firmware & Wiring Guide Modal */}
      <ArduinoGuideModal
        isOpen={isArduinoGuideOpen}
        onClose={() => setIsArduinoGuideOpen(false)}
        isLightMode={isLight}
      />

      {/* Interactive Bluetooth Connect & Pairing Modal */}
      <BluetoothConnectModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        connectionMode={connectionMode}
        portLabel={portLabel}
        onConnectBluetooth={handleConnectBluetooth}
        onDisconnect={handleDisconnect}
        onConnectUSB={handleConnectUSB}
        onSimulateTelemetry={(lines) => lines.forEach((l) => handleIncomingSerialLine(l))}
        isLightMode={isLight}
      />

      {/* Useful Notification Settings & Device Permissions Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        isLightMode={isLight}
      />

      {/* ChromeOS & Chromebook Optimization Guide Modal */}
      <ChromeOSGuideModal
        isOpen={isChromeOSModalOpen}
        onClose={() => setIsChromeOSModalOpen(false)}
        isLightMode={isLight}
        onInstallPWA={handleInstallPWA}
        canInstallPWA={Boolean(deferredPrompt)}
        isPWAInstalled={isPWAInstalled}
      />
    </div>
  );
}
