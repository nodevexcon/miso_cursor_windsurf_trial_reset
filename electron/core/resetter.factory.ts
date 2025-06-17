import { BrowserWindow } from 'electron';
import * as os from 'os';
import { IResetter } from './types';
import { WindowsResetter } from '../platforms/windows.resetter';
import { MacResetter } from '../platforms/macos.resetter';

/**
 * Creates a platform-specific resetter instance based on the current OS.
 * @param mainWindow The main Electron window.
 * @returns An object conforming to the IResetter interface.
 */
export function createResetter(mainWindow: BrowserWindow): IResetter {
  switch (os.platform()) {
    case 'win32':
      return new WindowsResetter(mainWindow);
    case 'darwin':
      return new MacResetter(mainWindow);
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
} 