import SfxMix from '../index.js';
const sfx = new SfxMix();

// Concatenate part1.mp3 and part2.mp3, 
// then mix with glitches.wav for the duration of the concatenated audio
await sfx
    .add('part1.mp3')
    .add('part2.mp3')
    .mix('glitches.mp3', { duration: 'first' })
    .save('demo1_add_add_mix.mp3')
    .then(() => {
        console.log('Successfully exported: demo1_add_add_mix.mp3');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });
