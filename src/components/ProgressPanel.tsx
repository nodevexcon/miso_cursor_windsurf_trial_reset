import React from 'react';
import { useStore } from '../store';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const levelConfig = {
    info: { icon: Info, color: 'text-blue-400' },
    success: { icon: CheckCircle, color: 'text-green-400' },
    error: { icon: XCircle, color: 'text-red-400' },
    warn: { icon: AlertCircle, color: 'text-yellow-400' },
};

export function ProgressPanel() {
    const { logs, progress, status } = useStore();

    return (
        <div className="flex flex-col h-full p-6 bg-gray-900">
            <h2 className="text-2xl font-bold mb-4">Reset Progress</h2>

            <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                <div 
                    className="bg-green-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${progress.total > 0 ? (progress.value / progress.total) * 100 : 0}%` }}
                ></div>
            </div>
            <div className="text-center mb-4">
                <p className="text-lg font-semibold">{status === 'complete' ? 'Reset Complete!' : progress.message}</p>
                <p className="text-sm text-gray-400">({progress.value} / {progress.total} tasks completed)</p>
            </div>
            
            <div className="flex-grow bg-black bg-opacity-50 rounded-lg p-4 overflow-y-auto font-mono text-sm">
                {logs.map((log, index) => {
                    const config = levelConfig[log.level] || levelConfig.info;
                    const Icon = config.icon;
                    return (
                        <div key={index} className={`flex items-start mb-2 ${config.color}`}>
                            <Icon className="h-4 w-4 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="flex-1 whitespace-pre-wrap break-words">
                                <span className="text-gray-500 mr-2">{log.timestamp}</span>
                                {log.message}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
} 