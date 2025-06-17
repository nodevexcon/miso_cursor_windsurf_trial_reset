import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { glob } from 'glob';
import { execCommand, sendToRenderer } from '../utils/command.runner';
import { expandPath } from '../utils/file.utils';
import { IFoundItem, ExeMetadata } from './types';

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

export class AppCleaner {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  private sendLog(message: string) {
    this.mainWindow.webContents.send('app-cleaner-progress', {
      type: 'log',
      message
    });
  }

  private createSearchTerms(metadata: ExeMetadata): string[] {
    const potentialTerms = new Set<string>();
    const details = metadata.details || {};

    const allValues: (string | undefined)[] = [
        details.ProductName,
        details.CompanyName,
        details.FileDescription,
        details.InternalName,
        details.OriginalFilename,
    ];

    for (const value of allValues) {
        if (typeof value === 'string') {
            const parts = value
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\.(exe|dll|msi)$/i, '')
                .split(/[\s,._-]+/);

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

    const finalTerms = Array.from(potentialTerms).filter(Boolean);
    this.sendLog(`Oluşturulan arama terimleri: ${finalTerms.join(', ')}`);
    return finalTerms;
  }

  async findLeftovers(metadata: ExeMetadata): Promise<IFoundItem[]> {
    this.sendLog(`'${metadata.appName}' için kalıntılar aranıyor...`);
    const searchTerms = this.createSearchTerms(metadata);

    if (searchTerms.length === 0) {
        this.sendLog("Ayrıntılı arama için yeterli terim bulunamadı. Lütfen başka bir uygulama deneyin.");
        return [];
    }
    
    const filePromise = this.searchFileSystem(searchTerms, metadata);
    const registryPromise = this.searchRegistry(searchTerms, metadata);

    const [foundFiles, foundRegistryKeys] = await Promise.all([
      filePromise,
      registryPromise
    ]);
    
    const combined = [...foundFiles, ...foundRegistryKeys];
    this.sendLog(`${combined.length} adet kalıntı bulundu.`);
    return combined;
  }

  private async searchFileSystem(searchTerms: string[], metadata: ExeMetadata): Promise<IFoundItem[]> {
    this.sendLog('Dosya sistemi taranıyor (hızlı arama)...');
    const results: IFoundItem[] = [];
    const expandedLocations = SEARCH_LOCATIONS.map(p => expandPath(p));
    const uniquePaths = new Set<string>();
    const appPublisher = (metadata.publisher || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const searchPromises = expandedLocations.flatMap(location => 
      searchTerms.map(async term => {
        if (!(await fs.pathExists(location))) return [];
        try {
          // Using the built-in 'where' command is much faster than Node's glob for large directories.
          const command = `where /R "${location}" *${term}*`;
          const stdout = await execCommand(this.mainWindow, command, [], false, true);
          return stdout.split('\r\n').filter(line => line.trim() !== '');
        } catch (error) {
          // 'where' command returns error code 1 if no files are found. We can safely ignore it.
          return [];
        }
      })
    );

    const allPaths = await Promise.all(searchPromises);
    for (const path of allPaths.flat()) {
      uniquePaths.add(path);
    }
    
    const finalResults: IFoundItem[] = [];
    const vendorRegex = /[\\\/]Program Files(?: \(x86\))?[\\\/]([^\\\/]+)/i;

    for (const path of uniquePaths) {
        const match = path.match(vendorRegex);
        if (match && match[1]) {
            const vendorInPath = match[1].toLowerCase().replace(/[^a-z0-9]/g, '');
            // If we found a vendor in the path, and it's not the app's publisher, it's likely a false positive.
            if (vendorInPath !== appPublisher && !appPublisher.includes(vendorInPath) && !vendorInPath.includes(appPublisher)) {
                continue; // Skip this path
            }
        }
        finalResults.push({ type: 'file', path: path, description: `File/Folder: ${path}` });
    }
    
    this.sendLog(`Dosya sisteminde ${finalResults.length} sonuç bulundu (filtrelenmiş).`);
    return finalResults;
  }

  private async searchRegistry(searchTerms: string[], metadata: ExeMetadata): Promise<IFoundItem[]> {
    this.sendLog('Kayıt defteri taranıyor...');
    const results: IFoundItem[] = [];
    const hives = [
      'HKCU\\Software',
      'HKLM\\SOFTWARE',
      'HKLM\\SOFTWARE\\Wow6432Node',
    ];

    const searchPromises = hives.flatMap(hive => 
      searchTerms.map(async term => {
        try {
          const command = `REG QUERY "${hive}" /s /f "${term}" /k`; // Search for keys only
          const stdout = await execCommand(this.mainWindow, command, [], false, true);
          return stdout.split('\r\n').filter(line => line.trim().startsWith('HKEY'));
        } catch (error) {
          // It's common for this to fail with no results, so we can ignore most errors
          return [];
        }
      })
    );

    const allKeys = await Promise.all(searchPromises);
    const uniqueKeys = new Set(allKeys.flat());
    const finalResults: IFoundItem[] = [];
    const appPublisher = (metadata.publisher || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const vendorRegex = /(?:HKCU|HKLM)\\SOFTWARE\\(?:Wow6432Node\\)?([^\\\\]+)/i;

    for (const key of uniqueKeys) {
        const match = key.match(vendorRegex);
        if (match && match[1]) {
            const vendorInPath = match[1].toLowerCase().replace(/[^a-z0-9]/g, '');
             if (vendorInPath !== appPublisher && !appPublisher.includes(vendorInPath) && !vendorInPath.includes(appPublisher)) {
                continue; // Skip this key
            }
        }
        finalResults.push({ type: 'registry', path: key, description: `Registry Key: ${key}` });
    }

    this.sendLog(`Kayıt defterinde ${finalResults.length} anahtar bulundu (filtrelenmiş).`);
    return finalResults;
  }
} 