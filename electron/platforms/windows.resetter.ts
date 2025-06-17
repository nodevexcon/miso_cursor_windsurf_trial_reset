import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

import { execCommand } from '../utils/command.runner';
import { deletePath, expandPath, deleteRegKey } from '../utils/file.utils';
import { IResetter, ITask, IApplication } from '../core/types';
import config from '../../config.json';

async function updateMachineGuid(mainWindow: BrowserWindow) {
  const newGuid = uuidv4();
  await execCommand(mainWindow, 'REG', ['ADD', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/t', 'REG_SZ', '/d', newGuid, '/f'], true);
}

async function resetNetwork(mainWindow: BrowserWindow) {
  await execCommand(mainWindow, 'ipconfig', ['/flushdns']);
  await execCommand(mainWindow, 'ipconfig', ['/release']);
  await execCommand(mainWindow, 'ipconfig', ['/renew']);
}

async function changeTimezone(mainWindow: BrowserWindow) {
  const timezones = config.win32.timezones;
  const selectedTz = timezones[Math.floor(Math.random() * timezones.length)];
  await execCommand(mainWindow, 'tzutil', ['/s', selectedTz]);
}

async function disableTelemetry(mainWindow: BrowserWindow) {
  await execCommand(mainWindow, 'sc', ['delete', 'DiagTrack'], true).catch(() => { /* Ignore */ });
  await execCommand(mainWindow, 'sc', ['delete', 'dmwappushservice'], true).catch(() => { /* Ignore */ });
}

async function randomizeHostname(mainWindow: BrowserWindow) {
  const newName = 'DESKTOP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  // WMIC commands often require specific shell parsing, so we use the complex command execution path.
  await execCommand(mainWindow, `WMIC ComputerSystem where Name="%COMPUTERNAME%" call Rename "${newName}"`, [], true);
}

async function changeMacAddress(mainWindow: BrowserWindow) {
  // This is complex and error-prone. A dedicated library or a more robust script is recommended.
  // For now, we will notify the user that this part is best done manually or with a specific tool.
  console.warn("MAC address randomization on Windows is complex and skipped.");
}

async function changeWindowsInstallIds(mainWindow: BrowserWindow) {
  const newTimestamp = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 31536000); // Now minus up to a year
  await execCommand(mainWindow, 'reg', ['add', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'InstallDate', '/t', 'REG_DWORD', '/d', newTimestamp.toString(), '/f'], true);
}

async function changeVolumeId(mainWindow: BrowserWindow) {
    const volumeIdPath = path.join(process.cwd(), 'bin', 'VolumeID.exe');
    if (!await fs.pathExists(volumeIdPath)) {
      console.error(`VolumeID.exe not found at ${volumeIdPath}. Skipping.`);
      return;
    }
    const newId = `${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}`.toUpperCase();
    await execCommand(mainWindow, volumeIdPath, ['C:', newId], true);
}

async function resetWmi(mainWindow: BrowserWindow) {
  await execCommand(mainWindow, 'net stop winmgmt /y && winmgmt /resetrepository && net start winmgmt', [], true);
}

async function cleanSystemLogs(mainWindow: BrowserWindow) {
  const werPath = expandPath('%ALLUSERSPROFILE%\\Microsoft\\Windows\\WER');
  await deletePath(mainWindow, werPath);

  const dbPath = expandPath('%WINDIR%\\System32\\sru\\SRUDB.dat');
  const command = `net stop "Diagnostic Policy Service" /y && del /F /Q "${dbPath}" && net start "Diagnostic Policy Service"`;
  await execCommand(mainWindow, command, [], true)
    .catch(err => console.error("Failed to clean SRUDB.dat:", err));
}

export class WindowsResetter implements IResetter {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  createTasks(options: string[], application: IApplication): ITask[] {
    const tasks: ITask[] = [];
    const winConfig = config.win32;

    if (options.includes('cleanAppData')) {
      const appConfig = (config.applications as any)[application.id];
      appConfig.paths.win32.forEach((appPath: string) => {
        tasks.push({
          description: `Cleaning ${application.name} data at ${appPath}`,
          action: () => deletePath(this.mainWindow, appPath)
        });
      });
    }

    if (options.includes('browserData')) {
      tasks.push(...config.genericPaths.win32.map(p => ({
        description: `Cleaning browser data at ${p}`,
        action: () => deletePath(this.mainWindow, p)
      })));
    }

    if (options.includes('registryCleanup')) {
      const appConfig = (config.applications as any)[application.id];
      tasks.push(...appConfig.registry.map((key: string) => ({
        description: `Deleting registry key ${key}`,
        action: () => deleteRegKey(this.mainWindow, key)
      })));
      tasks.push(...winConfig.registryKeys.map(key => ({
        description: `Deleting generic registry key ${key}`,
        action: () => deleteRegKey(this.mainWindow, key)
    })));
    }
    
    if (options.includes('machineId')) tasks.push({ description: 'Updating Machine GUID', action: () => updateMachineGuid(this.mainWindow) });
    if (options.includes('networkId')) tasks.push({ description: 'Resetting Network Adapters', action: () => resetNetwork(this.mainWindow) });
    if (options.includes('systemSettings')) tasks.push({ description: 'Changing Timezone', action: () => changeTimezone(this.mainWindow) });
    if (options.includes('telemetry')) tasks.push({ description: 'Disabling Telemetry Services', action: () => disableTelemetry(this.mainWindow) });
    if (options.includes('hostname')) tasks.push({ description: 'Randomizing Hostname', action: () => randomizeHostname(this.mainWindow) });
    if (options.includes('macAddress')) tasks.push({ description: 'Randomizing MAC Address (Manual Advised)', action: () => changeMacAddress(this.mainWindow) });
    if (options.includes('installId')) tasks.push({ description: 'Changing Installation Timestamps', action: () => changeWindowsInstallIds(this.mainWindow) });
    if (options.includes('volumeId')) tasks.push({ description: 'Changing Volume ID', action: () => changeVolumeId(this.mainWindow) });
    if (options.includes('wmiReset')) tasks.push({ description: 'Resetting WMI Repository', action: () => resetWmi(this.mainWindow) });
    if (options.includes('systemLogs')) tasks.push({ description: 'Clearing System Event Logs', action: () => cleanSystemLogs(this.mainWindow) });
    if (options.includes('otherCaches')) {
        tasks.push(...config.genericPaths.win32.filter(p => p.includes('Temp')).map(p => ({ // Assuming temp paths are for 'otherCaches'
            description: `Clearing cache path: ${p}`,
            action: () => deletePath(this.mainWindow, p)
        })));
      }

    return tasks;
  }
} 