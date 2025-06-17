import { IResetter, ITask, IApplication, IFinding } from '../core/types';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import { findLeftovers } from '../core/app.cleaner';
import { deletePath } from '../utils/file.utils';
import config from '../../config.json';

export class MacosResetter implements IResetter {
  private getCommonDirectories(): string[] {
    const homeDir = os.homedir();
    return [
      path.join(homeDir, 'Library', 'Application Support'),
      path.join(homeDir, 'Library', 'Caches'),
      path.join(homeDir, 'Library', 'Preferences'),
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
    
    console.log(`macOS Smart Scan found ${findings.length} items.`);
    return findings;
  }

  async createTasks(options: string[], application: IApplication, onLog: (message: string) => void): Promise<ITask[]> {
    const tasks: ITask[] = [];
    const appConfig = (config.applications as any)[application.id];

    if (options.includes('cleanAppData')) {
      (appConfig?.paths?.darwin || []).forEach((appPath: string) => {
        tasks.push({
          description: `Cleaning ${application.name} data at ${appPath}`,
          action: () => deletePath(appPath)
        });
      });
    }

    if (options.includes('deepClean')) {
        onLog("Akıllı Derinlemesine Temizlik (macOS) başlatılıyor...");
        const leftovers = await findLeftovers(application, onLog);
        
        leftovers.forEach(item => {
            if(item.type === 'file' || item.type === 'directory') {
                tasks.push({
                    description: `[Derinlemesine Temizlik] Artık dosya/klasör siliniyor: ${item.path}`,
                    action: () => deletePath(item.path)
                });
            }
            // macOS does not have a registry, so no need to check for item.type === 'registry'
        });
        onLog(`Akıllı Derinlemesine Temizlik (macOS) ${leftovers.length} ek görev ekledi.`);
    }

    // Add other macOS-specific tasks from options if needed

    return tasks;
  }
} 