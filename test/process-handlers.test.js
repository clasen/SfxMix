const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const SfxMix = require('../index');

const INDEX = path.join(__dirname, '..', 'index.js');

// Runs `body` in a child process that creates an instance, prints its temp dir,
// then waits to receive `signal`.
function runChildAndSignal(body, signal) {
    return new Promise((resolve, reject) => {
        const script = `
            const SfxMix = require(${JSON.stringify(INDEX)});
            const mix = new SfxMix();
            ${body}
            console.log('READY ' + mix.TMP_DIR);
            setInterval(() => {}, 1000);
        `;
        const child = spawn(process.execPath, ['-e', script]);
        let stdout = '';
        let signalled = false;
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
            if (!signalled && stdout.includes('READY ')) {
                signalled = true;
                child.kill(signal);
            }
        });
        child.on('error', reject);
        child.on('exit', (code, exitSignal) => {
            const tmpDir = stdout.match(/READY (\S+)/)[1];
            resolve({ code, exitSignal, stdout, tmpDir });
        });
    });
}

test('instances share one set of process listeners', () => {
    const before = {
        exit: process.listenerCount('exit'),
        SIGINT: process.listenerCount('SIGINT'),
        SIGTERM: process.listenerCount('SIGTERM')
    };
    const mixes = Array.from({ length: 20 }, () => new SfxMix());
    try {
        for (const event of ['exit', 'SIGINT', 'SIGTERM']) {
            assert.ok(process.listenerCount(event) <= Math.max(before[event], 1));
        }
    } finally {
        mixes.forEach((mix) => mix.cleanup());
    }
});

test('cleanup removes the instance temp directory', () => {
    const mix = new SfxMix();
    assert.ok(fs.existsSync(mix.TMP_DIR));
    mix.cleanup();
    assert.ok(!fs.existsSync(mix.TMP_DIR));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`${signal} without app handlers removes temp dirs and terminates by signal`, async () => {
        const { exitSignal, tmpDir } = await runChildAndSignal('', signal);
        assert.equal(exitSignal, signal);
        assert.ok(!fs.existsSync(tmpDir));
    });

    test(`${signal} with an app handler leaves shutdown to the app`, async () => {
        const appHandler = `
            process.on(${JSON.stringify(signal)}, () => {
                setTimeout(() => {
                    console.log('APP_SHUTDOWN dirExists=' + require('fs').existsSync(mix.TMP_DIR));
                    process.exit(7);
                }, 50);
            });
        `;
        const { code, stdout, tmpDir } = await runChildAndSignal(appHandler, signal);
        assert.equal(code, 7);
        assert.match(stdout, /APP_SHUTDOWN dirExists=true/);
        assert.ok(!fs.existsSync(tmpDir));
    });
}
