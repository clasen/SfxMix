import SfxMix from '../index.js';
const sfx = new SfxMix();


// OGG conversion with custom options
await sfx
    .add('part1.mp3')
    .save('output.ogg', {
        'c:a': 'libopus',
        'b:a': '32k',
        'ar': '48000',
        'ac': '1',
        'vbr': 'off',
        'compression_level': '10',
        'frame_duration': '20',
        'application': 'voip'
    })
    .then(() => {
        console.log('Successfully exported: output.ogg');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });
