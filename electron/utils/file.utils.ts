import { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execCommand, sendToRenderer } from './command.runner';

/**
 * Expands environment variables in a path string.
 * @param filePath The path to expand.
 * @returns The expanded path.
 */
export const expandPath = (filePath: string): string => {
  if (os.platform() === 'win32') {
    return filePath.replace(/%([^%]+)%/g, (_, envVar) => process.env[envVar] || '');
  }
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
};

/**
 * Deletes a path (file or directory), logging the action.
 * @param mainWindow The main browser window for logging.
 * @param pathToDelete The path to delete.
 */
export async function deletePath(mainWindow: BrowserWindow, pathToDelete: string) {
  try {
    const expandedPath = expandPath(pathToDelete);
    if (await fs.pathExists(expandedPath)) {
      // Simple rollback: move to trash instead of deleting permanently.
      // For a more robust solution, consider a dedicated trash library.
      await fs.move(expandedPath, path.join(os.tmpdir(), `trial-resetter-backup-${Date.now()}-${path.basename(expandedPath)}`));
      sendToRenderer(mainWindow, { type: 'log', level: 'success', message: `Deleted: ${expandedPath}` });
    } else {
      sendToRenderer(mainWindow, { type: 'log', level: 'info', message: `Skipped (not found): ${expandedPath}` });
    }
  } catch (error: any) {
    sendToRenderer(mainWindow, { type: 'log', level: 'error', message: `Failed to delete ${pathToDelete}: ${error.message}` });
    // Attempt deletion with sudo on permission errors for macOS
    if (os.platform() === 'darwin' && error.code === 'EACCES') {
      await execCommand(mainWindow, 'rm', ['-rf', pathToDelete], true);
    }
  }
}

/**
 * Recursively calculates the size of a directory or file.
 * @param itemPath The path to the item.
 * @returns The total size in bytes.
 */
export async function getPathSize(itemPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const expandedPath = expandPath(itemPath);
    if (!(await fs.pathExists(expandedPath))) {
      return 0;
    }
    const stats = await fs.lstat(expandedPath);
    if (stats.isDirectory()) {
      const files = await fs.readdir(expandedPath);
      const promises = files.map(file => getPathSize(path.join(expandedPath, file)));
      totalSize = (await Promise.all(promises)).reduce((acc, size) => acc + size, 0);
    } else {
      totalSize += stats.size;
    }
  } catch (err) {
    // Ignore errors for files that might be gone or inaccessible
  }
  return totalSize;
}

/**
 * Formats a size in bytes to a human-readable string.
 * @param bytes The number of bytes.
 * @param decimals The number of decimal places.
 * @returns A formatted string (e.g., "1.23 MB").
 */
export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Deletes a registry key.
 * @param mainWindow The main browser window for logging.
 * @param key The registry key to delete.
 */
export async function deleteRegKey(mainWindow: BrowserWindow, key: string) {
  try {
    await execCommand(mainWindow, `REG`, ['DELETE', key, '/f'], true);
    sendToRenderer(mainWindow, { type: 'log', level: 'success', message: `Deleted Registry Key: ${key}` });
  } catch (error: any) {
    sendToRenderer(mainWindow, { type: 'log', level: 'error', message: `Failed to delete registry key ${key}: ${error.message}` });
  }
} 