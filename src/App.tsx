import React, { useEffect } from 'react';
import { useStore, type AppState } from './store';
import { shallow } from 'zustand/shallow';
import { Sidebar } from './components/Sidebar';
import { OptionsPanel } from './components/OptionsPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { AppCleaner } from './components/AppCleaner';
import { Play } from 'lucide-react';

// Custom hook to manage IPC listeners
function useIpcListeners() {
  const { handleProgress, initialize } = useStore();

  useEffect(() => {
    // This listener handles all progress updates from the worker
    const cleanup = window.electron.onResetProgress((data) => {
      handleProgress(data);
    });
    
    // We also need to get the platform from the main process on startup
    // Note: In a real app, you might want a dedicated 'app:init' event
    // that sends all initial data in one go.
    async function getPlatform() {
      try {
        // We can't use `window.electron.getPlatform` as it was removed in our backend refactor.
        // For now, we'll rely on the user agent, but a proper solution would be to
        // add a `get-initial-data` IPC handler in `main.ts`.
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('windows')) {
          initialize('win32');
        } else if (ua.includes('mac')) {
          initialize('darwin');
        } else {
          initialize('linux');
        }
      } catch (e) {
        console.error("Could not determine platform", e);
      }
    }
    getPlatform();

    return () => {
      if (cleanup) cleanup();
    };
  }, [handleProgress, initialize]);
}

function MainContent() {
  const status = useStore((s) => s.status);
  const activeView = useStore((s) => s.activeView);

  if (activeView === 'cleaner') {
    return <AppCleaner />;
  }

  // Conditionally render the main panel based on the application status
  if (status === 'resetting' || status === 'complete' || status === 'error') {
    return <ProgressPanel />;
  }
  return <OptionsPanel />;
}

export default function App() {
  useIpcListeners(); // Initialize IPC listeners
  const { startReset, allOptions, selectedApp, status, activeView } = useStore();
  
  const handleExecuteReset = async () => {
    startReset(); // Set status to 'resetting' and clear logs
    const selectedOptionIds = allOptions
      .filter(option => option.checked)
      .map(option => option.id);
    
    try {
      await window.electron.executeReset(selectedOptionIds, selectedApp);
    } catch (error: any) {
      // This will be caught by the worker, but we can log it here too
      console.error("Failed to invoke reset execution:", error);
    }
  };

  const isRunning = status === 'resetting';

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <MainContent />
        </div>
        {activeView === 'resetter' && (
          <footer className="p-4 bg-gray-800 border-t border-gray-700">
            <button 
              onClick={handleExecuteReset}
              disabled={isRunning}
              className="w-full flex justify-center items-center space-x-2 bg-green-600 p-3 rounded-md text-lg font-bold text-white hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={24} />
              <span>{isRunning ? 'Resetting...' : 'Start Reset'}</span>
            </button>
          </footer>
        )}
      </main>
    </div>
  );
}
