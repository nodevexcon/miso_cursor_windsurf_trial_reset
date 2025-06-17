import { BrowserWindow } from 'electron';
import { exec, execFile } from 'child_process';
import type { ProgressPayload } from '../../src/electron.d';
import * as shellQuote from 'shell-quote';
import logger from './logger';
import sudo from 'sudo-prompt';
import { spawn } from 'child_process';

// Helper to send structured updates to the renderer process
export function sendToRenderer(mainWindow: BrowserWindow, data: ProgressPayload) {
  mainWindow.webContents.send('reset-progress', data);
}

const sudoOptions = {
  name: 'Trial Resetter',
};

function log(message: string) {
  // In the future, this will send logs to the main window
  console.log(message);
}

/**
 * Executes a shell command securely. It favors `execFile` for safety but falls back
 * to `exec` for complex shell syntax (e.g., pipes, &&).
 * @param mainWindow The main browser window to send progress logs.
 * @param command The base command or application to execute.
 * @param args An array of arguments for the command.
 * @param useSudo If true, executes the command with elevated privileges.
 * @param suppressErrors If true, suppresses logging for expected errors.
 * @returns A promise that resolves with stdout or rejects with an error.
 */
export async function execCommand(command: string, args: string[], needsAdmin = false): Promise<string> {
  log(`Executing command: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    if (needsAdmin) {
      const fullCommand = shellQuote.quote([command, ...args]);
      sudo.exec(fullCommand, sudoOptions, (error, stdout, stderr) => {
        if (error) {
          log(`Sudo exec error for command "${fullCommand}": ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          log(`Sudo exec stderr for command "${fullCommand}": ${stderr}`);
        }
        log(`Sudo exec stdout for command "${fullCommand}": ${stdout}`);
        resolve(stdout?.toString() || '');
      });
    } else {
      const process = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        log(data.toString());
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        log(data.toString());
      });

      process.on('close', (code) => {
        if (code !== 0) {
          log(`Command "${command} ${args.join(' ')}" exited with code ${code}. Stderr: ${stderr}`);
          return reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
        resolve(stdout);
      });

      process.on('error', (err) => {
        log(`Failed to start command: "${command} ${args.join(' ')}". Error: ${err.message}`);
        reject(err);
      });
    }
  });
} 