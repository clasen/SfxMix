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

const processor = new SfxMix();

processor
  .add('intro.mp3')
  .silence(2000) // 2 seconds of silence
  .add('main.mp3')
  .filter('normalize', { i: -14, tp: -2.0, lra: 7.0 })
  .mix('background.mp3', { duration: 'first' })
  .save('final_output.mp3')
  .then(() => {
    console.log('Audio processing completed successfully! 🎉');
  })
  .catch((err) => {
    console.error('Error during audio processing:', err);
  });
```
---

## 🔧 Examples

### 1. Concatenate and Mix with Background Music

```javascript
processor
  .add('intro.mp3')
  .add('chapter1.mp3')
  .add('chapter2.mp3')
  .mix('background_music.mp3', { duration: 'first' })
  .save('audiobook_with_music.mp3');
```

### 2. Apply Multiple Filters

```javascript
processor
  .add('voiceover.mp3')
  .filter('normalize', { i: -14 })
  .filter('equalizer', { frequency: 3000, width: 1000, gain: 5 })
  .save('processed_voiceover.mp3');
```

### 3. Insert Silence Between Tracks

```javascript
processor
  .add('track1.mp3')
  .silence(2000)
  .add('track2.mp3')
  .silence(2000)
  .add('track3.mp3')
  .save('album_with_silence.mp3');
```

### 4. Apply Telephone Effect

```javascript
processor
  .add('dialogue.mp3')
  .filter('telephone')
  .save('telephone_effect.mp3');
```

### 5. Adjust Volume and Add Echo

```javascript
processor
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

Adds an audio file to the processor for concatenation.

- **Parameters:**
  - `input` (string): Path to the audio file.
- **Returns:** `SfxMix` (for chaining)

**Example:**

```javascript
processor.add('part1.mp3').add('part2.mp3');
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
processor.mix('sound_effect.wav', { duration: 'first' });
```

---

### `silence(duration)`

Inserts silence into the audio sequence.

- **Parameters:**
  - `duration` (number): Duration of silence in milliseconds.
- **Returns:** `SfxMix` (for chaining)

**Example:**

```javascript
processor.silence(3000); // Inserts 3 seconds of silence
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

---

### `save(output)`

Processes the audio according to the specified actions and saves the result.

- **Parameters:**
  - `output` (string): Path to the output audio file.
- **Returns:** `Promise` (resolves when processing is complete)

**Example:**

```javascript
processor.save('output.mp3');
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
processor.filter('normalize', { i: -14, tp: -2.0, lra: 7.0 });
```

---

### Filter: `telephone`

Applies a telephone effect by applying high-pass and low-pass filters.

- **Options:**
  - `lowFreq` (number): High-pass filter cutoff frequency in Hz (default: `300`).
  - `highFreq` (number): Low-pass filter cutoff frequency in Hz (default: `3400`).

**Example:**

```javascript
processor.filter('telephone', { lowFreq: 400, highFreq: 3000 });
```

---

### Filter: `echo`

Adds an echo effect to the audio.

- **Options:**
  - `delay` (number): Echo delay in milliseconds (default: `500`).
  - `decay` (number): Echo decay factor between `0` and `1` (default: `0.5`).

**Example:**

```javascript
processor.filter('echo', { delay: 1000, decay: 0.6 });
```

---

### Filter: `reverb`

Applies a reverb effect to the audio.

- **Options:** None

**Example:**

```javascript
processor.filter('reverb');
```

---

### Filter: `highpass`

Applies a high-pass filter to remove frequencies below the cutoff.

- **Options:**
  - `frequency` (number): Cutoff frequency in Hz.

**Example:**

```javascript
processor.filter('highpass', { frequency: 1000 });
```

---

### Filter: `lowpass`

Applies a low-pass filter to remove frequencies above the cutoff.

- **Options:**
  - `frequency` (number): Cutoff frequency in Hz.

**Example:**

```javascript
processor.filter('lowpass', { frequency: 2000 });
```

---

### Filter: `volume`

Adjusts the audio volume.

- **Options:**
  - `volume` (number): Volume multiplier (e.g., `0.5` for 50%).

**Example:**

```javascript
processor.filter('volume', { volume: 0.8 });
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
processor.filter('equalizer', { frequency: 1000, width: 200, gain: -10 });
```

---

## ⚠️ Important Notes

- **FFmpeg Installation:** Ensure FFmpeg is installed and accessible in your system's PATH.
- **File Permissions:** The module creates and deletes temporary files during processing. Ensure the application has the necessary permissions.
- **Audio Formats:** The module assumes input files are in MP3 format. For other formats, adjust codec and format settings accordingly.
- **Error Handling:** Always handle rejections from the `save()` method to catch any processing errors.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙌 Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue on GitHub.

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

Enjoy processing your audio with **SfxMix**! 🎶✨