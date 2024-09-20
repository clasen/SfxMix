import SfxMix from '../index.js';
const sfx = new SfxMix();

// Slow down part1.mp3 by 25%
await sfx
    .add('part1.mp3')
    .filter('echo', { delays: [1000, 2000, 3000, 4000], decays: [0.5, 0.5, 0.5, 0.5] })
    .save('demo7_part1_echo.mp3')
    .then(() => {
        console.log('Successfully exported: demo7_part1_echo.mp3');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });
