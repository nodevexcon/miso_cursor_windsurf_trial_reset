// This defines the structure of data sent from the backend to the frontend.
export type ProgressPayload = {
  type: 'log';
  message: string;
  level: 'info' | 'success' | 'error' | 'warn';
} | {
  type: 'progress';
  progress: number;
  total: number;
  message: string;
} | {
  type: 'complete';
  total: number;
} | {
  type: 'error',
  message: string;
};

export interface ExeMetadata {
  appName: string;
  publisher: string;
  details: {
      ProductName?: string;
      CompanyName?: string;
      FileDescription?: string;
      InternalName?: string;
      OriginalFilename?: string;
  }
}

export interface IApplication {
  id: string; 
  name: string;
}

declare global {
  interface Window {
    electron: {
      getPlatform: () => Promise<'win32' | 'darwin' | 'linux'>;
      checkAdmin: () => Promise<boolean>;
      requestAdmin: () => Promise<boolean>;
      executeReset: (options: string[], application: IApplication) => Promise<void>;
      analyzeActions: (options: string[], application: IApplication) => Promise<any[]>;
      onResetProgress: (callback: (data: ProgressPayload) => void) => (() => void);
      getExeMetadata: (filePath: string) => Promise<ExeMetadata>;
      findLeftovers: (metadata: ExeMetadata) => Promise<any[]>;
      deleteItems: (items: any[]) => Promise<void>;
      onAppCleanerProgress: (callback: (data: { type: 'log', message: string }) => void) => (() => void);
    };
  }
}

export {}; 