# 🎧 SfxMix

**SfxMix** is a powerful and easy-to-use module for processing audio files using FFmpeg. It provides a fluent interface to concatenate, mix, insert silence, apply filters, and more! ✨

---

## 🚀 Features

- **Concatenate** multiple audio files seamlessly.
- **Mix** audio tracks with adjustable durations.
- **Insert silence** at any point in your audio sequence.
- **Apply filters** like echo, reverb, normalize, and more.
- **Parameterizable filters** for fine-grained control.
- **Fluent interface** for chaining multiple operations.

---

## 📦 Installation

Before installing **SfxMix**, ensure that **FFmpeg** is installed and accessible in your system's PATH.

### Install FFmpeg

- **macOS:** Install via Homebrew
  ```bash
  brew install ffmpeg
  ```
- **Windows:** Download from [FFmpeg official website](https://ffmpeg.org/download.html).
- **Linux:** Install via package manager
  ```bash
  sudo apt-get install ffmpeg
  ```

### Install SfxMix

```bash
npm install sfxmix
```

---

## 📝 Usage

```javascript
const SfxMix = require('sfxmix');

const sfx = new SfxMix();

sfx
    .add('intro.mp3')
    .silence(2000) // 2 seconds of silence
    .add('main.mp3')
    .filter('normalize', { i: -14, tp: -2.0, lra: 7.0 })
    .mix('background.mp3', { duration: 'first' })
    .save('final_output.mp3')
    .then(() => {
        console.log('Audio exported to final_output.mp3 🎉');
    })
    .catch((err) => {
        console.error('Error during audio processing:', err);
    });
```
---

## 🔧 Examples

### 1. Concatenate and Mix with Background Music

```javascript
sfx
    .add('intro.mp3')
    .add('chapter1.mp3')
    .add('chapter2.mp3')
    .mix('background_music.mp3', { duration: 'first' })
    .save('audiobook_with_music.mp3');
```

### 2. Apply Multiple Filters

```javascript
sfx
    .add('voiceover.mp3')
    .filter('normalize', { i: -14 })
    .filter('equalizer', { frequency: 3000, width: 1000, gain: 5 })
    .save('processed_voiceover.mp3');
```

### 3. Insert Silence Between Tracks

```javascript
sfx
    .add('track1.mp3')
    .silence(2000)
    .add('track2.mp3')
    .silence(2000)
    .add('track3.mp3')
    .save('album_with_silence.mp3');
```

### 4. Apply Telephone Effect

```javascript
sfx
    .add('dialogue.mp3')
    .filter('telephone')
    .save('telephone_effect.mp3');
```

### 5. Adjust Volume and Add Echo

```javascript
sfx
    .add('announcement.mp3')
    .filter('volume', { volume: 1.5 })
    .filter('echo', { delay: 750, decay: 0.7 })
    .save('enhanced_announcement.mp3');
```

---

## 📖 API Documentation

### Class: `SfxMix`

#### Methods

- [`add(input)`](#addinput)
- [`mix(input, options)`](#mixinput-options)
- [`silence(duration)`](#silenceduration)
- [`filter(filterName, options)`](#filterfiltername-options)
- [`save(output)`](#saveoutput)

---

### `add(input)`

Adds an audio file to the sfx for concatenation.

- **Parameters:**
  - `input` (string): Path to the audio file.
- **Returns:** `SfxMix` (for chaining)

**Example:**

```javascript
sfx.add('part1.mp3').add('part2.mp3');
```

---

### `mix(input, options)`

Mixes an audio file with the current audio.

- **Parameters:**
  - `input` (string): Path to the audio file to mix.
  - `options` (object): (Optional) Mixing options.
    - `duration` (string): Determines the duration of the output. Can be `'longest'`, `'shortest'`, or `'first'`. Default is `'longest'`.
- **Returns:** `SfxMix` (for chaining)

**Example:**

```javascript
sfx.mix('sound_effect.wav', { duration: 'first' });
```

---

### `silence(duration)`

Inserts silence into the audio sequence.

- **Parameters:**
  - `duration` (number): Duration of silence in milliseconds.
- **Returns:** `SfxMix` (for chaining)

**Example:**

```javascript
sfx.silence(3000); // Inserts 3 seconds of silence
```

---

### `filter(filterName, options)`

Applies an audio filter to the current audio.

- **Parameters:**
  - `filterName` (string): Name of the filter to apply.
  - `options` (object): (Optional) Filter-specific options.
- **Returns:** `SfxMix` (for chaining)

**Supported Filters:**

- [`normalize`](#filternormalize)
- [`telephone`](#filtertelephone)
- [`echo`](#filterecho)
- [`reverb`](#filterreverb)
- [`highpass`](#filterhighpass)
- [`lowpass`](#filterlowpass)
- [`volume`](#filtervolume)
- [`equalizer`](#filterequalizer)
- [`compressor`](#filtercompressor)
- [`flanger`](#filterflanger)
- [`pitch`](#filterpitch)
- [`tremolo`](#filtertremolo)
- [`phaser`](#filterphaser)

---

### `save(output)`

Processes the audio according to the specified actions and saves the result.

- **Parameters:**
  - `output` (string): Path to the output audio file.
- **Returns:** `Promise` (resolves when processing is complete)

**Example:**

```javascript
sfx.save('output.mp3');
```

---

## 🎛️ Filters

### Filter: `normalize`

Normalizes audio loudness to a specified target using the EBU R128 standard.

- **Options:**
  - `tp` (number): Maximum true peak level in dBTP (default: `-1.5`).
  - `i` (number): Target integrated loudness in LUFS (default: `-16`).
  - `lra` (number): Loudness range in LU (default: `11`).

**Example:**

```javascript
sfx.filter('normalize', { i: -14, tp: -2.0, lra: 7.0 });
```

---

### Filter: `telephone`

Applies a telephone effect by applying high-pass and low-pass filters.

- **Options:**
  - `lowFreq` (number): High-pass filter cutoff frequency in Hz (default: `300`).
  - `highFreq` (number): Low-pass filter cutoff frequency in Hz (default: `3000`).

**Example:**

```javascript
sfx.filter('telephone', { lowFreq: 400, highFreq: 3000 });
```

---

### Filter: `echo`

Adds an echo effect to the audio.

- **Options:**
  - `delay` (number): Echo delay in milliseconds (default: `500`).
  - `decay` (number): Echo decay factor between `0` and `1` (default: `0.5`).

**Example:**

```javascript
sfx.filter('echo', { delay: 1000, decay: 0.6 });
```

---

### Filter: `reverb`

Applies a reverb effect to the audio.

- **Options:**
  - `room_size` (number): Size of the room (default: `50`).
  - `reverberance` (number): Amount of reverberation (default: `50`).
  - `damping` (number): Damping factor (default: `50`).
  - `hf_damping` (number): High-frequency damping (default: `50`).
  - `stereo_depth` (number): Stereo depth (default: `0`).
  - `pre_delay` (number): Pre-delay time in milliseconds (default: `0`).
  - `wet_gain` (number): Gain of the wet signal (default: `0`).
  - `wet_only` (number): If set to `1`, only the wet signal is output (default: `0`).

**Example:**

```javascript
sfx.filter('reverb');
```

---

### Filter: `highpass`

Applies a high-pass filter to remove frequencies below the cutoff.

- **Options:**
  - `frequency` (number): Cutoff frequency in Hz.

**Example:**

```javascript
sfx.filter('highpass', { frequency: 1000 });
```

---

### Filter: `lowpass`

Applies a low-pass filter to remove frequencies above the cutoff.

- **Options:**
  - `frequency` (number): Cutoff frequency in Hz.

**Example:**

```javascript
sfx.filter('lowpass', { frequency: 2000 });
```

---

### Filter: `volume`

Adjusts the audio volume.

- **Options:**
  - `volume` (number): Volume multiplier (e.g., `0.5` for 50%).

**Example:**

```javascript
sfx.filter('volume', { volume: 0.8 });
```

---

### Filter: `equalizer`

Applies an equalizer effect to adjust specific frequencies.

- **Options:**
  - `frequency` (number): Center frequency in Hz.
  - `width` (number): Bandwidth in Hz.
  - `gain` (number): Gain in dB (positive to boost, negative to reduce).

**Example:**

```javascript
sfx.filter('equalizer', { frequency: 1000, width: 200, gain: -10 });
```

---

### Filter: `compressor`

Applies a dynamic range compressor to the audio.

- **Options:**
  - `threshold` (number): Threshold level in dB (default: `-18`).
  - `ratio` (number): Compression ratio (default: `2`).
  - `attack` (number): Attack time in milliseconds (default: `20`).
  - `release` (number): Release time in milliseconds (default: `250`).

**Example:**

```javascript
sfx.filter('compressor', { threshold: -20, ratio: 4, attack: 15, release: 300 });
```

---

### Filter: `flanger`

Applies a flanger effect to the audio.

- **Options:**
  - `delay` (number): Base delay in milliseconds (default: `0`).
  - `depth` (number): Oscillation depth (default: `2`).
  - `regen` (number): Regeneration (feedback) (default: `0`).
  - `width` (number): Percentage of delayed signal mixed (default: `71`).
  - `speed` (number): Oscillation speed in Hz (default: `0.5`).
  - `shape` (string): Oscillator wave shape (`'sine'` or `'triangular'`) (default: `'sine'`).
  - `phase` (number): Percentage of offset for second delayed signal (default: `25`).
  - `interp` (string): Delay line interpolation (`'linear'` or `'quadratic'`) (default: `'linear'`).

**Example:**

```javascript
sfx.filter('flanger', { delay: 5, depth: 3, speed: 0.8 });
```

---

### Filter: `pitch`

Shifts the pitch of the audio.

- **Options:**
  - `pitch` (number): Pitch shift in semitones (positive or negative).

**Example:**

```javascript
sfx.filter('pitch', { pitch: 2 }); // Shift pitch up by 2 semitones
```

---

### Filter: `tremolo`

Applies a tremolo effect to the audio.

- **Options:**
  - `speed` (number): Modulation frequency in Hz (default: `5`).
  - `depth` (number): Modulation depth (0-1) (default: `0.5`).

**Example:**

```javascript
sfx.filter('tremolo', { speed: 6, depth: 0.7 });
```

---

### Filter: `phaser`

Applies a phaser effect to the audio.

- **Options:**
  - `in_gain` (number): Input gain (default: `0.4`).
  - `out_gain` (number): Output gain (default: `0.74`).
  - `delay` (number): Delay in milliseconds (default: `3`).
  - `decay` (number): Decay (default: `0.4`).
  - `speed` (number): Modulation speed in Hz (default: `0.5`).
  - `type` (number): Modulation type (0-1) (default: `0`).

**Example:**

```javascript
sfx.filter('phaser', { delay: 4, decay: 0.5, speed: 0.8 });
```

---

## ⚠️ Important Notes

- **FFmpeg Installation:** Ensure FFmpeg is installed and accessible in your system's PATH.
- **File Permissions:** The module creates and deletes temporary files during processing. Ensure the application has the necessary permissions.
- **Audio Formats:** The module assumes input files are in MP3 format. For other formats, adjust codec and format settings accordingly.
- **Error Handling:** Always handle rejections from the `save()` method to catch any processing errors.

---

## 💬 Support

If you encounter any issues or have questions, please open an issue on the [GitHub repository](https://github.com/clasen/SfxMix/issues).

---

## 📚 References

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [fluent-ffmpeg GitHub](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
- [EBU R128 Loudness Recommendation](https://tech.ebu.ch/docs/r/r128.pdf)

---

## 🌟 Acknowledgments

- Special thanks to the developers of FFmpeg and fluent-ffmpeg for their invaluable tools.

---

## 🤝 Contributing

Contributions are welcome! If you find any issues or have suggestions for improvement, please open an issue or submit a pull request on the [GitHub repository](https://github.com/clasen/ModelMix).

---

## 📄 License

The MIT License (MIT)

Copyright (c) Martin Clasen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

Enjoy processing your audio with **SfxMix**! 🎶✨