import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs/promises';
const { parseBytes } = require('pe-toolkit');

async function getMetadata(filePath: string) {
    if (!parentPort) return;

    try {
        const fileBuffer = await fs.readFile(filePath);
        const versionInfo = parseBytes(fileBuffer);

        if (versionInfo.length === 0 || !versionInfo[0].getVsVersionInfo()) {
            throw new Error('No version information found in the executable.');
        }

        const stringFileInfo = versionInfo[0].getStringFileInfo();
        const metadataTable: any = Object.values(stringFileInfo)[0];
      
        parentPort.postMessage({ type: 'success', metadata: metadataTable });

    } catch (error: any) {
        parentPort.postMessage({ type: 'error', message: error.message || 'Unknown worker error' });
    }
}

getMetadata(workerData.filePath); 