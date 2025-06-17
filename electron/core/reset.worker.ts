import { parentPort, workerData } from 'worker_threads';
import { IApplication } from './types';
import { createResetter } from './resetter.factory';

// This is a dummy BrowserWindow object that provides the webContents.send method
// for the worker thread to send progress back to the main thread.
const mockMainWindow = {
  webContents: {
    send: (channel: string, data: any) => {
      parentPort?.postMessage({ channel, data });
    },
  },
};

async function runTasksInWorker() {
  if (!parentPort) return;

  const { options, application } = workerData as { options: string[], application: IApplication };

  try {
    // We cast mockMainWindow to any because it's not a full BrowserWindow instance.
    // This is acceptable because our new modular structure only depends on `webContents.send`.
    const resetter = createResetter(mockMainWindow as any);
    const tasks = resetter.createTasks(options, application);

    const totalTasks = tasks.length;
    mockMainWindow.webContents.send('reset-progress', { type: 'log', level: 'info', message: `Worker starting reset with ${totalTasks} tasks.` });

    for (let i = 0; i < totalTasks; i++) {
      const task = tasks[i];
      const currentProgress = i + 1;
      mockMainWindow.webContents.send('reset-progress', { type: 'progress', progress: currentProgress, total: totalTasks, message: task.description });
      try {
        await task.action();
      } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred';
        mockMainWindow.webContents.send('reset-progress', { type: 'log', level: 'error', message: `Task "${task.description}" failed: ${errorMessage}` });
        mockMainWindow.webContents.send('reset-progress', { type: 'error', message: `Worker stopped on task: ${task.description}` });
        return;
      }
    }
    
    mockMainWindow.webContents.send('reset-progress', { type: 'complete', total: totalTasks });
    mockMainWindow.webContents.send('reset-progress', { type: 'log', level: 'success', message: 'Worker finished all tasks successfully!' });

  } catch (error: any) {
    if (parentPort) {
        mockMainWindow.webContents.send('reset-progress', { type: 'error', message: `Worker failed to start: ${error.message}` });
    }
  }
}

runTasksInWorker(); 