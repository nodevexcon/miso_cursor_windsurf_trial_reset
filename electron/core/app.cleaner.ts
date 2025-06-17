// This file is intentionally left blank for now.
// The core cleaning and analysis logic has been moved to dedicated workers:
// - electron/core/search.worker.ts (for finding leftovers)
// - electron/core/reset.worker.ts (for deleting items)
// This improves performance by offloading heavy tasks from the main process.

import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execCommand } from '../utils/command.runner';
import { expandPath } from '../utils/file.utils';
import { IFoundItem, ExeMetadata, IApplication } from './types';
import * as os from 'os';

const SEARCH_LOCATIONS = [
  '%APPDATA%',
  '%LOCALAPPDATA%',
  '%PROGRAMDATA%',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
];

const GENERIC_TERMS = new Set([
    'microsoft', 'windows', 'google', 'corp', 'corporation', 'inc', 
    'the', 'a', 'and', 'of', 'in', 'for', 'to', 'with', 'on', 'at',
    'setup', 'install', 'installer', 'application', 'service', 'program',
    'driver', 'common', 'files', 'runtime', 'framework', 'component',
    'shell', 'data', 'edge', 'client', 'server', 'update', 'core', 'cursor'
]);

const MAJOR_PUBLISHERS = new Set([
    'microsoft', 'google', 'apple', 'oracle', 'adobe', 'amazon', 'mozilla',
    'intel', 'nvidia', 'amd', 'realtek', 'vmware', 'docker', 'autodesk'
]);

function createSearchTerms(metadata: ExeMetadata | IApplication, onLog: (message: string) => void): string[] {
    const potentialTerms = new Set<string>();
    
    if ('details' in metadata) { // It's ExeMetadata
        const details = metadata.details || {};
        const allValues = [details.ProductName, details.CompanyName, details.FileDescription, details.InternalName, details.OriginalFilename];
        for (const value of allValues) {
            if (typeof value === 'string') {
                const parts = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\.(exe|dll|msi)$/i, '').split(/[\s,._-]+/);
                for (const part of parts) {
                    const cleanPart = part.trim().toLowerCase();
                    if (cleanPart && cleanPart.length > 2 && !GENERIC_TERMS.has(cleanPart) && isNaN(Number(cleanPart))) {
                        potentialTerms.add(cleanPart);
                    }
                }
            }
        }
        if (metadata.appName && metadata.appName.split(' ').length < 4) {
             const cleanAppName = metadata.appName.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();
             if (!GENERIC_TERMS.has(cleanAppName)) potentialTerms.add(cleanAppName);
        }
        if (metadata.publisher && metadata.publisher.split(' ').length < 4) {
            const cleanPublisher = metadata.publisher.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();
            if (!GENERIC_TERMS.has(cleanPublisher)) potentialTerms.add(cleanPublisher);
        }
    } else { // It's IApplication
        const allTerms = new Set<string>();
        // Add the full ID and name, split by common separators
        const parts = `${metadata.id} ${metadata.name}`.toLowerCase().split(/[\s,._-]+/);
        
        for (const part of parts) {
            const cleanPart = part.trim();
            if (cleanPart && cleanPart.length > 2 && !GENERIC_TERMS.has(cleanPart)) {
                allTerms.add(cleanPart);
            }
        }
        // Also add the original id and name if they aren't generic
        if (!GENERIC_TERMS.has(metadata.id.toLowerCase())) {
            potentialTerms.add(metadata.id.toLowerCase());
        }
        if (!GENERIC_TERMS.has(metadata.name.toLowerCase())) {
            potentialTerms.add(metadata.name.toLowerCase());
        }
        allTerms.forEach(term => potentialTerms.add(term));
    }
    
    const finalTerms = Array.from(potentialTerms).filter(Boolean);
    onLog(`Oluşturulan arama terimleri: ${finalTerms.join(', ')}`);
    return finalTerms;
}

async function searchFileSystemWindows(searchTerms: string[], metadata: ExeMetadata | IApplication, onLog: (message: string) => void): Promise<IFoundItem[]> {
    onLog('Windows dosya sistemi taranıyor...');
    const uniquePaths = new Set<string>();
    const appPublisher = ('publisher' in metadata ? metadata.publisher || '' : '').toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const location of SEARCH_LOCATIONS.map(p => expandPath(p))) {
        for (const term of searchTerms) {
            if (!(await fs.pathExists(location))) continue;
            try {
                const command = `where /R "${location}" *${term}*`;
                const stdout = await execCommand(command, [], false);
                stdout.split(/[\r\n]+/).filter(Boolean).forEach(p => uniquePaths.add(p));
            } catch (error) { /* Ignore 'where' command errors */ }
        }
    }
    
    const finalResults: IFoundItem[] = [];
    for (const p of uniquePaths) {
        try {
            const stats = await fs.stat(p);
            finalResults.push({
                type: stats.isDirectory() ? 'directory' : 'file',
                path: p,
                description: `Found at: ${p}`
            });
        } catch { /* Ignore stat errors for paths that might disappear */ }
    }
    
    onLog(`Windows dosya sisteminde ${finalResults.length} potansiyel öğe bulundu.`);
    return finalResults;
}

async function searchFileSystemMac(searchTerms: string[], metadata: ExeMetadata | IApplication, onLog: (message: string) => void): Promise<IFoundItem[]> {
    onLog("macOS dosya sistemi taranıyor...");
    const homeDir = os.homedir();
    const macLocations = [
        path.join(homeDir, 'Library', 'Application Support'),
        path.join(homeDir, 'Library', 'Caches'),
        path.join(homeDir, 'Library', 'Preferences'),
        path.join(homeDir, 'Library', 'Containers'),
        path.join(homeDir, 'Library', 'Cookies'),
        path.join(homeDir, 'Library', 'Logs'),
        path.join(homeDir, 'Library', 'Internet Plug-Ins'),
        '/Library/Application Support',
        '/Library/Caches',
        '/Library/Logs',
    ];

    const uniquePaths = new Set<string>();

    for (const location of macLocations) {
        if (!(await fs.pathExists(location))) continue;
        
        // Build a single `find` command for efficiency
        const findArgs = [location];
        const nameConditions = searchTerms.flatMap(term => ['-iname', `*${term}*`]);
        // The structure is find [path] ( -iname "*term1*" -o -iname "*term2*" ... )
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

        try {
            const stdout = await execCommand('find', findArgs, false);
            stdout.split(/[\r\n]+/).filter(Boolean).forEach(p => uniquePaths.add(p));
        } catch (error) {
            onLog(`Uyarı: '${location}' içinde arama yapılırken hata oluştu. Bu normal olabilir. Hata: ${error.message}`);
        }
    }

    const finalResults: IFoundItem[] = [];
    for (const p of uniquePaths) {
        try {
            const stats = await fs.stat(p);
            finalResults.push({
                type: stats.isDirectory() ? 'directory' : 'file',
                path: p,
                description: `Found at: ${p}`
            });
        } catch { /* Ignore stat errors */ }
    }

    onLog(`macOS dosya sisteminde ${finalResults.length} potansiyel öğe bulundu.`);
    return finalResults;
}

async function searchFileSystem(searchTerms: string[], metadata: ExeMetadata | IApplication, onLog: (message: string) => void): Promise<IFoundItem[]> {
    switch (process.platform) {
        case 'win32':
            return searchFileSystemWindows(searchTerms, metadata, onLog);
        case 'darwin':
            return searchFileSystemMac(searchTerms, metadata, onLog);
        default:
            onLog(`${process.platform} için dosya sistemi taraması desteklenmiyor.`);
            return [];
    }
}

async function searchRegistry(searchTerms: string[], onLog: (message: string) => void): Promise<IFoundItem[]> {
    if (process.platform !== 'win32') {
        return [];
    }
    onLog('Kayıt defteri taranıyor...');
    const uniqueKeys = new Set<string>();
    const hives = ['HKCU\\Software', 'HKLM\\SOFTWARE', 'HKLM\\SOFTWARE\\Wow6432Node'];

    for (const hive of hives) {
        for (const term of searchTerms) {
            try {
                const command = `REG QUERY "${hive}" /s /f "${term}" /k`;
                const stdout = await execCommand(command, [], false);
                stdout.split(/[\r\n]+/).filter(line => line.trim().startsWith('HKEY')).forEach(k => uniqueKeys.add(k));
            } catch (error) { /* Ignore registry query errors */ }
        }
    }
    const finalResults = Array.from(uniqueKeys).map(k => ({ type: 'registry', path: k, description: `Registry Key: ${k}` } as IFoundItem));
    onLog(`Kayıt defterinde ${finalResults.length} anahtar bulundu.`);
    return finalResults;
}

export async function findLeftovers(metadata: ExeMetadata | IApplication, onLog: (message: string) => void): Promise<IFoundItem[]> {
    const logName = 'name' in metadata ? metadata.name : metadata.appName;
    onLog(`'${logName}' için kalıntılar aranıyor...`);
    const searchTerms = createSearchTerms(metadata, onLog);

    if (searchTerms.length === 0) {
        onLog("Ayrıntılı arama için yeterli terim bulunamadı.");
        return [];
    }
    
    const filePromise = searchFileSystem(searchTerms, metadata, onLog);
    const registryPromise = searchRegistry(searchTerms, onLog);

    const [foundFiles, foundRegistryKeys] = await Promise.all([filePromise, registryPromise]);
    
    const combined = [...foundFiles, ...foundRegistryKeys];
    onLog(`Akıllı arama ${combined.length} potansiyel kalıntı buldu.`);
    return combined;
}

export class AppCleaner {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  private sendLog(message: string) {
    this.mainWindow.webContents.send('app-cleaner-progress', { type: 'log', message });
  }

  async findLeftoversForUI(metadata: ExeMetadata): Promise<IFoundItem[]> {
      return findLeftovers(metadata, (msg) => this.sendLog(msg));
  }
} 