const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Readable } = require('stream');

class SfxMix {
    constructor(config = {}) {
        this.actions = [];
        this.currentFile = null;
        this.tempCounter = 0;
        
        // Default bitrate: null = auto-detect, or specify a value (e.g., 64000, 128000, 192000)
        this.bitrate = config.bitrate !== undefined ? config.bitrate : 64000;
        
        // Create a unique temporary directory for this instance
        try {
            const tmpBase = config.tmpDir || os.tmpdir();
            this.TMP_DIR = fs.mkdtempSync(path.join(tmpBase, 'sfxmix-'));
        } catch (err) {
            console.error('Error creating temporary directory:', err);
            throw new Error('Unable to create temporary directory');
        }
        
        // Setup cleanup handlers
        this.cleanupHandler = () => this.cleanup();
        process.on('exit', this.cleanupHandler);
        process.on('SIGINT', () => {
            this.cleanup();
            process.exit();
        });
        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit();
        });
    }
    
    getTempFile(prefix) {
        return path.join(this.TMP_DIR, `${prefix}_${++this.tempCounter}.mp3`);
    }
    
    cleanup() {
        try {
            if (this.TMP_DIR && fs.existsSync(this.TMP_DIR)) {
                fs.rmSync(this.TMP_DIR, { recursive: true, force: true });
            }
        } catch (err) {
            console.warn('Error cleaning up temp directory:', err.message);
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

    trim(options = {}) {
        this.actions.push({ type: 'trim', options });
        return this;
    }

    normalize(tp = -1.5) {
        return this.filter('normalize', { tp });
    }

    convertAudio(inputFile, outputFile, outputOptions = {}) {
        return new Promise((resolve, reject) => {
            const command = ffmpeg().input(inputFile);
            
            // Apply custom output options if provided
            if (Object.keys(outputOptions).length > 0) {
                // Convert object to array format for FFmpeg
                const optionsArray = [];
                for (const [key, value] of Object.entries(outputOptions)) {
                    optionsArray.push(`-${key}`, value);
                }
                command.outputOptions(optionsArray);
            } else {
                // Auto-detect format and apply defaults based on file extension
                const ext = path.extname(outputFile).toLowerCase();
                switch (ext) {
                    case '.ogg':
                        command.audioCodec('libopus').format('ogg');
                        break;
                    case '.wav':
                        command.audioCodec('pcm_s16le').format('wav');
                        break;
                    case '.flac':
                        command.audioCodec('flac').format('flac');
                        break;
                    case '.aac':
                    case '.m4a':
                        command.audioCodec('aac').format('mp4');
                        break;
                    case '.mp3':
                    default:
                        command.audioCodec('libmp3lame').format('mp3');
                        break;
                }
            }
            
            command
                .output(outputFile)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    // Keep convertToOgg for backward compatibility
    convertToOgg(inputFile, outputFile, options = {}) {
        return this.convertAudio(inputFile, outputFile, options);
    }

    save(output, outputOptions = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                // Process all actions
                for (let action of this.actions) {
                    if (action.type === 'add') {
                        if (this.currentFile == null) {
                            this.currentFile = path.isAbsolute(action.input) ? action.input : path.resolve(process.cwd(), action.input);
                        } else {
                            const tempFile = this.getTempFile('concat');
                            await this.concatenateAudioFiles([this.currentFile, action.input], tempFile);
                            if (this.isTempFile(this.currentFile)) {
                                this.safeDeleteFile(this.currentFile);
                            }
                            this.currentFile = tempFile;
                        }
                    } else if (action.type === 'mix') {
                        if (this.currentFile == null) {
                            throw new Error('No audio to mix with. Add or concatenate audio before mixing.');
                        }
                        const tempFile = this.getTempFile('mix');
                        await this.mixAudioFiles(this.currentFile, action.input, tempFile, action.options);
                        if (this.isTempFile(this.currentFile)) {
                            this.safeDeleteFile(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    } else if (action.type === 'silence') {
                        const tempSilenceFile = this.getTempFile('silence');
                        // Get audio info from current file to match channels and sample rate
                        let audioInfo = null;
                        if (this.currentFile != null) {
                            try {
                                audioInfo = await this.getAudioInfo(this.currentFile);
                            } catch (err) {
                                console.warn('Could not get audio info, using defaults:', err.message);
                            }
                        }
                        await this.generateSilence(action.duration, tempSilenceFile, audioInfo);
                        if (this.currentFile == null) {
                            this.currentFile = tempSilenceFile;
                        } else {
                            const tempFile = this.getTempFile('concat');
                            await this.concatenateAudioFiles([this.currentFile, tempSilenceFile], tempFile);
                            if (this.isTempFile(this.currentFile)) {
                                this.safeDeleteFile(this.currentFile);
                            }
                            this.safeDeleteFile(tempSilenceFile);
                            this.currentFile = tempFile;
                        }
                    } else if (action.type === 'filter') {
                        if (this.currentFile == null) {
                            throw new Error('No audio to apply filter to. Add audio before applying filters.');
                        }
                        const tempFile = this.getTempFile('filter');
                        await this.applyFilter(this.currentFile, action.filterName, action.options, tempFile);
                        if (this.isTempFile(this.currentFile)) {
                            this.safeDeleteFile(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    } else if (action.type === 'trim') {
                        if (this.currentFile == null) {
                            throw new Error('No audio to trim. Add audio before trimming.');
                        }
                        const tempFile = this.getTempFile('trim');
                        await this.applyTrim(this.currentFile, action.options, tempFile);
                        if (this.isTempFile(this.currentFile)) {
                            this.safeDeleteFile(this.currentFile);
                        }
                        this.currentFile = tempFile;
                    }
                }
                
                // Prepare output
                const absoluteOutput = path.resolve(process.cwd(), output);
                const outputDir = path.dirname(absoluteOutput);

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                if (!fs.existsSync(this.currentFile)) {
                    throw new Error(`Source file does not exist: ${this.currentFile}`);
                }

                // Check if we need format conversion
                const needsConversion = Object.keys(outputOptions).length > 0 || 
                                      output.toLowerCase().endsWith('.ogg') || 
                                      output.toLowerCase().endsWith('.wav') || 
                                      output.toLowerCase().endsWith('.flac') ||
                                      output.toLowerCase().endsWith('.aac') ||
                                      output.toLowerCase().endsWith('.m4a');

                if (needsConversion) {
                    // Use conversion with custom options
                    await this.convertAudio(this.currentFile, absoluteOutput, outputOptions);
                    // Clean up the source temp file after conversion
                    if (this.isTempFile(this.currentFile)) {
                        this.safeDeleteFile(this.currentFile);
                    }
                } else {
                    // Save as MP3 or original format (no conversion needed)
                    try {
                        fs.renameSync(this.currentFile, absoluteOutput);
                    } catch (renameErr) {
                        // If rename fails, try to copy the file instead
                        fs.copyFileSync(this.currentFile, absoluteOutput);
                        if (this.isTempFile(this.currentFile)) {
                            this.safeDeleteFile(this.currentFile);
                        }
                    }
                }

                this.reset();
                resolve(absoluteOutput);
            } catch (err) {
                console.error('Error during audio processing:', err);
                // Clean up current temp file if it exists
                if (this.currentFile && this.isTempFile(this.currentFile)) {
                    this.safeDeleteFile(this.currentFile);
                }
                reject(err);
            }
        });
    }

    reset() {
        this.actions = [];
        this.currentFile = null;
        return this;
    }

    // Safe file deletion with retry logic
    safeDeleteFile(filePath, maxRetries = 3) {
        if (!filePath || !fs.existsSync(filePath)) {
            return;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                fs.unlinkSync(filePath);
                return;
            } catch (err) {
                if (attempt === maxRetries) {
                    console.warn(`Failed to delete file after ${maxRetries} attempts: ${filePath}`, err.message);
                } else {
                    // Wait a bit before retrying (exponential backoff)
                    const waitTime = Math.pow(2, attempt) * 10; // 20ms, 40ms, 80ms
                    const start = Date.now();
                    while (Date.now() - start < waitTime) {
                        // Busy wait (not ideal but simple)
                    }
                }
            }
        }
    }

    // Check if a file is in our temporary directory
    isTempFile(filename) {
        return filename.startsWith(this.TMP_DIR);
    }

    concatenateAudioFiles(inputFiles, outputFile) {
        return new Promise((resolve, reject) => {
            try {
                // Create a simple concat list file
                const concatFile = path.join(this.TMP_DIR, `concat_${++this.tempCounter}.txt`);
                
                // Use absolute paths for input files based on process.cwd()
                const absoluteInputFiles = inputFiles.map(file => 
                    path.isAbsolute(file) ? file : path.resolve(process.cwd(), file)
                );

                // Verify all input files exist
                for (const file of absoluteInputFiles) {
                    if (!fs.existsSync(file)) {
                        throw new Error(`Input file does not exist: ${file}`);
                    }
                }

                const concatList = absoluteInputFiles.map(file => `file '${file}'`).join('\n');
                
                // Write the concat list file
                fs.writeFileSync(concatFile, concatList, 'utf8');

                ffmpeg()
                    .input(concatFile)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions(['-c', 'copy'])
                    .output(outputFile)
                    .on('end', () => {
                        // Clean up concat list file
                        this.safeDeleteFile(concatFile);
                        resolve();
                    })
                    .on('error', (ffmpegErr) => {
                        console.error('FFmpeg concatenation error:', ffmpegErr);
                        // Clean up concat list file
                        this.safeDeleteFile(concatFile);
                        reject(ffmpegErr);
                    })
                    .run();

            } catch (error) {
                console.error('Error in concatenateAudioFiles:', error);
                reject(error);
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
                .audioCodec('libmp3lame')
                .format('mp3')
                .output(outputFile)
                .on('end', () => resolve())
                .on('error', (err) => reject(err))
                .run();
        });
    }

    getAudioInfo(inputFile) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputFile, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
                if (!audioStream) {
                    reject(new Error('No audio stream found'));
                    return;
                }
                
                resolve({
                    channels: audioStream.channels || 2,
                    sampleRate: audioStream.sample_rate || 44100,
                    bitrate: metadata.format.bit_rate || 128000
                });
            });
        });
    }

    generateSilence(durationMs, outputFile, audioInfo = null) {
        return new Promise((resolve, reject) => {
            const durationSec = durationMs / 1000;
            const sampleRate = audioInfo?.sampleRate || 44100;
            const numChannels = audioInfo?.channels || 2;
            
            // Use audioInfo bitrate if available, otherwise use bitrate or 128000 as fallback
            const bitrate = audioInfo?.bitrate || this.bitrate || 128000;
            
            const bytesPerSample = 2; // 16-bit audio
            const bytesPerSecond = sampleRate * numChannels * bytesPerSample;
            let totalBytes = Math.floor(durationSec * bytesPerSecond);

            const silenceStream = new Readable({
                read(size) {
                    const chunkSize = Math.min(size, totalBytes);
                    if (chunkSize <= 0) {
                        this.push(null);
                        return;
                    }
                    this.push(Buffer.alloc(chunkSize, 0));
                    totalBytes -= chunkSize;
                }
            });

            const bitrateKbps = Math.floor(bitrate / 1000) + 'k';

            ffmpeg()
                .input(silenceStream)
                .inputFormat('s16le')
                .audioChannels(numChannels)
                .audioFrequency(sampleRate)
                .audioCodec('libmp3lame')
                .audioBitrate(bitrateKbps)
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
        return new Promise(async (resolve, reject) => {
            try {
                const filterChain = this.getFilterChain(filterName, options);
                if (!filterChain) {
                    return reject(new Error(`Unknown filter: ${filterName}`));
                }

                let bitrateKbps;
                
                // If bitrate is null, auto-detect from input file
                if (this.bitrate === null) {
                    let audioInfo = null;
                    try {
                        audioInfo = await this.getAudioInfo(inputFile);
                    } catch (err) {
                        console.warn('Could not get audio info for filter, using 128k default:', err.message);
                    }
                    bitrateKbps = audioInfo ? Math.floor(audioInfo.bitrate / 1000) + 'k' : '128k';
                } else {
                    // Use configured default bitrate
                    bitrateKbps = Math.floor(this.bitrate / 1000) + 'k';
                }

                const command = ffmpeg()
                    .input(inputFile)
                    .audioFilters(filterChain)
                    .audioCodec('libmp3lame')
                    .audioBitrate(bitrateKbps)
                    .format('mp3')
                    .output(outputFile);

                command
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            } catch (err) {
                reject(err);
            }
        });
    }

    applyTrim(inputFile, options, outputFile) {
        return new Promise(async (resolve, reject) => {
            try {
                // Default options for silenceremove filter
                // startDuration: minimum duration of silence to detect at start (in seconds)
                // startThreshold: noise tolerance for start (in dB, e.g., -50dB)
                // stopDuration: minimum duration of silence to detect at end (in seconds)
                // stopThreshold: noise tolerance for end (in dB)
                // paddingStart: milliseconds of silence to add at the start (after removing silence)
                // paddingEnd: milliseconds of silence to add at the end (after removing silence)
                
                const startDuration = options.startDuration !== undefined ? options.startDuration : 0;
                const startThreshold = options.startThreshold !== undefined ? options.startThreshold : -40;
                const stopDuration = options.stopDuration !== undefined ? options.stopDuration : 0;
                const stopThreshold = options.stopThreshold !== undefined ? options.stopThreshold : -40;
                const paddingStart = options.paddingStart || 0; // in milliseconds
                const paddingEnd = options.paddingEnd || 0; // in milliseconds

                // Build filter chain
                // Strategy: Remove silence from start, then reverse audio, remove silence from new start (old end), then reverse back
                // This ensures we ONLY remove silence from the beginning and end, preserving intermediate silences
                const filters = [];
                
                // Step 1: Remove silence from the start
                filters.push(`silenceremove=start_periods=1:start_duration=${startDuration}:start_threshold=${startThreshold}dB:detection=peak`);
                
                // Step 2: Reverse the audio
                filters.push('areverse');
                
                // Step 3: Remove silence from what is now the start (but was the end)
                filters.push(`silenceremove=start_periods=1:start_duration=${stopDuration}:start_threshold=${stopThreshold}dB:detection=peak`);
                
                // Step 4: Reverse back to original direction
                filters.push('areverse');
                
                // Add padding at start if specified
                if (paddingStart > 0) {
                    filters.push(`adelay=${paddingStart}|${paddingStart}`);
                }
                
                // Add padding at end if specified
                if (paddingEnd > 0) {
                    const paddingSec = paddingEnd / 1000;
                    filters.push(`apad=pad_dur=${paddingSec}`);
                }

                const filterChain = filters.join(',');

                let bitrateKbps;
                
                // If bitrate is null, auto-detect from input file
                if (this.bitrate === null) {
                    let audioInfo = null;
                    try {
                        audioInfo = await this.getAudioInfo(inputFile);
                    } catch (err) {
                        console.warn('Could not get audio info for trim, using 128k default:', err.message);
                    }
                    bitrateKbps = audioInfo ? Math.floor(audioInfo.bitrate / 1000) + 'k' : '128k';
                } else {
                    // Use configured default bitrate
                    bitrateKbps = Math.floor(this.bitrate / 1000) + 'k';
                }

                const command = ffmpeg()
                    .input(inputFile)
                    .audioFilters(filterChain)
                    .audioCodec('libmp3lame')
                    .audioBitrate(bitrateKbps)
                    .format('mp3')
                    .output(outputFile);

                command
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            } catch (err) {
                reject(err);
            }
        });
    }

    getFilterChain(filterName, options) {
        switch (filterName) {
            case 'normalize':
                // Normalize audio using loudnorm filter (EBU R128)
                // i: integrated loudness target in LUFS (default: -16)
                // lra: loudness range target in LU (default: 11)
                // tp: true peak in dBTP (configurable, typically -3dB or -0.1dB)
                const i = options.i !== undefined ? options.i : -16;  // Target loudness
                const lra = options.lra !== undefined ? options.lra : 11;  // Loudness range
                const tp = options.tp !== undefined ? options.tp : -3;  // True peak
                return `loudnorm=I=${i}:LRA=${lra}:TP=${tp}`;

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