import { spawnSync } from 'node:child_process'
import { openAsBlob, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const repo = 'NadalMB/Hanabi-Survivors'
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
const noBuild = process.argv.includes('--no-build')

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

const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
const pushed = spawnSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: root, stdio: 'inherit' })
if (pushed.status !== 0) process.exit(pushed.status ?? 1)

spawnSync('taskkill', ['/F', '/IM', 'Hanabi Survivors.exe', '/T'], { cwd: root, stdio: 'ignore', shell: true })

if (!noBuild) {
  const dist = spawnSync('npm', ['run', 'dist'], { cwd: root, stdio: 'inherit', shell: true })
  if (dist.status !== 0) process.exit(dist.status ?? 1)
}

const token = githubToken()
if (!token) {
  console.error('No hay acceso a GitHub. Los ejecutables están en release/.')
  process.exit(1)
}

const files = [
  ['HanabiSurvivors-Portable.exe', `HanabiSurvivors-Portable-${version}.exe`],
  ['HanabiSurvivors-Setup.exe', `HanabiSurvivors-Setup-${version}.exe`]
]

let release
try {
  release = await github(token, `https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: `v${version}`,
      name: `Hanabi Survivors ${version}`,
      target_commitish: sha,
      body: `Portable e instalador de Windows ${version}.`
    })
  })
} catch (err) {
  if (!String(err.message).includes('already_exists')) throw err
  release = await github(token, `https://api.github.com/repos/${repo}/releases/tags/v${version}`)
}

for (const [localName, assetName] of files) {
  if ((release.assets ?? []).some((asset) => asset.name === assetName)) continue
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(assetName)}`)
  const asset = await github(token, uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: await openAsBlob(resolve(root, 'release', localName)),
    duplex: 'half'
  })
  release.assets = [...(release.assets ?? []), asset]
  console.log(asset.browser_download_url)
}

console.log(release.html_url)
