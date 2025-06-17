import React, { useRef, useEffect } from 'react';
import { useStore, LogEntry } from '../store';
import { CheckCircle, AlertTriangle, XCircle, Info, ChevronRight, Download } from 'lucide-react';

const LogIcon = ({ level }: { level: LogEntry['level'] }) => {
  switch (level) {
    case 'success': return <CheckCircle className="text-green-400" size={16} />;
    case 'error': return <XCircle className="text-red-400" size={16} />;
    case 'warn': return <AlertTriangle className="text-yellow-400" size={16} />;
    default: return <Info className="text-blue-400" size={16} />;
  }
};

const LogLine = ({ log }: { log: LogEntry }) => (
  <div className="flex items-start text-sm font-mono">
    <div className="flex-shrink-0 w-24 text-gray-500">{log.timestamp}</div>
    <div className="flex-shrink-0 mr-2"><LogIcon level={log.level} /></div>
    <div className={`flex-grow ${log.level === 'error' ? 'text-red-300' : 'text-gray-300'}`}>
      {log.message}
    </div>
  </div>
);

export function ProgressPanel() {
  const { logs, progress, status } = useStore();
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const exportLogs = () => {
    const logContent = logs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join('\\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trial-resetter-log-${new Date().toISOString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const isRunning = status === 'resetting' || status === 'analyzing';

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-200">Execution Log</h2>
        <button onClick={exportLogs} className="flex items-center space-x-1 p-2 bg-gray-600 rounded-md hover:bg-gray-500 text-sm" aria-label="Export Logs">
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
      
      {/* Log Container */}
      <div 
        ref={logContainerRef} 
        className="flex-grow bg-black/50 rounded-lg p-3 overflow-y-auto font-mono text-xs"
      >
        {logs.map((log, index) => <LogLine key={index} log={log} />)}
        {logs.length === 0 && <div className="text-gray-500">Awaiting execution...</div>}
      </div>

      {/* Progress Bar */}
      {(isRunning || status === 'complete') && (
        <div className="mt-3">
          <p className="text-sm text-gray-400 mb-1">{progress.message || "Initializing..."}</p>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress.total > 0 ? (progress.value / progress.total) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-right text-sm text-gray-500 mt-1">{progress.value} / {progress.total}</p>
        </div>
      )}
    </div>
  );
} 