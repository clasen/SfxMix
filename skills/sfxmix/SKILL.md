---
name: sfxmix-audio-processing
description: Guidance for working on the SfxMix audio processing library. Use when modifying SfxMix APIs, FFmpeg processing steps, demo audio scripts, chunk splitting, silence detection, or README examples for this project.
---

# SfxMix Audio Processing

## Instructions

### Preserve Audio Quality

Keep intermediate processing lossless. Pipeline steps should write temporary audio as WAV PCM unless the user is explicitly exporting to a compressed final format such as MP3 or OGG.

Compression belongs at the final `save()` boundary. Do not add MP3 encoding inside actions such as concat, mix, silence generation, filters, trim, or chunk splitting.

### Match the Fluent API

Public methods should be chainable and return `this`. Add work to `this.actions`, then implement the actual processing in `_processActions()`.

Use domain names that describe the audio behavior. For silence-detected sound segments, use `chunk` terminology:

```js
sfx
    .add('input.wav')
    .split({ chunk: 1 })
    .save('second_chunk.wav');
```

### `split()` Defaults

The default chunk splitting options are:

```js
{
    chunk: 0,
    threshold: -35,
    silenceDuration: 0.03,
    paddingStart: 0,
    paddingEnd: 30,
    minDuration: 0.01
}
```

`chunk` is zero-based. `chunk: 0` keeps the first detected non-silent segment; `chunk: 1` keeps the second.

## Function Reference

Use `README.md` as the user-facing source for API examples and docs. When changing a public method or filter, keep this reference, `README.md`, and `index.js` aligned.

### Public API

- `constructor(config = {})`: Initializes an action queue, current file state, output bitrate, and a unique temp directory. `config.bitrate` defaults to `64000`; use `null` to let FFmpeg choose. `config.tmpDir` overrides the OS temp base.
- `add(input)`: Queues an audio file for concatenation. Returns `this`.
- `mix(input, options = {})`: Queues a mix against the current audio. If called first, it behaves like `add(input)`. `options.duration` supports `'longest'`, `'shortest'`, or `'first'`; default is `'longest'`. Returns `this`.
- `silence(milliseconds)`: Queues generated silence in milliseconds. Returns `this`.
- `filter(filterName, options = {})`: Queues a named FFmpeg audio filter. Returns `this`.
- `trim(options = {})`: Queues leading/trailing silence trimming while preserving internal silence. Defaults: `startDuration: 0`, `startThreshold: -30`, `stopDuration: 0.05`, `stopThreshold: -30`, `paddingStart: 0`, `paddingEnd: 0`. Returns `this`.
- `split(options = {})`: Queues extraction of one silence-detected non-silent chunk. Defaults are listed above. Returns `this`.
- `normalize(tp = -1.5)`: Convenience wrapper for `filter('normalize', { tp })`. Returns `this`.
- `save(output, outputOptions = {})`: Processes queued actions, writes the final output, resets the instance, and resolves with the absolute output path. Custom `outputOptions` are passed to `convertAudio()`.
- `isTruncated(options = {})`: Terminal analysis operation. Processes queued actions, checks whether the audio tail is above `options.threshold`, resets the instance, and resolves `{ truncated, tailRmsDb, tailPeakDb, duration, threshold, tailDuration }`. Defaults: `tailDuration: 50`, `threshold: -30`.
- `reset()`: Clears queued actions and current file state. Returns `this`.

### Conversion Helpers

- `convertAudio(inputFile, outputFile, outputOptions = {})`: Converts audio to the requested output path. Without custom options, chooses codec/format from the extension: OGG/Opus, WAV/PCM, FLAC, AAC/M4A, or MP3/libmp3lame.
- `convertToOgg(inputFile, outputFile, options = {})`: Backward-compatible alias for `convertAudio()`.

### Supported Filters

- `normalize`: EBU R128 loudness normalization. Options: `i`, `lra`, `tp`.
- `telephone`: High-pass plus low-pass telephone effect. Options: `lowFreq`, `highFreq`.
- `echo`: FFmpeg `aecho`. Options: `inGain`, `outGain`, `delays`, `decays`.
- `highpass`: Requires `frequency`.
- `lowpass`: Requires `frequency`.
- `volume`: Requires `volume`.
- `equalizer`: Requires `frequency`, `width`, and `gain`.
- `flanger`: Options: `delay`, `depth`, `regen`, `width`, `speed`, `shape`, `phase`, `interp`.
- `pitch`: Requires `pitch` in semitones.
- `tremolo`: Options: `frequency`.
- `phaser`: Options: `in_gain`, `out_gain`, `delay`, `decay`, `speed`, `type`.
- `tempo`: Requires `x`. Values outside FFmpeg's single-filter `0.5` to `2.0` range are split into chained `atempo` filters.

### Internal Processing Helpers

- `getTempFile(prefix, extension = 'wav')`: Builds unique temp file paths inside the instance temp directory.
- `applyIntermediateOutput(command, outputFile)`: Forces intermediate FFmpeg output to WAV PCM.
- `cleanup()`: Removes the instance temp directory.
- `_processActions()`: Runs queued `add`, `mix`, `silence`, `filter`, `trim`, and `split` actions in order.
- `safeDeleteFile(filePath, maxRetries = 3)`: Deletes temp files with retry backoff.
- `isTempFile(filename)`: Checks whether a path belongs to the instance temp directory.
- `concatenateAudioFiles(inputFiles, outputFile)`: Concatenates files with FFmpeg's `concat` filter.
- `mixAudioFiles(inputFile1, inputFile2, outputFile, options = {})`: Mixes two inputs with FFmpeg's `amix`.
- `_analyzeTail(filePath, options = {})`: Reads the tail as PCM samples and computes RMS/peak dB metrics.
- `getAudioInfo(inputFile)`: Reads channel count, sample rate, and bitrate through `ffprobe`.
- `generateSilence(durationMs, outputFile, audioInfo = null)`: Generates PCM silence matching provided audio metadata when available.
- `applyFilter(inputFile, filterName, options, outputFile)`: Resolves a filter chain and writes a filtered intermediate WAV.
- `applyTrim(inputFile, options, outputFile)`: Applies leading/trailing silence removal.
- `applySplit(inputFile, options, outputFile)`: Detects silence boundaries and extracts the requested chunk.
- `getAudioDuration(inputFile)`: Reads duration through `ffprobe`.
- `parseSilenceEvent(line)`: Parses FFmpeg `silencedetect` stderr lines.
- `detectSilence(inputFile, options = {})`: Runs `silencedetect` and returns ordered silence events.
- `getNonSilentSegments(silenceEvents, duration, minDuration = 0.01)`: Converts silence events into non-silent segments.
- `getFilterChain(filterName, options)`: Maps supported filter names and options to FFmpeg filter strings.
