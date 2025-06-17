export interface ITask {
  description: string;
  action: () => Promise<any>;
}

export interface IApplication {
  id: string; // e.g., 'codeium'
  name: string; // e.g., 'Codeium'
}

export interface IResetter {
  createTasks(options: string[], application: IApplication): ITask[];
}

export interface IFinding {
    category: string;
    path: string;
    size: number;
    formattedSize: string;
}

export interface IAnalyzer {
    analyze(options: string[], application: IApplication): Promise<IFinding[]>;
}

export interface IFoundItem {
    type: 'file' | 'registry';
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