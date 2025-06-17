export interface ITask {
  description: string;
  action: () => Promise<any>;
}

export interface IApplication {
  id: string; // e.g., 'codeium'
  name: string; // e.g., 'Codeium'
}

export interface IResetter {
  createTasks(options: string[], application: IApplication, onLog: (message: string) => void): Promise<ITask[]>;
  smartScan(): Promise<IFinding[]>;
}

export interface IFinding {
    type: 'file' | 'directory' | 'registry';
    path: string;
    // size?: number; // Size might not be applicable for all types (like registry)
}

export interface IAnalyzer {
    analyze(options: string[], application: IApplication): Promise<IFinding[]>;
}

export interface IFoundItem {
    type: 'file' | 'directory' | 'registry';
    path: string;
    description: string;
}

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