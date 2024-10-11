const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class SfxMix {
    constructor(config = {}) {
        this.actions = [];
        this.currentFile = null;
        this.TMP_DIR = path.resolve(config.tmpDir || path.join(__dirname, 'tmp'));

        // Ensure the temporary directory exists and is writable
        try {
            if (!fs.existsSync(this.TMP_DIR)) {
                fs.mkdirSync(this.TMP_DIR, { recursive: true });
            }
            fs.accessSync(this.TMP_DIR, fs.constants.W_OK);
            // console.log(`Temporary directory set to: ${this.TMP_DIR}`);
        } catch (err) {
            console.error(`Error accessing temporary directory: ${this.TMP_DIR}`);
            console.error(err);
            throw new Error('Unable to access or create temporary directory');
        }
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
                            const tempFile = path.join(this.TMP_DIR, `temp_concat_${uuidv4()}.mp3`);
                            await this.concatenateAudioFiles([this.currentFile, action.input], tempFile);
                            if (this.isTempFile(this.currentFile)) {
                                fs.unlinkSync(this.currentFile);
                            }
                            this.currentFile = tempFile;
                        }
                    } else if (action.type === 'mix') {
                        // Existing mix logic
                        if (this.currentFile == null) {
                            throw new Error('No audio to mix with. Add or concatenate audio before mixing.');
                        }
                        const tempFile = path.join(this.TMP_DIR, `temp_mix_${uuidv4()}.mp3`);
                        await this.mixAudioFiles(this.currentFile, action.input, tempFile, action.options);
                        if (this.isTempFile(this.currentFile)) {
                            fs.unlinkSync(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    } else if (action.type === 'silence') {
                        // Existing silence logic
                        const tempSilenceFile = path.join(this.TMP_DIR, `temp_silence_${uuidv4()}.mp3`);
                        await this.generateSilence(action.duration, tempSilenceFile);
                        if (this.currentFile == null) {
                            this.currentFile = tempSilenceFile;
                        } else {
                            const tempFile = path.join(this.TMP_DIR, `temp_concat_${uuidv4()}.mp3`);
                            await this.concatenateAudioFiles([this.currentFile, tempSilenceFile], tempFile);
                            if (this.isTempFile(this.currentFile)) {
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
                        const tempFile = path.join(this.TMP_DIR, `temp_filter_${uuidv4()}.mp3`);
                        await this.applyFilter(this.currentFile, action.filterName, action.options, tempFile);
                        if (this.isTempFile(this.currentFile)) {
                            fs.unlinkSync(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    }
                }
                // Finalize output
                fs.renameSync(this.currentFile, output);

                // Reset internal state
                this.reset();

                resolve(output);
            } catch (err) {
                console.error('Error during audio processing:', err);
                reject(err);
            }
        });
    }

    reset() {
        this.actions = [];
        this.currentFile = null;
        return this;
    }

    // Move helper functions inside the class and use this.TMP_DIR
    isTempFile(filename) {
        return path.dirname(filename) === this.TMP_DIR && (
            filename.includes('temp_concat_') ||
            filename.includes('temp_mix_') ||
            filename.includes('temp_silence_') ||
            filename.includes('temp_filter_')
        );
    }

    concatenateAudioFiles(inputFiles, outputFile) {
        return new Promise((resolve, reject) => {
            // Use absolute paths for input files based on process.cwd()
            const absoluteInputFiles = inputFiles.map(file => path.isAbsolute(file) ? file : path.resolve(process.cwd(), file));
            const concatList = absoluteInputFiles.map(file => `file '${file}'`).join('\n');
            const concatFile = path.join(this.TMP_DIR, `concat_${uuidv4()}.txt`);

            try {
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
                        console.error('FFmpeg error:', err);
                        if (fs.existsSync(concatFile)) {
                            fs.unlinkSync(concatFile);
                        }
                        reject(err);
                    })
                    .run();
            } catch (err) {
                console.error('Error in concatenateAudioFiles:', err);
                reject(err);
            }
        });
    }

    mixAudioFiles(inputFile1, inputFile2, outputFile, options = {}) {
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

    generateSilence(durationMs, outputFile) {
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

    applyFilter(inputFile, filterName, options, outputFile) {
        return new Promise((resolve, reject) => {
            const filterChain = this.getFilterChain(filterName, options);
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

    getFilterChain(filterName, options) {
        switch (filterName) {
            case 'normalize':
                // Normalize audio using loudnorm filter with parameters
                const tp = options.tp || -3;
                const i = options.i || -20;
                const lra = options.lra || 11;
                return `loudnorm=I=${i}:TP=${tp}:LRA=${lra}:print_format=none`;

            case 'telephone':
                // Telephone effect with parameters
                const lowFreq = options.lowFreq || 300;
                const highFreq = options.highFreq || 2800;
                return `highpass=f=${lowFreq}, lowpass=f=${highFreq}`;

            case 'echo':
                // Reverb effect using aecho filter
                const inGain = options.inGain !== undefined ? options.inGain : 0.8;
                const outGain = options.outGain !== undefined ? options.outGain : 0.9;
                const delays = options.delays !== undefined ? options.delays : [1, 200, 300, 400];
                const decays = options.decays !== undefined ? options.decays : [0.5, 0.5, 0.5, 0.5];

                const delaysStr = delays.join('|');
                const decaysStr = decays.join('|');
                return `aecho=${inGain}:${outGain}:${delaysStr}:${decaysStr}`;

            case 'highpass':
                // High-pass filter
                if (options.frequency) {
                    return `highpass=f=${options.frequency}`;
                } else {
                    throw new Error('High-pass filter requires "frequency" option.');
                }

            case 'lowpass':
                // Low-pass filter
                if (options.frequency) {
                    return `lowpass=f=${options.frequency}`;
                } else {
                    throw new Error('Low-pass filter requires "frequency" option.');
                }

            case 'volume':
                // Volume adjustment
                if (options.volume !== undefined) {
                    return `volume=${options.volume}`;
                } else {
                    throw new Error('Volume filter requires "volume" option.');
                }

            case 'equalizer':
                // Equalizer filter
                if (options.frequency && options.width && options.gain !== undefined) {
                    return `equalizer=f=${options.frequency}:width_type=h:width=${options.width}:g=${options.gain}`;
                } else {
                    throw new Error('Equalizer filter requires "frequency", "width", and "gain" options.');
                }

            case 'flanger':
                // Flanger effect
                // Options: delay, depth, regen, width, speed, shape, phase, interp
                const flangerDelay = options.delay !== undefined ? options.delay : 0;
                const depth = options.depth !== undefined ? options.depth : 2;
                const regen = options.regen !== undefined ? options.regen : 0;
                const width = options.width !== undefined ? options.width : 71;
                const speed = options.speed !== undefined ? options.speed : 0.5;
                const shape = options.shape !== undefined ? options.shape : 'sine';
                const phase = options.phase !== undefined ? options.phase : 25;
                const interp = options.interp !== undefined ? options.interp : 'linear';
                return `aflanger=delay=${flangerDelay}:depth=${depth}:regen=${regen}:width=${width}:speed=${speed}:shape=${shape}:phase=${phase}:interp=${interp}`;

            case 'pitch':
                // Pitch shift effect
                // Options: pitch (in semitones)
                if (options.pitch !== undefined) {
                    const pitch = options.pitch;
                    return `asetrate=44100*${Math.pow(2, pitch / 12)},aresample=44100`;
                } else {
                    throw new Error('Pitch filter requires "pitch" option.');
                }

            case 'tremolo':
                // Tremolo effect
                // Options: frequency
                const frequency = options.frequency !== undefined ? options.frequency : 1;
                return `tremolo=f=${frequency}`;

            case 'phaser':
                // Phaser effect
                // Options: in_gain, out_gain, delay, decay, speed, type
                const in_gain = options.in_gain !== undefined ? options.in_gain : 0.4;
                const out_gain = options.out_gain !== undefined ? options.out_gain : 0.74;
                const delay = options.delay !== undefined ? options.delay : 3;
                const decay = options.decay !== undefined ? options.decay : 0.4;
                const speed_ph = options.speed !== undefined ? options.speed : 0.5;
                const type = options.type !== undefined ? options.type : 0;
                return `aphaser=in_gain=${in_gain}:out_gain=${out_gain}:delay=${delay}:decay=${decay}:speed=${speed_ph}:type=${type}`;

            case 'tempo':
                // Change the speed without changing the tone
                // Options: x (speed factor, between 0.5 and 2.0)
                if (options.x !== undefined) {
                    const tempo = options.x;
                    if (tempo < 0.5 || tempo > 2.0) {
                        // If the value is outside the supported range, chain filters
                        const tempos = [];
                        let remainingTempo = tempo;
                        while (remainingTempo < 0.5 || remainingTempo > 2.0) {
                            if (remainingTempo < 0.5) {
                                tempos.push(0.5);
                                remainingTempo /= 0.5;
                            } else {
                                tempos.push(2.0);
                                remainingTempo /= 2.0;
                            }
                        }
                        tempos.push(remainingTempo);
                        const atempoFilters = tempos.map(t => `atempo=${t}`).join(',');
                        return atempoFilters;
                    } else {
                        return `atempo=${tempo}`;
                    }
                } else {
                    throw new Error('The tempo filter requires the "x" option.');
                }

            default:
                throw new Error(`Unknown filter: ${filterName}`);
        }
    }
}

module.exports = SfxMix;