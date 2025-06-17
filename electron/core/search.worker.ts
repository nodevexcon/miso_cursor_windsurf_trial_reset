import { parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as plist from 'plist';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IFoundItem, IApplication, ExeMetadata } from './types';

const execAsync = promisify(exec);
const vsInfo = require('pe-toolkit');

// #region: Helper Functions (Logging)
function sendLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    parentPort?.postMessage({ type: 'log', level, message });
}
// #endregion

// #region: Search Term Generation (The "Brain")

const GENERIC_TERMS = new Set([
    'microsoft', 'windows', 'google', 'apple', 'corp', 'corporation', 'inc', 
    'the', 'a', 'and', 'of', 'in', 'for', 'to', 'with', 'on', 'at',
    'setup', 'install', 'installer', 'application', 'service', 'program',
    'driver', 'common', 'files', 'runtime', 'framework', 'component', 'components',
    'shell', 'data', 'edge', 'client', 'server', 'update', 'core'
]);

function cleanAndAdd(term: string | undefined | null, termSet: Set<string>) {
    if (!term) return;
    // Split by spaces, dots, dashes, underscores, and camelCase
    const parts = term.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s,._-]+/);
    for (const part of parts) {
        const cleanPart = part.trim().toLowerCase();
        if (cleanPart && cleanPart.length > 2 && !GENERIC_TERMS.has(cleanPart) && isNaN(Number(cleanPart))) {
            termSet.add(cleanPart);
        }
    }
}

async function createSearchTerms(app: IApplication): Promise<string[]> {
    const potentialTerms = new Set<string>();
    
    // Always add the base name and id as search terms
    cleanAndAdd(app.id, potentialTerms);
    cleanAndAdd(app.name, potentialTerms);

    try {
        if (process.platform === 'win32') {
            sendLog(`Windows'ta derinlemesine analiz için ${app.name}.exe aranıyor...`);
            // Attempt to find the exe path using 'where'
            const { stdout } = await execAsync(`where ${app.name}.exe`);
            const exePath = stdout.split(/[\r\n]+/)[0];

            if (exePath && await fs.pathExists(exePath)) {
                sendLog(`${exePath} bulundu, metadata'sı okunuyor.`);
                const bytes = await fs.readFile(exePath);
                const results = vsInfo.parseBytes(bytes);
                if (results.length > 0) {
                    const stringFileInfo = results[0].getStringFileInfo();
                    if (stringFileInfo) {
                        const table = Object.values(stringFileInfo)[0] as any;
                        cleanAndAdd(table.ProductName, potentialTerms);
                        cleanAndAdd(table.CompanyName, potentialTerms);
                        cleanAndAdd(table.FileDescription, potentialTerms);
                        cleanAndAdd(table.InternalName, potentialTerms);
                        cleanAndAdd(table.OriginalFilename, potentialTerms);
                    }
                }
            }
        } else if (process.platform === 'darwin') {
            sendLog(`macOS'ta derinlemesine analiz için ${app.name}.app aranıyor...`);
            const appPath = path.join('/Applications', `${app.name}.app`);
            const plistPath = path.join(appPath, 'Contents', 'Info.plist');

            if (await fs.pathExists(plistPath)) {
                sendLog(`${appPath} bulundu, Info.plist dosyası okunuyor.`);
                const plistContent = await fs.readFile(plistPath, 'utf8');
                const parsedPlist = plist.parse(plistContent) as any;
                
                cleanAndAdd(parsedPlist.CFBundleIdentifier, potentialTerms);
                cleanAndAdd(parsedPlist.CFBundleName, potentialTerms);
                cleanAndAdd(parsedPlist.CFBundleDisplayName, potentialTerms);
                cleanAndAdd(parsedPlist.CFBundleExecutable, potentialTerms);
            }
        }
    } catch (err) {
        // Artık bu beklenen hatayı günlüğe kaydetmiyoruz.
        // sendLog(`Derinlemesine analiz sırasında bir hata oluştu (bu beklenen bir durum olabilir): ${err.message}`, 'warn');
    }

    const finalTerms = Array.from(potentialTerms);
    sendLog(`Oluşturulan nihai arama terimleri: ${finalTerms.join(', ')}`);
    return finalTerms;
}

// #endregion

// #region: Post-Search Filtering

function filterFalsePositives(paths: Set<string> | string[], searchTerms: string[]): string[] {
    // This regex looks for the search term as a whole word.
    // e.g., for "cursor", it will match "cursor", "cursor-data", "app_cursor"
    // but NOT "cursorspeed".
    const regexes = searchTerms.map(term => new RegExp(`\\b${term}\\b`, 'i'));

    const filteredPaths: string[] = [];
    pathLoop: for (const p of paths) {
        // Split path by both / and \ for cross-platform compatibility.
        const segments = p.split(/[\\\/]/);
        for (const segment of segments) {
            if (regexes.some(r => r.test(segment))) {
                // If any segment matches, the path is considered valid.
                filteredPaths.push(p);
                continue pathLoop; // Move to the next path.
            }
        }
    }
    return filteredPaths;
}

// #endregion

// #region: File System & Registry Search Logic

async function searchFileSystemWindows(searchTerms: string[]): Promise<IFoundItem[]> {
    sendLog('Windows dosya sistemi taranıyor...');
    const uniquePaths = new Set<string>();
    const locations = [
        '%APPDATA%', '%LOCALAPPDATA%', '%PROGRAMDATA%', 
        '%USERPROFILE%\\Documents', '%USERPROFILE%\\AppData\\Local\\Temp'
    ].map(p => expandPath(p));

    // A more efficient recursive search function
    const searchDirectory = async (dir: string) => {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const lowerName = entry.name.toLowerCase();
                
                // Check if the file/dir name contains any of the search terms
                if (searchTerms.some(term => lowerName.includes(term))) {
                    uniquePaths.add(fullPath);
                }

                if (entry.isDirectory()) {
                    // Avoid deep recursion into unrelated system/program files directories for performance
                    if (dir.includes('Program Files') || dir.includes('Windows')) continue;
                    // Recursively search subdirectories
                    await searchDirectory(fullPath);
                }
            }
        } catch (err) {
            // Ignore access denied errors
        }
    };
    
    for (const loc of locations) {
        if (await fs.pathExists(loc)) {
            await searchDirectory(loc);
        }
    }

    const filtered = filterFalsePositives(uniquePaths, searchTerms);

    const finalResults: IFoundItem[] = [];
    for (const p of filtered) {
         try {
            const stats = await fs.stat(p);
            finalResults.push({ type: stats.isDirectory() ? 'directory' : 'file', path: p, description: `Bulunan Kalıntı: ${p}` });
        } catch {}
    }
    sendLog(`Windows dosya sisteminde ${finalResults.length} potansiyel öğe bulundu.`);
    return finalResults;
}


async function searchFileSystemMac(searchTerms: string[]): Promise<IFoundItem[]> {
    sendLog("macOS dosya sistemi taranıyor...");
    const homeDir = os.homedir();
    const macLocations = [
        path.join(homeDir, 'Library', 'Application Support'),
        path.join(homeDir, 'Library', 'Caches'),
        path.join(homeDir, 'Library', 'Preferences'),
        path.join(homeDir, 'Library', 'Containers'),
        '/Library/Application Support',
    ];

    const findPromises = macLocations.map(location => {
        const findArgs = [location, '-maxdepth', '4']; // Limit depth for performance
        const nameConditions = searchTerms.flatMap(term => ['-iname', `*${term}*`]);
        if (nameConditions.length > 2) {
            findArgs.push('(');
            findArgs.push(nameConditions[0], nameConditions[1]);
            for (let i = 2; i < nameConditions.length; i += 2) {
                findArgs.push('-o', nameConditions[i], nameConditions[i+1]);
            }
            findArgs.push(')');
        } else {
            findArgs.push(...nameConditions);
        }
        return execAsync(`find ${findArgs.join(' ')}`).catch(err => ({ stdout: '', stderr: err.message }));
    });
    
    const results = await Promise.all(findPromises);
    const uniquePaths = new Set<string>();
    results.forEach(res => res.stdout.split(/[\r\n]+/).filter(Boolean).forEach(p => uniquePaths.add(p)));

    const filtered = filterFalsePositives(uniquePaths, searchTerms);

    const finalResults: IFoundItem[] = [];
    for (const p of filtered) {
        try {
            const stats = await fs.stat(p);
            finalResults.push({ type: stats.isDirectory() ? 'directory' : 'file', path: p, description: `Bulunan Kalıntı: ${p}` });
        } catch {}
    }

    sendLog(`macOS dosya sisteminde ${finalResults.length} potansiyel öğe bulundu.`);
    return finalResults;
}

async function searchRegistry(searchTerms: string[]): Promise<IFoundItem[]> {
    if (process.platform !== 'win32') return [];
    
    sendLog('Kayıt defteri taranıyor...');
    const hives = ['HKCU\\Software', 'HKLM\\SOFTWARE', 'HKLM\\SOFTWARE\\Wow6432Node'];
    
    const queryPromises = hives.flatMap(hive => 
        searchTerms.map(term => 
            execAsync(`REG QUERY "${hive}" /s /f "${term}" /k`).catch(err => ({ stdout: '', stderr: err.message }))
        )
    );
    
    const results = await Promise.all(queryPromises);
    const uniqueKeys = new Set<string>();
    results.forEach(res => res.stdout.split(/[\r\n]+/).filter(line => line.trim().startsWith('HKEY')).forEach(k => uniqueKeys.add(k.trim())));
    
    const filteredKeys = filterFalsePositives(Array.from(uniqueKeys), searchTerms);

    const finalResults = filteredKeys.map(k => ({ type: 'registry', path: k, description: `Registry Key: ${k}` } as IFoundItem));
    sendLog(`Kayıt defterinde ${finalResults.length} anahtar bulundu.`);
    return finalResults;
}

function expandPath(p: string): string {
  return p.replace(/%([^%]+)%/g, (_, envVar) => process.env[envVar] || '');
}

// #endregion

// #region: Main Worker Logic

async function runAnalysis(app: IApplication) {
    sendLog(`'${app.name}' için analiz worker'ı başlatıldı...`);
    
    const searchTerms = await createSearchTerms(app);

    if (searchTerms.length === 0) {
        sendLog("Ayrıntılı arama için yeterli terim bulunamadı.", 'warn');
        parentPort?.postMessage({ type: 'result', items: [] });
        return;
    }
    
    const filePromise = process.platform === 'win32' 
        ? searchFileSystemWindows(searchTerms) 
        : searchFileSystemMac(searchTerms);
        
    const registryPromise = searchRegistry(searchTerms);

    try {
        const [foundFiles, foundRegistryKeys] = await Promise.all([filePromise, registryPromise]);
        const combined = [...foundFiles, ...foundRegistryKeys];
        sendLog(`Analiz tamamlandı. Toplam ${combined.length} potansiyel kalıntı bulundu.`);
        parentPort?.postMessage({ type: 'result', items: combined });
    } catch (error) {
         sendLog(`Analiz sırasında kritik bir hata oluştu: ${error.message}`, 'error');
         parentPort?.postMessage({ type: 'error', message: error.message });
    }
}

if (parentPort) {
    runAnalysis(workerData.application);
}

// #endregion 