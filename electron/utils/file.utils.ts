import { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execCommand, sendToRenderer } from './command.runner';

function log(level: 'info' | 'warn' | 'error', message: string) {
  // In the future, this will send logs to the main window
  console[level](message);
}

/**
 * Expands environment variables in a path string.
 * @param filePath The path to expand.
 * @returns The expanded path.
 */
export function expandPath(filePath: string): string {
  if (os.platform() === 'win32') {
    return filePath.replace(/%([^%]+)%/g, (_, envVar) => process.env[envVar] || '');
  }
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Deletes a path (file or directory), logging the action.
 * @param targetPath The path to delete.
 */
export async function deletePath(targetPath: string): Promise<void> {
  const fullPath = expandPath(targetPath);

  try {
    if (!await fs.pathExists(fullPath)) {
      log('info', `Path does not exist, skipping deletion: ${fullPath}`);
      return;
    }

    log('info', `Deleting path: ${fullPath}`);
    await fs.remove(fullPath);
    log('info', `Successfully deleted: ${fullPath}`);
  } catch (error: any) {
    log('error', `Error deleting path ${fullPath}. Attempting with sudo.`);
    try {
      // Platform-specific commands for deletion
      const command = process.platform === 'win32' 
        ? `rmdir /s /q "${fullPath}"` 
        : `rm -rf "${fullPath}"`;
      await execCommand(command, [], true);
      log('info', `Successfully deleted with sudo: ${fullPath}`);
    } catch (sudoError: any) {
      log('error', `Failed to delete with sudo ${fullPath}: ${sudoError.message}`);
      throw sudoError; // Re-throw the error after logging
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
 * @param key The registry key to delete.
 */
export async function deleteRegKey(key: string): Promise<void> {
    if (process.platform !== 'win32') {
        log('warn', `Registry operations are only supported on Windows. Skipping key: ${key}`);
        return;
    }
    log('info', `Deleting registry key: ${key}`);
    try {
        await execCommand('reg', ['delete', key, '/f'], true);
        log('info', `Successfully deleted registry key: ${key}`);
    } catch (error: any) {
        log('error', `Failed to delete registry key ${key}: ${error.message}`);
        throw error;
    }
} 