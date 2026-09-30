const { execFileSync, spawnSync } = require('child_process');

function generateWav(outputFile, lavfiSource, { sampleRate = 44100, channels = 1 } = {}) {
    execFileSync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', lavfiSource,
        '-ar', String(sampleRate),
        '-ac', String(channels),
        outputFile
    ], { stdio: 'ignore' });
}

function generateSineWav(outputFile, durationSec, frequency = 440, options) {
    generateWav(outputFile, `sine=frequency=${frequency}:duration=${durationSec}`, options);
}

function probe(filePath) {
    const output = execFileSync('ffprobe', [
        '-v', 'error',
        '-show_streams',
        '-show_format',
        '-of', 'json',
        filePath
    ]);
    return JSON.parse(output);
}

function getDuration(filePath) {
    return Number(probe(filePath).format.duration);
}

function readPcmSamples(filePath) {
    const buffer = execFileSync('ffmpeg', [
        '-v', 'error',
        '-i', filePath,
        '-ac', '1',
        '-ar', '44100',
        '-f', 's16le',
        'pipe:1'
    ], { maxBuffer: 256 * 1024 * 1024 });
    return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
}

function getMaxVolume(filePath) {
    const { stderr } = spawnSync('ffmpeg', [
        '-i', filePath,
        '-vn',
        '-filter:a', 'volumedetect',
        '-f', 'null',
        process.platform === 'win32' ? 'NUL' : '/dev/null'
    ], { encoding: 'utf8' });
    const match = stderr.match(/max_volume:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dB/i);
    if (!match) {
        throw new Error(`Could not measure max volume for ${filePath}`);
    }
    return match[1] === '-inf' ? -Infinity : Number(match[1]);
}

module.exports = {
    generateWav,
    generateSineWav,
    probe,
    getDuration,
    readPcmSamples,
    getMaxVolume
};
