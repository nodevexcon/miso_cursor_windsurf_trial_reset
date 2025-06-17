import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { CheckCircle, XCircle, AlertCircle, Info, Loader } from 'lucide-react';

const levelConfig = {
    info: { icon: Info, color: 'text-blue-400' },
    success: { icon: CheckCircle, color: 'text-green-400' },
    error: { icon: XCircle, color: 'text-red-400' },
    warn: { icon: AlertCircle, color: 'text-yellow-400' },
};

export function ProgressView() {
    const { logs, progress, workflowStep } = useStore();
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the bottom of the logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const isFinalStep = workflowStep === 'complete';

    return (
        <div className="flex flex-col h-full p-6 bg-gray-900 justify-center items-center">
            <div className="text-center mb-6">
                {isFinalStep ? 
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /> :
                    <Loader className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-spin" />
                }
                <h2 className="text-3xl font-bold">{isFinalStep ? 'İşlem Tamamlandı' : progress.message}</h2>
                {workflowStep === 'executing' && (
                     <p className="text-lg text-gray-400 mt-1">({progress.value} / {progress.total} görev tamamlandı)</p>
                )}
            </div>
            
            <div className="w-full max-w-4xl h-80 bg-black bg-opacity-50 rounded-lg p-4 overflow-y-auto font-mono text-sm" ref={logContainerRef}>
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
                 {logs.length === 0 && <p className="text-gray-500">İşlem logları burada görünecek...</p>}
            </div>
        </div>
    );
} 