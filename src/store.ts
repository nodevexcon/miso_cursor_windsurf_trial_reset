import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProgressPayload } from './electron.d';

// #region: Types
export interface TargetApplication {
  id: string;
  name: string;
}

export interface ResetOption {
  id: string;
  label: string;
  details: string;
  checked: boolean;
  platforms: ('win32' | 'darwin')[];
  category: 'Basic' | 'Advanced';
}

export interface LogEntry {
  message: string;
  level: 'info' | 'success' | 'error' | 'warn';
  timestamp: string;
}

export interface Profile {
  name: string;
  selectedAppId: string;
  options: { [key: string]: boolean };
}

type AppStatus = 'idle' | 'analyzing' | 'resetting' | 'complete' | 'error';
type AppView = 'resetter' | 'cleaner';

export interface AppState {
  // Static Data
  platform: 'win32' | 'darwin' | 'linux' | '';
  supportedApps: TargetApplication[];
  allOptions: ResetOption[];
  
  // App Status
  status: AppStatus;
  activeView: AppView;
  
  // User Selections
  selectedApp: TargetApplication;
  activeCategory: 'Basic' | 'Advanced';
  
  // Runtime Data
  logs: LogEntry[];
  progress: {
    value: number;
    total: number;
    message: string;
  };

  // Profiles
  profiles: Profile[];

  // Actions
  initialize: (platform: 'win32' | 'darwin' | 'linux' | '') => void;
  setView: (view: AppView) => void;
  setApp: (app: TargetApplication) => void;
  setCategory: (category: 'Basic' | 'Advanced') => void;
  toggleOption: (id: string) => void;
  startReset: () => void;
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
  handleProgress: (payload: ProgressPayload) => void;
  saveProfile: (name: string) => void;
  loadProfile: (name: string) => void;
  deleteProfile: (name: string) => void;
}
// #endregion

// #region: Initial State & Data
const supportedApps: TargetApplication[] = [
    { id: 'vscode', name: 'VS Code' },
    { id: 'cursor', name: 'Cursor' },
    { id: 'codeium', name: 'Codeium' },
];

const initialOptions: ResetOption[] = [
    // Basic Options
    { id: 'cleanAppData', label: 'Clean {APP_NAME} Data', details: 'Removes configuration, caches, and extension data for {APP_NAME}.', checked: true, platforms: ['win32', 'darwin'], category: 'Basic' },
    { id: 'browserData', label: 'Clean Browser & App Data', details: 'Deletes user data from Chrome, Edge, Firefox, Discord, and Slack.', checked: false, platforms: ['win32', 'darwin'], category: 'Basic' },
    { id: 'otherCaches', label: 'Clear Other Identifiers and Caches', details: 'Clears system temp folders and prefetch files.', checked: true, platforms: ['win32', 'darwin'], category: 'Basic' },
    { id: 'networkId', label: 'Reset Network Identity', details: 'Flushes DNS cache and renews network configuration.', checked: true, platforms: ['win32', 'darwin'], category: 'Basic' },
    { id: 'registryCleanup', label: 'Registry Cleanup', details: 'Deletes registry keys related to application usage and identifiers.', checked: true, platforms: ['win32'], category: 'Basic' },
    
    // Advanced Options
    { id: 'macAddress', label: 'Randomize MAC Addresses', details: 'Changes the hardware address of network adapters. May require a reboot.', checked: false, platforms: ['win32', 'darwin'], category: 'Advanced' },
    { id: 'hostname', label: 'Randomize Computer Name', details: 'Assigns a new random hostname to the computer. Requires a reboot.', checked: false, platforms: ['win32', 'darwin'], category: 'Advanced' },
    { id: 'machineId', label: 'Change Machine GUID', details: 'Generates a new machine GUID in the registry.', checked: true, platforms: ['win32'], category: 'Advanced' },
    { id: 'systemSettings', label: 'Modify System Settings', details: 'Randomly changes the system timezone to a new value.', checked: false, platforms: ['win32'], category: 'Advanced' },
    { id: 'telemetry', label: 'Disable Telemetry', details: 'Disables Windows data collection and telemetry services.', checked: true, platforms: ['win32'], category: 'Advanced' },
    { id: 'installId', label: 'Randomize Installation ID', details: 'Changes the recorded installation date of Windows.', checked: false, platforms: ['win32'], category: 'Advanced'},
    { id: 'volumeId', label: 'Change Volume ID (Requires VolumeID.exe)', details: 'Changes the serial number of the C: drive. You must place VolumeID.exe from Sysinternals in a `bin` folder next to the application.', checked: false, platforms: ['win32'], category: 'Advanced' },
    { id: 'wmiReset', label: 'Reset WMI Repository', details: 'Resets the Windows Management Instrumentation database. This is an aggressive option that may affect other applications.', checked: false, platforms: ['win32'], category: 'Advanced' },
    { id: 'systemLogs', label: 'Clear System-Level Logs', details: 'Deletes advanced logs like Windows Error Reporting and app usage databases.', checked: false, platforms: ['win32', 'darwin'], category: 'Advanced' },
];
// #endregion

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      platform: '',
      supportedApps,
      allOptions: initialOptions,
      status: 'idle',
      activeView: 'resetter',
      selectedApp: supportedApps[0],
      activeCategory: 'Basic',
      logs: [],
      progress: { value: 0, total: 0, message: '' },
      profiles: [],

      // Actions
      initialize: (platform: 'win32' | 'darwin' | 'linux' | '') => set({ platform }),
      setView: (view: AppView) => set({ activeView: view }),
      setApp: (app: TargetApplication) => set({ selectedApp: app }),
      setCategory: (category: 'Basic' | 'Advanced') => set({ activeCategory: category }),
      toggleOption: (id: string) => set((state) => ({
        allOptions: state.allOptions.map(opt => 
          opt.id === id ? { ...opt, checked: !opt.checked } : opt
        )
      })),
      startReset: () => set({ status: 'resetting', logs: [], progress: { value: 0, total: 0, message: '' } }),
      addLog: (log: Omit<LogEntry, 'timestamp'>) => set((state) => ({
        logs: [...state.logs, { ...log, timestamp: new Date().toLocaleTimeString() }]
      })),
      handleProgress: (payload: ProgressPayload) => {
        const state = get();
        if (payload.type === 'log') {
            state.addLog({ message: payload.message, level: payload.level });
        } else if (payload.type === 'progress' && payload.total) {
            set({ progress: { value: payload.progress, total: payload.total, message: payload.message } });
        } else if (payload.type === 'complete') {
            set({ status: 'complete', progress: { ...state.progress, value: state.progress.total, message: 'Process finished.' } });
        } else if (payload.type === 'error') {
            state.addLog({ message: payload.message, level: 'error' });
            set({ status: 'error' });
        }
      },
      saveProfile: (name: string) => {
        if (!name.trim()) return;
        const { selectedApp, allOptions, profiles } = get();
        const newProfile: Profile = {
          name: name.trim(),
          selectedAppId: selectedApp.id,
          options: allOptions.reduce((acc, option) => ({ ...acc, [option.id]: option.checked }), {} as { [key: string]: boolean }),
        };
        const updatedProfiles = [...profiles.filter(p => p.name !== newProfile.name), newProfile];
        set({ profiles: updatedProfiles });
      },
      loadProfile: (name: string) => {
        const { profiles, supportedApps, allOptions } = get();
        const profile = profiles.find(p => p.name === name);
        if (!profile) return;
        set({
          selectedApp: supportedApps.find(app => app.id === profile.selectedAppId) || supportedApps[0],
          allOptions: allOptions.map(opt => ({ ...opt, checked: profile.options[opt.id] ?? opt.checked })),
        });
      },
      deleteProfile: (name: string) => {
        set((state) => ({ profiles: state.profiles.filter(p => p.name !== name) }));
      }
    }),
    {
      name: 'trial-resetter-storage', // local storage key
      partialize: (state) => ({ profiles: state.profiles }), // only persist profiles
    }
  )
); 