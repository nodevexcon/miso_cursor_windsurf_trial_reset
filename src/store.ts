import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProgressPayload } from './electron.d';
import type { IFoundItem } from '../electron/core/types';

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
  platforms: ('win32' | 'darwin' | 'linux')[];
  category: 'Basic' | 'Advanced' | 'System';
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

type WorkflowStep = 'selection' | 'analyzing' | 'review' | 'executing' | 'complete';
type Theme = 'light' | 'dark';

export interface AppState {
  // Static Data
  platform: 'win32' | 'darwin' | 'linux' | '';
  supportedApps: TargetApplication[];
  allOptions: ResetOption[];
  
  // Workflow Status
  workflowStep: WorkflowStep;
  
  // User Selections
  selectedApp: TargetApplication | null;
  
  // Runtime Data
  logs: LogEntry[];
  progress: {
    value: number;
    total: number;
    message: string;
  };
  foundItems: IFoundItem[];
  selectedItems: Set<string>;

  // Profiles & Theme
  profiles: Profile[];
  theme: Theme;

  // Actions
  initialize: (platform: 'win32' | 'darwin' | 'linux' | '') => void;
  setApp: (app: TargetApplication | null) => void;
  startAnalysis: (app: TargetApplication) => void;
  analysisComplete: (items: IFoundItem[]) => void;
  toggleOption: (id: string) => void;
  toggleItemSelection: (path: string) => void;
  selectAllItems: (select: boolean) => void;
  startExecution: () => void;
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
  handleProgress: (payload: ProgressPayload) => void;
  saveProfile: (name: string) => void;
  loadProfile: (name: string) => void;
  deleteProfile: (name: string) => void;
  toggleTheme: () => void;
  resetWorkflow: () => void;
}
// #endregion

// #region: Initial State & Data
const supportedApps: TargetApplication[] = [
    { id: 'vscode', name: 'VS Code' },
    { id: 'cursor', name: 'Cursor' },
    { id: 'codeium', name: 'Codeium' },
];

const initialOptions: ResetOption[] = [
    // Basic Options (will be shown in review screen)
    { id: 'cleanAppData', label: 'Uygulama Verilerini Temizle', details: 'Yapılandırma, önbellek ve eklenti verilerini kaldırır.', checked: true, platforms: ['win32', 'darwin', 'linux'], category: 'Basic' },
    { id: 'deepClean', label: 'Akıllı Derinlemesine Temizlik', details: 'Sistemi ek artık dosyalar ve kayıt defteri anahtarları için tarar.', checked: true, platforms: ['win32', 'darwin', 'linux'], category: 'Advanced' },
    
    // System-level options
    { id: 'networkId', label: 'Ağ Kimliğini Sıfırla', details: 'DNS önbelleğini temizler ve ağ yapılandırmasını yeniler.', checked: true, platforms: ['win32', 'darwin'], category: 'System' },
    { id: 'registryCleanup', label: 'Genel Kayıt Defteri Temizliği', details: 'Genel uygulama kullanım kimlikleriyle ilgili kayıt defteri anahtarlarını siler.', checked: true, platforms: ['win32'], category: 'System' },
    { id: 'machineId', label: 'Makine GUID Değiştir', details: 'Kayıt defterinde yeni bir makine GUID\'i oluşturur.', checked: true, platforms: ['win32'], category: 'System' },
    { id: 'telemetry', label: 'Telemetriyi Devre Dışı Bırak', details: 'Windows veri toplama ve telemetri hizmetlerini devre dışı bırakır.', checked: true, platforms: ['win32'], category: 'System' },
];
// #endregion

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      platform: '',
      supportedApps,
      allOptions: initialOptions,
      workflowStep: 'selection',
      selectedApp: null,
      logs: [],
      progress: { value: 0, total: 0, message: '' },
      foundItems: [],
      selectedItems: new Set(),
      profiles: [],
      theme: 'dark',

      // Actions
      initialize: (platform) => set({ platform }),
      setApp: (app) => set({ selectedApp: app }),
      startAnalysis: (app) => set({ 
        workflowStep: 'analyzing',
        selectedApp: app,
        logs: [],
        foundItems: [],
        selectedItems: new Set(),
        progress: { value: 0, total: 0, message: `'${app.name}' için analiz başlatılıyor...` }
      }),
      analysisComplete: (items) => set((state) => ({
        workflowStep: 'review',
        foundItems: items,
        selectedItems: new Set(items.map(i => i.path)), // Select all by default
        progress: { ...state.progress, message: `Analiz tamamlandı. ${items.length} öğe bulundu.`}
      })),
      toggleOption: (id) => set((state) => ({
        allOptions: state.allOptions.map(opt => 
          opt.id === id ? { ...opt, checked: !opt.checked } : opt
        )
      })),
      toggleItemSelection: (path) => set(state => {
        const newSet = new Set(state.selectedItems);
        if (newSet.has(path)) newSet.delete(path);
        else newSet.add(path);
        return { selectedItems: newSet };
      }),
      selectAllItems: (select) => set(state => ({
        selectedItems: select ? new Set(state.foundItems.map(i => i.path)) : new Set()
      })),
      startExecution: () => set({ 
        workflowStep: 'executing', 
        logs: [], 
        progress: { value: 0, total: 0, message: 'Sıfırlama işlemi başlatılıyor...' } 
      }),
      addLog: (log) => set((state) => ({
        logs: [...state.logs, { ...log, timestamp: new Date().toLocaleTimeString() }]
      })),
      handleProgress: (payload: ProgressPayload) => {
        const state = get();
        if (payload.type === 'log') {
            state.addLog({ message: payload.message, level: payload.level });
        } else if (payload.type === 'progress' && payload.total) {
            set({ progress: { value: payload.progress, total: payload.total, message: payload.message } });
        } else if (payload.type === 'complete') {
            set({ workflowStep: 'complete', progress: { ...state.progress, value: state.progress.total, message: 'İşlem tamamlandı.' } });
        } else if (payload.type === 'error') {
            state.addLog({ message: payload.message, level: 'error' });
            set({ workflowStep: 'review' }); // Revert to review step on error
        }
      },
      saveProfile: (name: string) => { /* ... to be implemented ... */ },
      loadProfile: (name: string) => { /* ... to be implemented ... */ },
      deleteProfile: (name: string) => set((state) => ({ profiles: state.profiles.filter(p => p.name !== name) })),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      resetWorkflow: () => set({
        workflowStep: 'selection',
        selectedApp: null,
        foundItems: [],
        selectedItems: new Set(),
        logs: [],
        progress: { value: 0, total: 0, message: '' }
      }),
    }),
    {
      name: 'trial-resetter-storage-v2', // Changed key to avoid conflicts with old structure
      partialize: (state) => ({ profiles: state.profiles, theme: state.theme }),
    }
  )
); 