import React from 'react';
import { useDropzone } from 'react-dropzone';
import { useStore } from '../../store';
import { FileScan, ChevronDown } from 'lucide-react';

export function AppSelectionView() {
    const startAnalysis = useStore(state => state.startAnalysis);
    const supportedApps = useStore(state => state.supportedApps);

    // IPC fonksiyonunu doğrudan window nesnesinden alın, store'dan değil.
    const getExeMetadata = (window.electron as any)?.getExeMetadata;

    const onDrop = React.useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0 && getExeMetadata) {
            const filePath = (acceptedFiles[0] as any).path;
            try {
                const metadata = await getExeMetadata(filePath);
                if (metadata && metadata.appName) {
                    startAnalysis({ id: metadata.appName, name: metadata.appName });
                } else {
                    console.error("Yürütülebilir dosyadan metadata alınamadı.", filePath);
                    // Kullanıcıya bir hata mesajı göstermek faydalı olabilir.
                }
            } catch (error) {
                console.error("Dosya analizi sırasında hata:", error);
            }
        }
    }, [getExeMetadata, startAnalysis]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        // Sadece Windows için .exe dosyalarını kabul et
        accept: { 'application/vnd.microsoft.portable-executable': ['.exe'] },
        disabled: !getExeMetadata // Eğer IPC fonksiyonu yoksa (örn. macOS/Linux) dropzone'u devre dışı bırak
    });

    const handleSelect = (appId: string) => {
        const app = supportedApps.find(a => a.id === appId);
        if (app) {
            startAnalysis(app);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h1 className="text-4xl font-bold mb-2">Başlayalım</h1>
            <p className="text-lg text-gray-400 mb-8">Lütfen sıfırlamak istediğiniz uygulamayı seçin veya .exe dosyasını sürükleyin.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Pre-configured Apps */}
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4">Yapılandırılmış Uygulamalar</h2>
                    <div className="space-y-3">
                        {supportedApps.map(app => (
                            <button
                                key={app.id}
                                onClick={() => handleSelect(app.id)}
                                className="w-full text-left p-4 bg-gray-700 rounded-md hover:bg-blue-600 transition-colors flex justify-between items-center"
                            >
                                <span>{app.name}</span>
                                <ChevronDown className="transform -rotate-90" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dropzone for Custom Apps */}
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col justify-center items-center cursor-pointer transition-colors
                        ${!getExeMetadata ? 'opacity-50 cursor-not-allowed' : isDragActive ? 'border-green-500 bg-gray-700' : 'border-gray-600 hover:border-green-400'}`}
                >
                    <input {...getInputProps()} />
                    <FileScan className="h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-xl font-semibold">Uygulama .exe Dosyasını Sürükleyin</p>
                    <p className="text-gray-500">
                        {getExeMetadata ? 'veya tıklayarak seçin' : '(Sadece Windows\'ta geçerlidir)'}
                    </p>
                </div>
            </div>
        </div>
    );
} 