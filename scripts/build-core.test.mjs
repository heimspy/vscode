import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('an explicit fork checkout must be a Git repository at the pinned commit', () => {
    const directory = mkdtempSync(join(tmpdir(), 'heimspy-source-'))
    const script = new URL('./build-core.mjs', import.meta.url)
    const run = () =>
        spawnSync(process.execPath, [fileURLToPath(script)], {
            encoding: 'utf8',
            env: { ...process.env, HEIMSPY_SING_BOX_SOURCE: directory }
        })
    try {
        writeFileSync(join(directory, 'keep.txt'), 'local work')
        let result = run()
        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /must be a Git checkout/)
        execFileSync('git', ['init', '--quiet'], { cwd: directory })
        result = run()
        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /must be at [a-f0-9]{40}/)
        assert.equal(readFileSync(join(directory, 'keep.txt'), 'utf8'), 'local work')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
