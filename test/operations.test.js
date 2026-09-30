const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const SfxMix = require('../index');
const { generateWav, generateSineWav, probe, getDuration, getMaxVolume } = require('./helpers');

const INDEX = path.join(__dirname, '..', 'index.js');
const OUT_DIR = path.join(__dirname, 'fixtures', 'out', 'operations');
const MONO_1S = path.join(OUT_DIR, 'mono_1s.wav');
const MONO_3S = path.join(OUT_DIR, 'mono_3s.wav');
const STEREO_1S = path.join(OUT_DIR, 'stereo_1s.wav');
const MONO_48K_1S = path.join(OUT_DIR, 'mono_48k_1s.wav');
const PADDED = path.join(OUT_DIR, 'padded.wav');
const TWO_BURSTS = path.join(OUT_DIR, 'two_bursts.wav');
const SILENT_TAIL = path.join(OUT_DIR, 'silent_tail.wav');

const out = (name) => path.join(OUT_DIR, name);
const near = (actual, expected, tolerance, label) =>
    assert.ok(Math.abs(actual - expected) < tolerance, `${label}: expected ~${expected}, got ${actual}`);

before(() => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    generateSineWav(MONO_1S, 1);
    generateSineWav(MONO_3S, 3, 660);
    generateSineWav(STEREO_1S, 1, 440, { channels: 2 });
    generateSineWav(MONO_48K_1S, 1, 440, { sampleRate: 48000 });
    generateWav(PADDED, 'anullsrc=r=44100:cl=mono:d=0.5[s1];sine=440:d=1[t];anullsrc=r=44100:cl=mono:d=0.5[s2];[s1][t][s2]concat=n=3:v=0:a=1');
    generateWav(TWO_BURSTS, 'sine=440:d=0.5[a];anullsrc=r=44100:cl=mono:d=0.5[s];sine=880:d=0.7[b];[a][s][b]concat=n=3:v=0:a=1');
    generateWav(SILENT_TAIL, 'sine=440:d=1[t];anullsrc=r=44100:cl=mono:d=0.3[s];[t][s]concat=n=2:v=0:a=1');
});

test('add() concatenates inputs', async () => {
    const output = out('concat.wav');
    await new SfxMix().add(MONO_1S).add(MONO_3S).add(MONO_1S).save(output);
    near(getDuration(output), 5, 0.05, 'duration');
});

test('mix() overlays inputs, longest by default and shortest on request', async () => {
    const longest = out('mix_longest.wav');
    const shortest = out('mix_shortest.wav');
    await new SfxMix().add(MONO_3S).mix(MONO_1S).save(longest);
    await new SfxMix().add(MONO_3S).mix(MONO_1S, { duration: 'shortest' }).save(shortest);
    near(getDuration(longest), 3, 0.05, 'longest');
    near(getDuration(shortest), 1, 0.05, 'shortest');
});

for (const [label, input] of [['mono 44.1kHz', MONO_1S], ['stereo 44.1kHz', STEREO_1S], ['mono 48kHz', MONO_48K_1S]]) {
    test(`silence() appends the requested duration to ${label} audio`, async () => {
        const output = out(`silence_${path.basename(input)}`);
        await new SfxMix().add(input).silence(500).save(output);
        near(getDuration(output), 1.5, 0.02, 'duration');
    });
}

test('silence() alone produces the requested duration', async () => {
    const output = out('silence_only.wav');
    await new SfxMix().silence(750).save(output);
    near(getDuration(output), 0.75, 0.02, 'duration');
});

test('filter() applies a named filter', async () => {
    const output = out('filter_volume.wav');
    await new SfxMix().add(MONO_1S).filter('volume', { volume: 0.5 }).save(output);
    near(getMaxVolume(output) - getMaxVolume(MONO_1S), -6.02, 0.2, 'gain dB');
});

test('filter() rejects unknown filters', async () => {
    await assert.rejects(
        () => new SfxMix().add(MONO_1S).filter('nope').save(out('filter_unknown.wav')),
        /Unknown filter: nope/
    );
});

test('normalize() keeps duration and respects the true peak ceiling', async () => {
    const output = out('normalize.wav');
    await new SfxMix().add(MONO_3S).normalize(-2).save(output);
    near(getDuration(output), 3, 0.05, 'duration');
    assert.ok(getMaxVolume(output) <= -1.5, 'peak should stay below the ceiling');
});

test('trim() removes leading and trailing silence', async () => {
    const output = out('trim.wav');
    await new SfxMix().add(PADDED).trim().save(output);
    near(getDuration(output), 1, 0.06, 'duration');
});

test('split() keeps the requested non-silent chunk', async () => {
    const output = out('split.wav');
    await new SfxMix().add(TWO_BURSTS).split({ chunk: 1, paddingEnd: 0 }).save(output);
    near(getDuration(output), 0.7, 0.05, 'duration');
});

test('isTruncated() tells abrupt endings from silent tails', async () => {
    const abrupt = await new SfxMix().add(MONO_1S).isTruncated();
    const silent = await new SfxMix().add(SILENT_TAIL).isTruncated();
    assert.equal(abrupt.truncated, true);
    assert.equal(silent.truncated, false);
    near(abrupt.duration, 1, 0.01, 'duration');
});

test('save() encodes by extension with the configured mp3 bitrate', async () => {
    const mp3 = out('encode.mp3');
    const ogg = out('encode.ogg');
    await new SfxMix({ bitrate: 96000 }).add(MONO_3S).save(mp3);
    await new SfxMix().add(MONO_3S).save(ogg);

    const mp3Info = probe(mp3);
    assert.equal(mp3Info.streams[0].codec_name, 'mp3');
    near(Number(mp3Info.format.bit_rate), 96000, 4000, 'mp3 bitrate');
    assert.equal(probe(ogg).streams[0].codec_name, 'opus');
});

test('save() passes custom output options to ffmpeg', async () => {
    const output = out('custom.mp3');
    await new SfxMix().add(MONO_3S).save(output, { 'c:a': 'libmp3lame', 'b:a': '32k', ar: '22050' });
    const info = probe(output);
    assert.equal(info.streams[0].sample_rate, '22050');
    near(Number(info.format.bit_rate), 32000, 2000, 'bitrate');
});

test('save() rejects with ffmpeg diagnostics when ffmpeg fails', async () => {
    const corrupt = out('corrupt.wav');
    fs.writeFileSync(corrupt, 'not audio');
    await assert.rejects(
        () => new SfxMix().add(corrupt).filter('volume', { volume: 1 }).save(out('corrupt_out.wav')),
        /ffmpeg/i
    );
});

test('FFMPEG_PATH and FFPROBE_PATH select the binaries', { skip: process.platform === 'win32' }, () => {
    const log = out('binaries.log');
    const wrap = (name) => {
        const real = execFileSync('which', [name], { encoding: 'utf8' }).trim();
        const script = out(`${name}_wrapper.sh`);
        fs.writeFileSync(script, `#!/bin/sh\necho ${name} >> "${log}"\nexec "${real}" "$@"\n`, { mode: 0o755 });
        return script;
    };

    execFileSync(process.execPath, ['-e', `
        const SfxMix = require(${JSON.stringify(INDEX)});
        new SfxMix().add(${JSON.stringify(MONO_1S)}).silence(100).save(${JSON.stringify(out('env_paths.wav'))})
            .catch((err) => { console.error(err); process.exit(1); });
    `], {
        env: { ...process.env, FFMPEG_PATH: wrap('ffmpeg'), FFPROBE_PATH: wrap('ffprobe') },
        stdio: 'ignore'
    });

    const calls = fs.readFileSync(log, 'utf8');
    assert.match(calls, /^ffmpeg$/m);
    assert.match(calls, /^ffprobe$/m);
});
