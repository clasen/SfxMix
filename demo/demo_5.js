import SfxMix from '../index.js';
const sfx = new SfxMix();

// Slow down part1.mp3 by 25%
await sfx
    .add('part1.mp3')
    .filter('tempo', { x: 0.75 })
    .save('demo5_part1_slow.mp3')
    .then(() => {
        console.log('Successfully exported: demo5_part1_slow.mp3');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });
