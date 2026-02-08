import SfxMix from '../index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const sfx = new SfxMix();

    const evalDir = path.join(__dirname, 'eval');
    const files = [
        'everyo_collap_en_us_secyut_1y7pqko.mp3',
        'theyre_callin_it_a_sudden_208g2a.mp3',
        'were_on_cnn_too_en_us_secyut_ve1xs.mp3'
    ];

    console.log('=== Truncation Detection Test ===\n');

    for (const file of files) {
        const filePath = path.join(evalDir, file);
        try {
            const result = await sfx.add(filePath).isTruncated();
            console.log(`File: ${file}`);
            console.log(`  Truncated:  ${result.truncated}`);
            console.log(`  Tail RMS:   ${result.tailRmsDb} dB`);
            console.log(`  Tail Peak:  ${result.tailPeakDb} dB`);
            console.log(`  Duration:   ${result.duration}s`);
            console.log(`  Threshold:  ${result.threshold} dB`);
            console.log(`  Tail analyzed: ${result.tailDuration} ms`);
            console.log('');
        } catch (err) {
            console.error(`Error analyzing ${file}:`, err.message);
        }
    }

    sfx.cleanup();
}

main();
