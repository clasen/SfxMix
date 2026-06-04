const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const SfxMix = require('../index');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const INPUT_3S = path.join(FIXTURES_DIR, 'input_3s.wav');
const OUT_DIR = path.join(FIXTURES_DIR, 'out');

function generateSineWav(outputFile, durationSec, frequency = 440) {
    execFileSync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `sine=frequency=${frequency}:duration=${durationSec}`,
        '-ar', '44100',
        '-ac', '1',
        outputFile
    ], { stdio: 'ignore' });
}

function getDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(Number(metadata.format.duration));
        });
    });
}

function readPcmSamples(filePath) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        ffmpeg(filePath)
            .audioChannels(1)
            .audioFrequency(44100)
            .format('s16le')
            .on('error', reject)
            .pipe()
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2));
            })
            .on('error', reject);
    });
}

function getMaxVolume(filePath) {
    return new Promise((resolve, reject) => {
        let maxVolume = null;

        ffmpeg(filePath)
            .noVideo()
            .audioFilters('volumedetect')
            .format('null')
            .output(process.platform === 'win32' ? 'NUL' : '/dev/null')
            .on('stderr', (line) => {
                const match = line.match(/max_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/i);
                if (match) {
                    maxVolume = match[1] === '-inf' ? -Infinity : Number(match[1]);
                }
            })
            .on('end', () => {
                if (!Number.isFinite(maxVolume)) {
                    reject(new Error(`Could not measure max volume for ${filePath}`));
                    return;
                }
                resolve(maxVolume);
            })
            .on('error', reject)
            .run();
    });
}

before(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    if (!fs.existsSync(INPUT_3S)) {
        await generateSineWav(INPUT_3S, 3);
    }
});

test('keep([{start:0,end:1}]) on 3s audio produces 1s output', async () => {
    const output = path.join(OUT_DIR, 'keep_single.wav');
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S).keep([{ start: 0, end: 1 }]).save(output);
    const duration = await getDuration(output);
    assert.ok(Math.abs(duration - 1) < 0.05, `expected ~1s, got ${duration}s`);
});

test('three non-contiguous segments sum durations', async () => {
    const segments = [
        { start: 0, end: 0.5 },
        { start: 1, end: 1.5 },
        { start: 2, end: 2.75 }
    ];
    const expected = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const output = path.join(OUT_DIR, 'keep_three.wav');
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S).keep(segments).save(output);
    const duration = await getDuration(output);
    assert.ok(Math.abs(duration - expected) < 0.05, `expected ~${expected}s, got ${duration}s`);
});

test('joinPadMs adds silence between segments', async () => {
    const segments = [
        { start: 0, end: 0.5 },
        { start: 1, end: 1.5 },
        { start: 2, end: 2.5 }
    ];
    const segmentDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const expected = segmentDuration + 0.2;
    const output = path.join(OUT_DIR, 'keep_join_pad.wav');
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S).keep(segments, { joinPadMs: 100 }).save(output);
    const duration = await getDuration(output);
    assert.ok(Math.abs(duration - expected) < 0.06, `expected ~${expected}s, got ${duration}s`);
});

test('fadeMs lowers edge samples relative to interior peak', async () => {
    const output = path.join(OUT_DIR, 'keep_fade.wav');
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S).keep([{ start: 0.5, end: 2.5 }], { fadeMs: 20 }).save(output);

    const samples = await readPcmSamples(output);
    assert.ok(samples.length > 1000);

    const peak = (slice) => {
        let max = 0;
        for (const sample of slice) {
            max = Math.max(max, Math.abs(sample));
        }
        return max;
    };

    const edgePeak = Math.max(peak(samples.slice(0, 50)), peak(samples.slice(-50)));
    const interiorPeak = peak(samples.slice(200, samples.length - 200));
    assert.ok(edgePeak < interiorPeak, `edge peak ${edgePeak} should be below interior peak ${interiorPeak}`);
});

test('peakNormalize raises sample peak to target dB', async () => {
    const output = path.join(OUT_DIR, 'peak_normalized.wav');
    const targetDb = -3;

    await new SfxMix().add(INPUT_3S).peakNormalize(targetDb).save(output);

    const maxVolume = await getMaxVolume(output);
    assert.ok(Math.abs(maxVolume - targetDb) < 0.2, `expected peak near ${targetDb} dB, got ${maxVolume} dB`);
});

test('overlapping segments throw', async () => {
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S);
    await assert.rejects(
        () => sfx.keep([{ start: 0, end: 1.5 }, { start: 1, end: 2 }]).save(path.join(OUT_DIR, 'keep_overlap.wav')),
        /must not overlap/
    );
});

test('end beyond duration throws', async () => {
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S);
    await assert.rejects(
        () => sfx.keep([{ start: 0, end: 4 }]).save(path.join(OUT_DIR, 'keep_oob.wav')),
        /out of range/
    );
});

test('unordered segments match ordered result duration', async () => {
    const ordered = [
        { start: 0, end: 0.4 },
        { start: 1.2, end: 1.8 },
        { start: 2.1, end: 2.6 }
    ];
    const unordered = [...ordered].reverse();

    const orderedOut = path.join(OUT_DIR, 'keep_ordered.wav');
    const unorderedOut = path.join(OUT_DIR, 'keep_unordered.wav');

    await new SfxMix().add(INPUT_3S).keep(ordered).save(orderedOut);
    await new SfxMix().add(INPUT_3S).keep(unordered).save(unorderedOut);

    const orderedDuration = await getDuration(orderedOut);
    const unorderedDuration = await getDuration(unorderedOut);
    assert.ok(Math.abs(orderedDuration - unorderedDuration) < 0.02);
});

test('cut removes middle range and keeps complement', async () => {
    const output = path.join(OUT_DIR, 'cut_middle.wav');
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S).cut([{ start: 1, end: 2 }]).save(output);

    const duration = await getDuration(output);
    assert.ok(Math.abs(duration - 2) < 0.05, `expected ~2s, got ${duration}s`);
});

test('cut full-range throws because result would be empty', async () => {
    const sfx = new SfxMix();
    await sfx.add(INPUT_3S);

    await assert.rejects(
        () => sfx.cut([{ start: 0, end: 3 }]).save(path.join(OUT_DIR, 'cut_empty.wav')),
        /resulting audio would be empty/
    );
});
