import { IResetter } from './types';
import { WindowsResetter } from '../platforms/windows.resetter';
import { MacosResetter } from '../platforms/macos.resetter';
import { LinuxResetter } from '../platforms/linux.resetter';

/**
 * Creates a platform-specific resetter instance based on the current OS.
 * @returns An object conforming to the IResetter interface.
 */
export function createResetter(): IResetter {
  switch (process.platform) {
    case 'win32':
      return new WindowsResetter();
    case 'darwin':
      return new MacosResetter();
    case 'linux':
      return new LinuxResetter();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
} 