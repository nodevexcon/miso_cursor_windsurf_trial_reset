import { BrowserWindow } from 'electron';
import { exec, execFile } from 'child_process';
import type { ProgressPayload } from '../../src/electron.d';
import { quote } from 'shell-quote';
import logger from './logger';
const sudo = require('sudo-prompt');

// Helper to send structured updates to the renderer process
export function sendToRenderer(mainWindow: BrowserWindow, data: ProgressPayload) {
  mainWindow.webContents.send('reset-progress', data);
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
export async function execCommand(
    mainWindow: BrowserWindow, 
    command: string, 
    args: string[] = [], 
    useSudo: boolean = false,
    suppressErrors: boolean = false
): Promise<string> {
    
    // For complex commands with shell syntax, or any command passed as a single string,
    // we must use exec, which spawns a shell.
    const isComplexCommand = args.length === 0;

    const fullCommand = isComplexCommand ? command : quote([command, ...args]);
    
    return new Promise((resolve, reject) => {
        const callback = (error: any, stdout: any, stderr: any) => {
            if (error) {
                if (!suppressErrors) {
                    const errorMessage = (stderr || error.message).toString().substring(0, 500);
                    logger.error(`Exec failed (${fullCommand}): ${errorMessage}`);
                    sendToRenderer(mainWindow, { type: 'log', level: 'error', message: `Exec failed (${fullCommand}): ${errorMessage}` });
                }
                reject(error);
            } else {
                logger.info(`Exec OK: ${fullCommand}`);
                sendToRenderer(mainWindow, { type: 'log', level: 'success', message: `Exec OK: ${fullCommand}` });
                resolve(stdout.toString());
            }
        };

        if (useSudo) {
            sudo.exec(fullCommand, { name: 'Trial Resetter' }, callback);
        } else {
            if (isComplexCommand) {
                exec(fullCommand, callback);
            } else {
                execFile(command, args, callback);
            }
        }
    });
} 