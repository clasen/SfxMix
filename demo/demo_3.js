import SfxMix from '../index.js';
const sfx = new SfxMix();

// Complex audio processing example
// This demonstrates adding files, inserting silence, mixing, and applying filters

try {
    await sfx.add('part1.mp3')
        .silence(2000) // Add 2 seconds of silence
        .add('part2.mp3')
        .mix('glitches.mp3', { duration: 'first' }) // Mix with glitches.mp3 for the duration of the first audio
        .filter('telephone') // Apply telephone effect
        .filter('normalize') // Normalize audio levels
        .save('demo3_complex.mp3');
    
    console.log('Successfully exported: demo3_complex.mp3');
} catch (error) {
    console.error('Error exporting demo3_complex.mp3:', error);
}
