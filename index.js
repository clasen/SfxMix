const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

class SfxMix {
    constructor() {
        this.actions = [];
        this.currentFile = null; // Keep track of the current audio file
    }

    add(input) {
        this.actions.push({ type: 'add', input });
        return this;
    }

    mix(input, options = {}) {
        if (this.actions.length === 0) {
            this.actions.push({ type: 'add', input });
        } else {
            this.actions.push({ type: 'mix', input, options });
        }
        return this;
    }

    silence(milliseconds) {
        this.actions.push({ type: 'silence', duration: milliseconds });
        return this;
    }

    filter(filterName, options = {}) {
        this.actions.push({ type: 'filter', filterName, options });
        return this;
    }

    save(output) {
        return new Promise(async (resolve, reject) => {
            try {
                for (let action of this.actions) {
                    if (action.type === 'add') {
                        // Existing add logic
                        if (this.currentFile == null) {
                            this.currentFile = action.input;
                        } else {
                            const tempFile = `temp_concat_${Date.now()}.mp3`;
                            await concatenateAudioFiles([this.currentFile, action.input], tempFile);
                            if (isTempFile(this.currentFile)) {
                                fs.unlinkSync(this.currentFile);
                            }
                            this.currentFile = tempFile;
                        }
                    } else if (action.type === 'mix') {
                        // Existing mix logic
                        if (this.currentFile == null) {
                            throw new Error('No audio to mix with. Add or concatenate audio before mixing.');
                        }
                        const tempFile = `temp_mix_${Date.now()}.mp3`;
                        await mixAudioFiles(this.currentFile, action.input, tempFile, action.options);
                        if (isTempFile(this.currentFile)) {
                            fs.unlinkSync(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    } else if (action.type === 'silence') {
                        // Existing silence logic
                        const tempSilenceFile = `temp_silence_${Date.now()}.mp3`;
                        await generateSilence(action.duration, tempSilenceFile);
                        if (this.currentFile == null) {
                            this.currentFile = tempSilenceFile;
                        } else {
                            const tempFile = `temp_concat_${Date.now()}.mp3`;
                            await concatenateAudioFiles([this.currentFile, tempSilenceFile], tempFile);
                            if (isTempFile(this.currentFile)) {
                                fs.unlinkSync(this.currentFile);
                            }
                            fs.unlinkSync(tempSilenceFile); // Remove the silence file
                            this.currentFile = tempFile;
                        }
                    } else if (action.type === 'filter') {
                        // New filter logic
                        if (this.currentFile == null) {
                            throw new Error('No audio to apply filter to. Add audio before applying filters.');
                        }
                        const tempFile = `temp_filter_${Date.now()}.mp3`;
                        await applyFilter(this.currentFile, action.filterName, action.options, tempFile);
                        if (isTempFile(this.currentFile)) {
                            fs.unlinkSync(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    }
                }
                // Finalize output
                fs.renameSync(this.currentFile, output);
                resolve(output);
            } catch (err) {
                reject(err);
            }
        });
    }
}

// Helper functions

function isTempFile(filename) {
    return (
        filename.startsWith('temp_concat_') ||
        filename.startsWith('temp_mix_') ||
        filename.startsWith('temp_silence_') ||
        filename.startsWith('temp_filter_')
    );
}

function concatenateAudioFiles(inputFiles, outputFile) {
    return new Promise((resolve, reject) => {
        const concatList = inputFiles.map(file => `file '${file}'`).join('\n');
        const concatFile = `concat_${Date.now()}.txt`;
        fs.writeFileSync(concatFile, concatList);

        ffmpeg()
            .input(concatFile)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions(['-c', 'copy'])
            .output(outputFile)
            .on('end', () => {
                fs.unlinkSync(concatFile);
                resolve();
            })
            .on('error', (err) => {
                fs.unlinkSync(concatFile);
                reject(err);
            })
            .run();
    });
}

function mixAudioFiles(inputFile1, inputFile2, outputFile, options = {}) {
    return new Promise((resolve, reject) => {
        const durationOption = options.duration || 'longest'; // Default to 'longest'
        ffmpeg()
            .input(inputFile1)
            .input(inputFile2)
            .complexFilter([
                {
                    filter: 'amix',
                    options: {
                        inputs: 2,
                        duration: durationOption,
                    },
                },
            ])
            .audioCodec('libmp3lame') // Ensure the codec is MP3
            .format('mp3') // Ensure the format is MP3
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}

function generateSilence(durationMs, outputFile) {
    return new Promise((resolve, reject) => {
        const durationSec = durationMs / 1000;
        ffmpeg()
            .input('anullsrc=channel_layout=stereo:sample_rate=44100')
            .inputOptions(['-f', 'lavfi', '-t', `${durationSec}`])
            .audioCodec('libmp3lame')
            .format('mp3')
            .output(outputFile)
            .on('end', () => {
                if (fs.existsSync(outputFile)) {
                    resolve();
                } else {
                    reject(new Error(`Failed to generate silence file: ${outputFile}`));
                }
            })
            .on('error', (err) => reject(err))
            .run();
    });
}

function applyFilter(inputFile, filterName, options, outputFile) {
    return new Promise((resolve, reject) => {
        const filterChain = getFilterChain(filterName, options);
        if (!filterChain) {
            return reject(new Error(`Unknown filter: ${filterName}`));
        }

        ffmpeg()
            .input(inputFile)
            .audioFilters(filterChain)
            .audioCodec('libmp3lame')
            .format('mp3')
            .output(outputFile)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}

function getFilterChain(filterName, options) {
    switch (filterName) {
        case 'normalize':
            // Normalize audio using loudnorm filter with parameters
            // Options: i (target integrated loudness), tp (true peak), lra (loudness range)
            const i = options.i || -16;
            const tp = options.tp || -1.5;
            const lra = options.lra || 11;
            return `loudnorm=I=${i}:TP=${tp}:LRA=${lra}:print_format=none`;
        case 'telephone':
            // Telephone effect with parameters
            // Options: lowFreq (default 300), highFreq (default 3400)
            const lowFreq = options.lowFreq || 300;
            const highFreq = options.highFreq || 3400;
            return `highpass=f=${lowFreq}, lowpass=f=${highFreq}`;
        case 'echo':
            // Default echo parameters: delay=500ms, decay=0.5
            const echoDelay = options.delay || 500;
            const echoDecay = options.decay || 0.5;
            return `aecho=0.8:0.88:${echoDelay}:${echoDecay}`;
        case 'reverb':
            // Simple reverb effect
            return 'areverb';
        case 'highpass':
            // High-pass filter: cutoff frequency in Hz
            if (options.frequency) {
                return `highpass=f=${options.frequency}`;
            } else {
                throw new Error('High-pass filter requires "frequency" option.');
            }
        case 'lowpass':
            // Low-pass filter: cutoff frequency in Hz
            if (options.frequency) {
                return `lowpass=f=${options.frequency}`;
            } else {
                throw new Error('Low-pass filter requires "frequency" option.');
            }
        case 'volume':
            // Volume adjustment: volume multiplier (e.g., 0.5 for 50%)
            if (options.volume !== undefined) {
                return `volume=${options.volume}`;
            } else {
                throw new Error('Volume filter requires "volume" option.');
            }
        case 'equalizer':
            // Equalizer filter: frequency, width, gain
            if (options.frequency && options.width && options.gain !== undefined) {
                return `equalizer=f=${options.frequency}:width_type=h:width=${options.width}:g=${options.gain}`;
            } else {
                throw new Error('Equalizer filter requires "frequency", "width", and "gain" options.');
            }
        default:
            return null;
    }
}

module.exports = SfxMix;