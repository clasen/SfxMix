import SfxMix from '../index.js';
const sfx = new SfxMix();

// Complex audio processing example
// This demonstrates mixing multiple files, adding another file, and normalizing the audio

try {
    await sfx
        .mix('part1.mp3')
        .mix('part2.mp3')
        .add('part2.mp3')
        // Normalize the audio to -3 dB
        .filter('normalize', { tp: -3 })
        .save('demo4_mix_mix_add_normalized.mp3');

    console.log('Successfully exported: demo4_mix_mix_add_normalized.mp3');
} catch (error) {
    console.error('Error exporting demo4_mix_mix_add_normalized.mp3:', error);
}
