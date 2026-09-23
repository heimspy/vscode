#!/usr/bin/env node
// Build the pinned sing-box fork for one or more targets.
//   node scripts/build-core.mjs                 # host platform/arch
//   node scripts/build-core.mjs --target linux-x64 --target win32-arm64
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PIN = JSON.parse(readFileSync(join(ROOT, 'sing-box.lock.json'), 'utf8'))
const SOURCE = resolve(
    process.env.HEIMSPY_SING_BOX_SOURCE || join(ROOT, '.build', 'sing-box', PIN.revision)
)
const GO = process.env.HEIMSPY_GO || 'go'
const GOOS = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
const GOARCH = { x64: 'amd64', arm64: 'arm64' }

const { values } = parseArgs({
    options: {
        target: { type: 'string', multiple: true },
        output: { type: 'string' }
    }
})
const targets = values.target?.length ? values.target : [`${process.platform}-${process.arch}`]
const run = (command, args, options = {}) =>
    execFileSync(command, args, { stdio: 'inherit', ...options })
const output = (command, args, options = {}) =>
    execFileSync(command, args, {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        ...options
    }).trim()
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
function checkout() {
    if (!/^[a-f0-9]{40}$/.test(PIN.revision))
        throw new Error('sing-box.lock.json requires a full commit SHA')
    if (!existsSync(join(SOURCE, '.git'))) {
        if (process.env.HEIMSPY_SING_BOX_SOURCE)
            throw new Error('HEIMSPY_SING_BOX_SOURCE must be a Git checkout')
        mkdirSync(SOURCE, { recursive: true })
        run('git', ['init'], { cwd: SOURCE })
        run('git', ['remote', 'add', 'origin', PIN.repository], { cwd: SOURCE })
    }
    let head = ''
    try {
        head = output('git', ['rev-parse', 'HEAD'], {
            cwd: SOURCE,
            stdio: ['ignore', 'pipe', 'ignore']
        })
    } catch {
        /* Fetch the pinned revision for a new or interrupted cache checkout. */
    }
    if (head !== PIN.revision) {
        if (process.env.HEIMSPY_SING_BOX_SOURCE)
            throw new Error(`Fork checkout must be at ${PIN.revision}`)
        run('git', ['fetch', '--depth', '1', 'origin', PIN.revision], { cwd: SOURCE })
        run('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: SOURCE })
    }
    if (output('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: SOURCE })) {
        throw new Error(
            `Fork checkout is dirty: ${SOURCE}. Commit or preserve changes before building.`
        )
    }
}

function environment(platform, arch) {
    return {
        ...process.env,
        GOTOOLCHAIN: PIN.toolchain + '+auto',
        GOWORK: 'off',
        GOENV: 'off',
        GOFLAGS: '',
        GOOS: GOOS[platform],
        GOARCH: GOARCH[arch],
        CGO_ENABLED: '0'
    }
}

function notices(env, tags) {
    const compiled = output(
        GO,
        ['list', '-mod=readonly', '-tags=' + tags, '-deps', '-json', './cmd/sing-box'],
        {
            cwd: SOURCE,
            env
        }
    )
        .split(/^}$/m)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => JSON.parse(chunk + '}'))
    const modules = {}
    const seen = new Map()
    for (const entry of compiled) {
        const module = entry.Module
        if (!module) continue
        modules[module.Path] = module.Version || 'local'
        const dir = resolve((module.Replace || module).Dir)
        for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'NOTICE'])
            if (existsSync(join(dir, name)) && !seen.has(module.Path + '/' + name))
                seen.set(module.Path + '/' + name, readFileSync(join(dir, name), 'utf8'))
    }
    const text = [...seen.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, body]) => `${'='.repeat(78)}\n${name}\n${'='.repeat(78)}\n\n${body.trim()}\n`)
        .join('\n')
    return { modules, text }
}

checkout()
const tags = readFileSync(join(SOURCE, 'release/DEFAULT_BUILD_TAGS_OTHERS'), 'utf8').trim()
const ldflags = readFileSync(join(SOURCE, 'release/LDFLAGS'), 'utf8').trim()
for (const target of targets) {
    const [platform, arch] = target.split('-')
    if (!GOOS[platform] || !GOARCH[arch]) throw new Error(`Unsupported target ${target}`)
    const env = environment(platform, arch)
    const directory = join(resolve(values.output || join(ROOT, 'core')), target)
    rmSync(directory, { recursive: true, force: true })
    mkdirSync(directory, { recursive: true })
    const binary = join(directory, platform === 'win32' ? 'sing-box.exe' : 'sing-box')
    console.log(`Building sing-box ${PIN.version} for ${target}`)
    run(
        GO,
        [
            'build',
            '-mod=readonly',
            '-tags=' + tags,
            '-trimpath',
            '-buildvcs=false',
            '-ldflags=' +
                ldflags +
                ' -s -w -buildid= -X github.com/sagernet/sing-box/constant.Version=' +
                PIN.version,
            '-o',
            binary,
            './cmd/sing-box'
        ],
        { cwd: SOURCE, env }
    )
    const { modules, text } = notices(env, tags)
    writeFileSync(join(directory, 'sing-box.licenses.txt'), text)
    writeFileSync(
        binary + '.build.json',
        JSON.stringify(
            {
                version: PIN.version,
                revision: PIN.revision,
                toolchain: output(GO, ['version'], { env }),
                target,
                tags: tags.split(','),
                repository: PIN.repository,
                upstreamRevision: PIN.upstreamRevision,
                modules,
                sha256: sha256(binary)
            },
            null,
            2
        ) + '\n'
    )
    copyFileSync(join(SOURCE, 'LICENSE'), join(directory, 'LICENSE'))
    console.log(`Wrote ${binary}`)
}
