import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import SfxMix from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, 'clap.wav');
const CHUNK_COUNT = 10;

async function main() {
    const outputFiles = [];

    for (let chunk = 0; chunk < CHUNK_COUNT; chunk++) {
        const outputFile = path.join(__dirname, `clap10_bass_chunk_${chunk}.wav`);
        const sfx = new SfxMix();

        await fs.rm(outputFile, { force: true });
        await sfx
            .add(INPUT_FILE)
            .split({ chunk })
            .save(outputFile);

        outputFiles.push(outputFile);
    }

    console.log(`Successfully exported ${CHUNK_COUNT} sound chunks:`);
    console.log(`  Input:  ${INPUT_FILE}`);
    for (const outputFile of outputFiles) {
        console.log(`  Output: ${outputFile}`);
    }
}

main().catch((error) => {
    console.error('Error splitting sound chunks:', error.message);
    process.exitCode = 1;
});
