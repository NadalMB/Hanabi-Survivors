import { spawnSync } from 'node:child_process'
import { openAsBlob, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkgPath = resolve(root, 'package.json')
const repo = 'NadalMB/Hanabi-Survivors'
const uploadOnly = process.argv.includes('--upload-only')
const noBuild = process.argv.includes('--no-build')

function readPkg() {
  return JSON.parse(readFileSync(pkgPath, 'utf8'))
}

function writePkg(pkg) {
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)-alpha$/.exec(version)
  if (!match) throw new Error(`Versión no válida: ${version}`)
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}-alpha`
}

function githubToken() {
  const env = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (env) return env
  const filled = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    cwd: root
  })
  if (filled.status !== 0) return ''
  const line = filled.stdout.split('\n').find((row) => row.startsWith('password='))
  return line ? line.slice('password='.length).trim() : ''
}

async function github(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'hanabi-survivors',
      ...(options.headers ?? {})
    }
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) {
    const detail = Array.isArray(body.errors) ? body.errors.map((err) => err.message ?? JSON.stringify(err)).join('; ') : ''
    throw new Error(`GitHub ${response.status}: ${body.message ?? text}${detail ? ` (${detail})` : ''}`)
  }
  return body
}

const pkg = readPkg()
const previous = pkg.version
const version = uploadOnly ? previous : bumpPatch(previous)
if (!uploadOnly) {
  pkg.version = version
  writePkg(pkg)
  console.log(`Versión ${previous} → ${version}`)
}

if (!noBuild) {
  const dist = spawnSync('npm', ['run', 'dist'], { cwd: root, stdio: 'inherit', shell: true })
  if (dist.status !== 0) {
    if (!uploadOnly) {
      pkg.version = previous
      writePkg(pkg)
      console.error('La build falló. La versión vuelve a ' + previous)
    }
    process.exit(dist.status ?? 1)
  }
}

if (!uploadOnly) {
  const commit = spawnSync('git', ['add', 'package.json', 'scripts/publish-portable.mjs', 'src', '.cursor/rules/rebuild-installer.mdc'], { cwd: root, stdio: 'inherit' })
  if (commit.status !== 0) process.exit(commit.status ?? 1)
  const saved = spawnSync('git', ['commit', '--no-verify', '-m', `Release portable ${version}.`], { cwd: root, stdio: 'inherit' })
  if (saved.status !== 0) process.exit(saved.status ?? 1)
  const pushed = spawnSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: root, stdio: 'inherit' })
  if (pushed.status !== 0) process.exit(pushed.status ?? 1)
}

const exeName = 'HanabiSurvivors-Portable.exe'
const exe = resolve(root, 'release', exeName)
const token = githubToken()
if (!token) {
  console.error(`No hay acceso a GitHub. El portable está en release/${exeName}`)
  process.exit(1)
}

const branch = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
let release
try {
  release = await github(token, `https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: `v${version}`,
      name: `Hanabi Survivors ${version}`,
      target_commitish: branch,
      body: `Portable de Windows.\n\nDescarga \`${exeName}\`.`
    })
  })
} catch (err) {
  if (!String(err.message).includes('already_exists')) throw err
  release = await github(token, `https://api.github.com/repos/${repo}/releases/tags/v${version}`)
}
const already = (release.assets ?? []).some((asset) => asset.name === exeName)
if (already) {
  console.log(release.html_url)
  console.log((release.assets ?? []).find((asset) => asset.name === exeName).browser_download_url)
  process.exit(0)
}

const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(exeName)}`)
const asset = await github(token, uploadUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: await openAsBlob(exe),
  duplex: 'half'
})

console.log(release.html_url)
console.log(asset.browser_download_url)
