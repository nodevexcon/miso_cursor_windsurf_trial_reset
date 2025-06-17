import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Trash2, FileScan, Loader } from 'lucide-react';

interface FoundItem {
    type: 'file' | 'registry';
    path: string;
    description: string;
}

export function AppCleaner() {
    const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [appName, setAppName] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const cleanup = window.electron.onAppCleanerProgress((data) => {
            if (data.type === 'log') {
                setLogs(prev => [...prev, data.message]);
            }
        });
        return () => cleanup();
    }, []);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            const filePath = (file as any).path;
            
            setIsLoading(true);
            setFoundItems([]);
            setSelectedItems(new Set());
            setAppName('');
            setLogs([]);

            try {
                const metadata = await window.electron.getExeMetadata(filePath);
                setAppName(metadata.appName);
                const items = await window.electron.findLeftovers(metadata);
                setFoundItems(items);
            } catch (error) {
                console.error("Error processing application:", error);
                setLogs(prev => [...prev, `Hata: ${error}`]);
            } finally {
                setIsLoading(false);
            }
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
    });

    const handleSelectItem = (path: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };

    const handleDeleteSelected = async () => {
        const itemsToDelete = foundItems.filter(item => selectedItems.has(item.path));
        setIsLoading(true);
        try {
            await window.electron.deleteItems(itemsToDelete);
            // Refresh list
            const remainingItems = foundItems.filter(item => !selectedItems.has(item.path));
            setFoundItems(remainingItems);
            setSelectedItems(new Set());
        } catch (error) {
            console.error("Failed to delete items:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const selectAll = () => {
        if (selectedItems.size === foundItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(foundItems.map(i => i.path)));
        }
    };

    return (
        <div className="p-4 bg-gray-800 text-white min-h-full">
            <h2 className="text-2xl font-bold mb-4">Uygulama Temizleyici</h2>
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-green-500 bg-gray-700' : 'border-gray-600 hover:border-green-400'}`}
            >
                <input {...getInputProps()} />
                <FileScan className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">Uygulama `.exe` dosyasını buraya sürükleyip bırakın</p>
                <p className="text-xs text-gray-500">veya tıklayarak dosya seçin</p>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center my-4">
                    <Loader className="animate-spin h-8 w-8 mr-3" />
                    <span className="mt-2">{appName ? `"${appName}" için kalıntılar aranıyor...` : 'Analiz ediliyor...'}</span>
                    <div className="mt-4 text-left text-xs text-gray-400 bg-gray-900 p-2 rounded w-full max-h-40 overflow-y-auto">
                        {logs.map((log, i) => <p key={i}>&gt; {log}</p>)}
                    </div>
                </div>
            )}

            {!isLoading && foundItems.length === 0 && logs.length > 0 && (
                 <div className="mt-4 text-left text-xs text-gray-400 bg-gray-900 p-2 rounded w-full max-h-40 overflow-y-auto">
                    {logs.map((log, i) => <p key={i}>&gt; {log}</p>)}
                </div>
            )}

            {foundItems.length > 0 && !isLoading && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-semibold">Bulunan Kalıntılar: {appName}</h3>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedItems.size === 0}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded inline-flex items-center"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Seçilenleri Sil ({selectedItems.size})
                        </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                        <div className="p-2 bg-gray-700 flex items-center">
                            <input type="checkbox" className="form-checkbox h-5 w-5 bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500" onChange={selectAll} checked={selectedItems.size === foundItems.length && foundItems.length > 0} />
                            <span className="ml-3">Tümünü Seç</span>
                        </div>
                        <ul className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
                            {foundItems.map(item => (
                                <li key={item.path} className="p-3 flex items-center hover:bg-gray-800">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-5 w-5 bg-gray-800 border-gray-600 text-green-500 focus:ring-green-500"
                                        checked={selectedItems.has(item.path)}
                                        onChange={() => handleSelectItem(item.path)}
                                    />
                                    <div className="ml-4">
                                        <p className="text-sm font-medium">{item.type === 'file' ? 'Dosya/Klasör' : 'Kayıt Defteri'}</p>
                                        <p className="text-xs text-gray-400 break-all">{item.path}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
} 