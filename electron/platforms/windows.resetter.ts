import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';

import { execCommand } from '../utils/command.runner';
import { deletePath, expandPath, deleteRegKey } from '../utils/file.utils';
import { IResetter, ITask, IApplication, IFinding } from '../core/types';
import config from '../../config.json';
import { findLeftovers } from '../core/app.cleaner';

async function updateMachineGuid() {
  const newGuid = uuidv4();
  await execCommand('REG', ['ADD', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/t', 'REG_SZ', '/d', newGuid, '/f'], true);
}

async function resetNetwork() {
  await execCommand('ipconfig', ['/flushdns']);
  await execCommand('ipconfig', ['/release']);
  await execCommand('ipconfig', ['/renew']);
}

async function changeTimezone() {
  const timezones = config.win32.timezones;
  const selectedTz = timezones[Math.floor(Math.random() * timezones.length)];
  await execCommand('tzutil', ['/s', selectedTz]);
}

async function disableTelemetry() {
  await execCommand('sc', ['delete', 'DiagTrack'], true).catch(() => { /* Ignore */ });
  await execCommand('sc', ['delete', 'dmwappushservice'], true).catch(() => { /* Ignore */ });
}

async function randomizeHostname() {
  const newName = 'DESKTOP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  // WMIC commands often require specific shell parsing, so we use the complex command execution path.
  await execCommand(`WMIC ComputerSystem where Name="%COMPUTERNAME%" call Rename "${newName}"`, [], true);
}

async function changeMacAddress() {
  // This is complex and error-prone. A dedicated library or a more robust script is recommended.
  // For now, we will notify the user that this part is best done manually or with a specific tool.
  console.warn("MAC address randomization on Windows is complex and skipped.");
}

async function changeWindowsInstallIds() {
  const newTimestamp = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 31536000); // Now minus up to a year
  await execCommand('reg', ['add', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'InstallDate', '/t', 'REG_DWORD', '/d', newTimestamp.toString(), '/f'], true);
}

async function changeVolumeId() {
    const volumeIdPath = path.join(process.cwd(), 'bin', 'VolumeID.exe');
    if (!await fs.pathExists(volumeIdPath)) {
      console.error(`VolumeID.exe not found at ${volumeIdPath}. Skipping.`);
      return;
    }
    const newId = `${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}`.toUpperCase();
    await execCommand(volumeIdPath, ['C:', newId], true);
}

async function resetWmi() {
  await execCommand('net stop winmgmt /y && winmgmt /resetrepository && net start winmgmt', [], true);
}

async function cleanSystemLogs() {
  const werPath = expandPath('%ALLUSERSPROFILE%\\Microsoft\\Windows\\WER');
  await deletePath(werPath);

  const dbPath = expandPath('%WINDIR%\\System32\\sru\\SRUDB.dat');
  const command = `net stop "Diagnostic Policy Service" /y && del /F /Q "${dbPath}" && net start "Diagnostic Policy Service"`;
  await execCommand(command, [], true)
    .catch(err => console.error("Failed to clean SRUDB.dat:", err));
}

export class WindowsResetter implements IResetter {
  constructor() {
    // No longer needs mainWindow
  }

  async smartScan(): Promise<IFinding[]> {
    const findings: IFinding[] = [];
    const scanPaths = [
      expandPath('%APPDATA%'),
      expandPath('%LOCALAPPDATA%'),
      expandPath('%PROGRAMDATA%'),
    ];

    const commonAppNames = ['*', '*/*', '*/*/*', '*/*/*/*']; // Scan up to 4 levels deep
    
    for (const scanPath of scanPaths) {
      for (const appName of commonAppNames) {
        const searchPattern = path.join(scanPath, appName).replace(/\\/g, '/');
        const results = await glob(searchPattern);
        for (const res of results) {
          findings.push({ type: 'directory', path: res });
        }
      }
    }
    
    // Add common registry locations to scan if needed
    // For example:
    // findings.push({ type: 'registry', path: 'HKCU\\Software\\SomeCommonApp' });

    console.log(`Windows Smart Scan found ${findings.length} items.`);
    return findings;
  }

  async createTasks(options: string[], application: IApplication, onLog: (message: string) => void): Promise<ITask[]> {
    const tasks: ITask[] = [];
    const winConfig = config.win32;

    if (options.includes('cleanAppData')) {
      const appConfig = (config.applications as any)[application.id];
      appConfig.paths.win32.forEach((appPath: string) => {
        tasks.push({
          description: `Cleaning ${application.name} data at ${appPath}`,
          action: () => deletePath(appPath)
        });
      });
    }

    if (options.includes('browserData')) {
      tasks.push(...config.genericPaths.win32.map(p => ({
        description: `Cleaning browser data at ${p}`,
        action: () => deletePath(p)
      })));
    }

    if (options.includes('registryCleanup')) {
      const appConfig = (config.applications as any)[application.id];
      tasks.push(...appConfig.registry.map((key: string) => ({
        description: `Deleting registry key ${key}`,
        action: () => deleteRegKey(key)
      })));
      tasks.push(...winConfig.registryKeys.map(key => ({
        description: `Deleting generic registry key ${key}`,
        action: () => deleteRegKey(key)
    })));
    }
    
    if (options.includes('machineId')) tasks.push({ description: 'Updating Machine GUID', action: () => updateMachineGuid() });
    if (options.includes('networkId')) tasks.push({ description: 'Resetting Network Adapters', action: () => resetNetwork() });
    if (options.includes('systemSettings')) tasks.push({ description: 'Changing Timezone', action: () => changeTimezone() });
    if (options.includes('telemetry')) tasks.push({ description: 'Disabling Telemetry Services', action: () => disableTelemetry() });
    if (options.includes('hostname')) tasks.push({ description: 'Randomizing Hostname', action: () => randomizeHostname() });
    if (options.includes('macAddress')) tasks.push({ description: 'Randomizing MAC Address (Manual Advised)', action: () => changeMacAddress() });
    if (options.includes('installId')) tasks.push({ description: 'Changing Installation Timestamps', action: () => changeWindowsInstallIds() });
    if (options.includes('volumeId')) tasks.push({ description: 'Changing Volume ID', action: () => changeVolumeId() });
    if (options.includes('wmiReset')) tasks.push({ description: 'Resetting WMI Repository', action: () => resetWmi() });
    if (options.includes('systemLogs')) tasks.push({ description: 'Clearing System Event Logs', action: () => cleanSystemLogs() });
    if (options.includes('otherCaches')) {
        tasks.push(...config.genericPaths.win32.filter(p => p.includes('Temp')).map(p => ({ // Assuming temp paths are for 'otherCaches'
            description: `Clearing cache path: ${p}`,
            action: () => deletePath(p)
        })));
      }

    if (options.includes('deepClean')) {
        onLog("Akıllı Derinlemesine Temizlik başlatılıyor...");
        const leftovers = await findLeftovers(application, onLog);
        
        leftovers.forEach(item => {
            if(item.type === 'file' || item.type === 'directory') {
                tasks.push({
                    description: `[Derinlemesine Temizlik] Artık dosya siliniyor: ${item.path}`,
                    action: () => deletePath(item.path)
                });
            } else if (item.type === 'registry') {
                tasks.push({
                    description: `[Derinlemesine Temizlik] Artık kayıt defteri anahtarı siliniyor: ${item.path}`,
                    action: () => deleteRegKey(item.path)
                });
            }
        });
        onLog(`Akıllı Derinlemesine Temizlik ${leftovers.length} ek görev ekledi.`);
    }

    return tasks;
  }
} 