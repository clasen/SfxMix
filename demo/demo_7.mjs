import SfxMix from '../index.js';
const sfx = new SfxMix();


// Trim silence from beginning and end of to_trim.mp3
await sfx
    .add('to_trim.mp3')
    .trim()
    .save('trimmed_audio.ogg')
    .then(() => {
        console.log('Successfully exported: trimmed_audio.ogg');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });
