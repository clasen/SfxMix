import SfxMix from '../index.js';

// Example 1: Trim silence without padding
console.log('Example 1: Trimming without padding...');
const sfx1 = new SfxMix();
await sfx1
    .add('part1.mp3')
    .trim()
    .save('part1_trimmed.mp3')
    .then(() => {
        console.log('✓ Successfully exported: vo_intro_text_3_trimmed.mp3');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });

// Example 2: Trim silence with padding (200ms at start, 300ms at end)
console.log('\nExample 2: Trimming with padding...');
const sfx2 = new SfxMix();
await sfx2
    .add('part1.mp3')
    .trim({ 
        paddingStart: 100,  // 100ms of silence at the start
        paddingEnd: 100     // 100ms of silence at the end
    })
    .save('part1_trimmed_padded.mp3')
    .then(() => {
        console.log('✓ Successfully exported: vo_intro_text_3_trimmed_padded.mp3');
    })
    .catch((error) => {
        console.error('Error during audio processing:', error);
    });

