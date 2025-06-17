import { IResetter, ITask, IApplication, IFinding } from '../core/types';
import path from 'path';
import os from 'os';
import { glob } from 'glob';

export class LinuxResetter implements IResetter {
  private getCommonDirectories(): string[] {
    const homeDir = os.homedir();
    return [
      path.join(homeDir, '.config'),
      path.join(homeDir, '.local', 'share'),
      path.join(homeDir, '.cache'),
    ];
  }

  async smartScan(): Promise<IFinding[]> {
    const findings: IFinding[] = [];
    const scanPaths = this.getCommonDirectories();

    const commonAppNames = ['*', '*/*', '*/*/*']; // Scan up to 3 levels deep

    for (const scanPath of scanPaths) {
      for (const appName of commonAppNames) {
        const searchPattern = path.join(scanPath, appName);
        const results = await glob(searchPattern);
        for (const res of results) {
          findings.push({ type: 'directory', path: res });
        }
      }
    }
    
    console.log(`Linux Smart Scan found ${findings.length} items.`);
    return findings;
  }

  createTasks(options: string[], application: IApplication): ITask[] {
    const tasks: ITask[] = [];
    console.log('Creating tasks for Linux...', options, application);
    // In the future, this will be populated with actual reset tasks for Linux.
    // For now, it returns an empty array.
    return tasks;
  }
} 