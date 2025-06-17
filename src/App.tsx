import React, { useEffect } from 'react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { AppSelectionView } from './components/views/AppSelectionView';
import { ProgressView } from './components/views/ProgressView';
import { ReviewView } from './components/views/ReviewView';

function useAppLogic() {
  const { initialize, handleProgress, analysisComplete, workflowStep, selectedApp } = useStore();

  useEffect(() => {
    // Setup IPC listeners
    const cleanupProgress = window.electron.onResetProgress(handleProgress);
    // A dedicated listener for analysis results would be cleaner, but for now we can use a command
    
    // Get initial platform data
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) initialize('win32');
    else if (ua.includes('mac')) initialize('darwin');
    else initialize('linux');

    return () => {
      cleanupProgress();
    };
  }, [initialize, handleProgress]);

  useEffect(() => {
    // This effect triggers the analysis when the step changes to 'analyzing'
    if (workflowStep === 'analyzing' && selectedApp) {
      const performAnalysis = async () => {
        try {
          // Call the correct function exposed in preload.ts
          const results = await (window.electron as any).analyzeActions(selectedApp);
          analysisComplete(results);
        } catch (err) {
          console.error("Analysis failed:", err);
          // TODO: Handle error state in store, e.g., revert to selection
        }
      };
      performAnalysis();
    }
  }, [workflowStep, selectedApp, analysisComplete]);
}

function MainContent() {
  const workflowStep = useStore((s) => s.workflowStep);

  switch (workflowStep) {
    case 'selection':
      return <AppSelectionView />;
    case 'analyzing':
      return <ProgressView />;
    case 'review':
      return <ReviewView />;
    case 'executing':
    case 'complete':
      return <ProgressView />;
    default:
      return <div>Bilinmeyen durum</div>;
  }
}

export default function App() {
  useAppLogic();
  const theme = useStore(s => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {/* Sidebar can be used for global controls like theme or profiles */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <MainContent />
      </main>
    </div>
  );
}
