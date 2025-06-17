import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { IApplication, IFoundItem } from './core/types';
import { sendToRenderer } from './utils/command.runner';
import { getPathSize, formatBytes, expandPath, deletePath, deleteRegKey } from './utils/file.utils';
import config from '../config.json';
import { AppCleaner } from './core/app.cleaner';
import * as fs from 'fs-extra';
const vsInfo = require('pe-toolkit');

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

  ipcMain.handle('reset:execute', async (_: IpcMainInvokeEvent, options: string[], application: IApplication) => {
    if (!mainWindow) return;

    sendToRenderer(mainWindow, { type: 'log', level: 'info', message: 'Main process received reset request. Starting worker...' });

    const worker = new Worker(path.join(__dirname, 'core/reset.worker.js'), {
      workerData: {
        options,
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

  ipcMain.handle('analysis:execute', async (_: IpcMainInvokeEvent, options: string[], application: IApplication) => {
    if (!mainWindow) return [];
    
    const findings: any[] = [];
    if (!application || !application.id) return findings;

    const appConfig = (config.applications as any)[application.id];
    if (!appConfig) return findings;

    if (options.includes('cleanAppData')) {
      const pathsToAnalyze = process.platform === 'win32' ? appConfig.paths.win32 : appConfig.paths.darwin;
      if (pathsToAnalyze) {
        for (const appPath of pathsToAnalyze) {
          const expandedPath = expandPath(appPath);
          const size = await getPathSize(expandedPath);
          if (size > 0) {
            findings.push({ 
              category: `${application.name} Data`, 
              path: expandedPath, 
              size, 
              formattedSize: formatBytes(size) 
            });
          }
        }
      }
    }
    return findings;
  });

  ipcMain.handle('app-cleaner:get-exe-metadata', async (_: IpcMainInvokeEvent, filePath: string) => {
    try {
      const bytes = await fs.readFile(filePath);
      const results = vsInfo.parseBytes(bytes);
      if (results.length > 0) {
        const stringFileInfo = results[0].getStringFileInfo();
        if (stringFileInfo) {
          const table = Object.values(stringFileInfo)[0] as any;
          return {
            appName: table.ProductName || path.basename(filePath, path.extname(filePath)),
            publisher: table.CompanyName || 'N/A',
            details: {
              ProductName: table.ProductName,
              CompanyName: table.CompanyName,
              FileDescription: table.FileDescription,
              InternalName: table.InternalName,
              OriginalFilename: table.OriginalFilename,
            }
          };
        }
      }
    } catch (error) {
      console.error('Failed to parse exe metadata:', error);
    }
    const appName = path.basename(filePath, path.extname(filePath));
    return {
      appName: appName,
      publisher: 'N/A',
      details: {
        ProductName: appName
      }
    };
  });

  ipcMain.handle('app-cleaner:find-leftovers', async (_: IpcMainInvokeEvent, metadata: any) => {
    if (!mainWindow) return [];
    const cleaner = new AppCleaner(mainWindow);
    return cleaner.findLeftovers(metadata);
  });

  ipcMain.handle('app-cleaner:delete-items', async (_: IpcMainInvokeEvent, items: IFoundItem[]) => {
    if (!mainWindow) return;
    for (const item of items) {
      if (item.type === 'file') {
        await deletePath(mainWindow, item.path);
      } else if (item.type === 'registry') {
        await deleteRegKey(mainWindow, item.path);
      }
    }
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

     