import path from 'path';
import { fileURLToPath } from 'url';
import SfxMix from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '0001.mp3');
const outputFile = path.join(__dirname, 'demo11_0001_normalized.mp3');

try {
    await new SfxMix()
        .add(inputFile)
        .peakNormalize()
        .save(outputFile);

    console.log(`Successfully exported: ${outputFile}`);
} catch (error) {
    console.error('Error exporting peak-normalized 0001.mp3:', error);
    process.exitCode = 1;
}
