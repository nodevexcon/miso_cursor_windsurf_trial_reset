import { parentPort, workerData } from 'worker_threads';
import { IApplication } from './types';
import { createResetter } from './resetter.factory';

function sendProgress(data: any) {
  parentPort?.postMessage({ channel: 'reset-progress', data });
}

async function runTasksInWorker() {
  if (!parentPort) return;

  const { options, application } = workerData as { options: string[], application: IApplication };

  try {
    const resetter = createResetter();
    
    // Define the logger function to be passed to the resetter
    const onLog = (message: string) => {
      sendProgress({ type: 'log', level: 'info', message });
    };

    const tasks = await resetter.createTasks(options, application, onLog);

    const totalTasks = tasks.length;
    sendProgress({ type: 'log', level: 'info', message: `Worker starting reset with ${totalTasks} tasks.` });

    for (let i = 0; i < totalTasks; i++) {
      const task = tasks[i];
      const currentProgress = i + 1;
      sendProgress({ type: 'progress', progress: currentProgress, total: totalTasks, message: task.description });
      try {
        await task.action();
      } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred';
        sendProgress({ type: 'log', level: 'error', message: `Task "${task.description}" failed: ${errorMessage}` });
        sendProgress({ type: 'error', message: `Worker stopped on task: ${task.description}` });
        return;
      }
    }
    
    sendProgress({ type: 'complete', total: totalTasks });
    sendProgress({ type: 'log', level: 'success', message: 'Worker finished all tasks successfully!' });

  } catch (error: any) {
    if (parentPort) {
      sendProgress({ type: 'error', message: `Worker failed to start: ${error.message}` });
    }
  }
}

runTasksInWorker(); 