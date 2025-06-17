import React from 'react';
import { useStore } from '../../store';
import { File, Folder, Key, Trash2, Settings, ShieldCheck, ChevronLeft } from 'lucide-react';

const ItemIcon = ({ type }: { type: 'file' | 'directory' | 'registry' }) => {
    switch (type) {
        case 'file': return <File className="h-5 w-5 text-gray-400" />;
        case 'directory': return <Folder className="h-5 w-5 text-yellow-500" />;
        case 'registry': return <Key className="h-5 w-5 text-blue-400" />;
        default: return <File className="h-5 w-5 text-gray-400" />;
    }
};

export function ReviewView() {
    const {
        foundItems,
        selectedItems,
        allOptions,
        selectedApp,
        toggleItemSelection,
        selectAllItems,
        toggleOption,
        startExecution,
        resetWorkflow
    } = useStore();

    const appItems = foundItems.filter(item => item.type === 'file' || item.type === 'directory');
    const registryItems = foundItems.filter(item => item.type === 'registry');
    const basicOptions = allOptions.filter(opt => opt.category === 'Basic' || opt.category === 'Advanced');
    const systemOptions = allOptions.filter(opt => opt.category === 'System');

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        selectAllItems(e.target.checked);
    };

    return (
        <div className="flex flex-col h-full">
             <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <button onClick={resetWorkflow} className="flex items-center text-blue-400 hover:text-blue-300">
                        <ChevronLeft size={20} className="mr-1" />
                        Başka Bir Uygulama Seç
                    </button>
                    <h1 className="text-2xl font-bold">"{selectedApp?.name}" için İnceleme</h1>
                    <p className="text-gray-400">{foundItems.length} kalıntı ve {allOptions.length} sistem seçeneği bulundu.</p>
                </div>
                <button
                    onClick={startExecution}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg flex items-center space-x-2"
                >
                    <ShieldCheck size={24} />
                    <span>Temizliği Başlat</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Found Items Column */}
                <div>
                    <h2 className="text-xl font-semibold mb-3">Bulunan Kalıntılar ({foundItems.length})</h2>
                    <div className="bg-gray-800 rounded-lg max-h-[60vh] overflow-y-auto">
                        <div className="p-3 bg-gray-900 sticky top-0 z-10 flex items-center">
                            <input type="checkbox" className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500" onChange={handleSelectAll} checked={selectedItems.size === foundItems.length && foundItems.length > 0} />
                            <span className="ml-3 font-semibold">Tümünü Seç</span>
                        </div>
                        <ul>
                            {appItems.map(item => (
                                <li key={item.path} className="p-3 flex items-center border-b border-gray-700 hover:bg-gray-700/50">
                                    <input type="checkbox" className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500" checked={selectedItems.has(item.path)} onChange={() => toggleItemSelection(item.path)} />
                                    <div className="ml-3 flex items-center">
                                        <ItemIcon type={item.type} />
                                        <span className="ml-2 text-sm break-all">{item.path}</span>
                                    </div>
                                </li>
                            ))}
                             {registryItems.map(item => (
                                <li key={item.path} className="p-3 flex items-center border-b border-gray-700 hover:bg-gray-700/50">
                                    <input type="checkbox" className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500" checked={selectedItems.has(item.path)} onChange={() => toggleItemSelection(item.path)} />
                                    <div className="ml-3 flex items-center">
                                        <ItemIcon type={item.type} />
                                        <span className="ml-2 text-sm break-all">{item.path}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Options Column */}
                <div>
                    <h2 className="text-xl font-semibold mb-3">Ek Sıfırlama Seçenekleri</h2>
                     <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                        {basicOptions.concat(systemOptions).map(option => (
                            <div key={option.id} className="flex items-center">
                                <input id={option.id} type="checkbox" className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500" checked={option.checked} onChange={() => toggleOption(option.id)} />
                                <label htmlFor={option.id} className="ml-3">
                                    <p className="font-semibold">{option.label}</p>
                                    <p className="text-sm text-gray-400">{option.details}</p>
                                </label>
                            </div>
                        ))}
                     </div>
                </div>
            </main>
        </div>
    );
} 