import SfxMix from '../index.js';
const sfx = new SfxMix();

// Mix part1.mp3 with part2.mp3 and save the result
try {
    await sfx
        .add('part1.mp3')
        .mix('part2.mp3')
        .save('demo2_add_mix.mp3');

    console.log('Successfully exported: demo2_add_mix.mp3');
} catch (error) {
    console.error('Error exporting demo2_add_mix.mp3:', error);
}
