import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { IApplication, IFoundItem, ExeMetadata } from './core/types';
import { sendToRenderer } from './utils/command.runner';
import { getPathSize, formatBytes, expandPath, deletePath, deleteRegKey } from './utils/file.utils';
import config from '../config.json';
import { createResetter } from './core/resetter.factory';
const { parseBytes } = require('pe-toolkit');

let mainWindow: BrowserWindow | null = null;

function handleSetTitle(event: IpcMainEvent, title: string) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if (win) {
    win.setTitle(title);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'MISO_Cursor_WindSurf Trial Resetter',
    icon: path.join(__dirname, '../../build/icon.png'),
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenu(null);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('set-title', handleSetTitle);

  ipcMain.handle('system:smart-scan', async () => {
    const resetter = createResetter();
    return resetter.smartScan();
  });

  ipcMain.handle('analysis:execute', async (_: IpcMainInvokeEvent, application: IApplication) => {
    if (!mainWindow) return [];
    const window = mainWindow; // Avoid race conditions on close

    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'core/search.worker.js'), {
        workerData: { application },
      });

      worker.on('message', (message) => {
        // Forward log messages to the renderer for real-time progress
        if (message.type === 'log') {
          window.webContents.send('reset-progress', { 
            type: 'log', 
            level: message.level, 
            message: message.message 
          });
        } 
        // When the worker is done, it sends the final result
        else if (message.type === 'result') {
          resolve(message.items);
        }
        // If the worker sends a specific error
        else if (message.type === 'error') {
           window.webContents.send('reset-progress', { type: 'error', message: message.message });
           reject(new Error(message.message));
        }
      });

      worker.on('error', (error) => {
        window.webContents.send('reset-progress', { type: 'error', message: `Analiz worker'ında kritik bir hata oluştu: ${error.message}` });
        reject(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          const errorMessage = `Analiz worker'ı beklenmedik bir şekilde sonlandı (kod: ${code})`;
          window.webContents.send('reset-progress', { type: 'error', message: errorMessage });
          reject(new Error(errorMessage));
        }
      });
    });
  });

  ipcMain.handle('reset:execute', async (
    _: IpcMainInvokeEvent, 
    options: { [key: string]: boolean }, 
    itemsToDelete: IFoundItem[],
    application: IApplication
    ) => {
    if (!mainWindow) return;

    sendToRenderer(mainWindow, { type: 'log', level: 'info', message: 'Main process received reset request...' });

    const worker = new Worker(path.join(__dirname, 'core/reset.worker.js'), {
      workerData: {
        options,
        itemsToDelete,
        application,
      },
    });

    worker.on('message', (result) => {
      if (mainWindow) {
        mainWindow.webContents.send(result.channel, result.data);
      }
    });

    worker.on('error', (error) => {
      if (mainWindow) {
        sendToRenderer(mainWindow, { type: 'error', message: `Worker encountered a fatal error: ${error.message}` });
      }
    });

    worker.on('exit', (code) => {
      if (mainWindow) {
        if (code !== 0) {
          sendToRenderer(mainWindow, { type: 'log', level: 'error', message: `Worker stopped with a non-zero exit code: ${code}`});
        } else {
          sendToRenderer(mainWindow, { type: 'log', level: 'info', message: 'Worker process finished successfully.' });
        }
      }
    });
  });

  ipcMain.handle('app-cleaner:get-exe-metadata', async (_: IpcMainInvokeEvent, filePath: string): Promise<ExeMetadata> => {
    return new Promise((resolve) => {
      let resolved = false;
      const worker = new Worker(path.join(__dirname, 'core/metadata.worker.js'), {
        workerData: { filePath },
      });

      const resolveWithFallback = (context: string, error?: any) => {
        if (resolved) return;
        resolved = true;
        console.error(`Metadata worker failed for ${filePath} [${context}]:`, error || 'No error details');
        const appName = path.basename(filePath, path.extname(filePath));
        resolve({
          appName,
          publisher: 'N/A',
          details: { ProductName: appName },
        });
      };

      worker.on('message', (result) => {
        if (resolved) return;
        resolved = true;

        if (result.type === 'success') {
          const metadataTable = result.metadata;
          const appName = metadataTable.ProductName || path.basename(filePath, path.extname(filePath));
          const publisher = metadataTable.CompanyName || 'N/A';
          resolve({ appName, publisher, details: metadataTable });
        } else {
          resolveWithFallback('worker sent error message', result.message);
        }
      });

      worker.on('error', (error) => {
        resolveWithFallback('worker emitted error event', error);
      });

      worker.on('exit', (code) => {
        if (!resolved) {
          resolveWithFallback(`worker exited with code ${code}`);
        }
      });
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

     