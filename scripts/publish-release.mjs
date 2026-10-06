import { spawnSync } from 'node:child_process'
import { openAsBlob, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const repo = 'NadalMB/Hanabi-Survivors'
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
const noBuild = process.argv.includes('--no-build')
const notesOnly = process.argv.includes('--notes-only')

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

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) return ''
  return (result.stdout ?? '').trim()
}

function isNoiseCommit(subject) {
  return (
    !subject ||
    /^merge\b/i.test(subject) ||
    /^merge (branch|pull request|remote)\b/i.test(subject) ||
    /^cursor:\s*apply local changes/i.test(subject) ||
    /^bump (the )?version\b/i.test(subject)
  )
}

/** Commit subjects from the previous GitHub release tag up to this SHA. */
function commitsSince(previousTag, sha) {
  const range = previousTag ? `${previousTag}..${sha}` : sha
  const log = git(['log', '--pretty=format:%s', range])
  if (!log) return []
  const seen = new Set()
  const out = []
  for (const line of log.split('\n')) {
    const subject = line.trim()
    if (isNoiseCommit(subject) || seen.has(subject)) continue
    seen.add(subject)
    out.push(subject)
  }
  return out
}

function releaseBody(version, changes) {
  const bullets =
    changes.length > 0
      ? changes.map((line) => `- ${line}`).join('\n')
      : '- Ajustes y correcciones menores.'
  return [`### Novedades desde el release anterior`, '', bullets, '', `Portable e instalador de Windows \`${version}\`.`].join('\n')
}

async function previousReleaseTag(token, currentTag) {
  const releases = await github(token, `https://api.github.com/repos/${repo}/releases?per_page=30`)
  if (!Array.isArray(releases)) return ''
  for (const release of releases) {
    if (release.tag_name && release.tag_name !== currentTag) return release.tag_name
  }
  return ''
}

async function ensureReleaseNotes(token, release, version, sha) {
  const previous = await previousReleaseTag(token, `v${version}`)
  const changes = commitsSince(previous, sha)
  const body = releaseBody(version, changes)
  if (release.body === body) return release
  return github(token, `https://api.github.com/repos/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, name: `Hanabi Survivors ${version}` })
  })
}

const sha = git(['rev-parse', 'HEAD'])
if (!notesOnly) {
  const pushed = spawnSync('git', ['push', '-u', 'origin', 'HEAD'], { cwd: root, stdio: 'inherit' })
  if (pushed.status !== 0) process.exit(pushed.status ?? 1)

  spawnSync('taskkill', ['/F', '/IM', 'Hanabi Survivors.exe', '/T'], { cwd: root, stdio: 'ignore', shell: true })

  if (!noBuild) {
    const dist = spawnSync('npm', ['run', 'dist'], { cwd: root, stdio: 'inherit', shell: true })
    if (dist.status !== 0) process.exit(dist.status ?? 1)
  }
}

const token = githubToken()
if (!token) {
  console.error('No hay acceso a GitHub. Los ejecutables están en release/.')
  process.exit(1)
}

if (notesOnly) {
  const releases = await github(token, `https://api.github.com/repos/${repo}/releases?per_page=30`)
  if (!Array.isArray(releases) || releases.length === 0) {
    console.log('No hay releases que actualizar.')
    process.exit(0)
  }
  for (let i = 0; i < releases.length; i++) {
    const release = releases[i]
    const tag = release.tag_name ?? ''
    const ver = tag.replace(/^v/, '')
    const previous = releases[i + 1]?.tag_name ?? ''
    const tip = git(['rev-list', '-n', '1', tag]) || release.target_commitish
    const changes = commitsSince(previous, tip)
    const body = releaseBody(ver, changes)
    await github(token, `https://api.github.com/repos/${repo}/releases/${release.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    })
    console.log(`Actualizado ${tag}`)
    console.log(body)
    console.log('---')
  }
  process.exit(0)
}

const files = [
  ['HanabiSurvivors-Portable.exe', `HanabiSurvivors-Portable-${version}.exe`],
  ['HanabiSurvivors-Setup.exe', `HanabiSurvivors-Setup-${version}.exe`]
]

const previous = await previousReleaseTag(token, `v${version}`)
const changes = commitsSince(previous, sha)
const body = releaseBody(version, changes)

let release
try {
  release = await github(token, `https://api.github.com/repos/${repo}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: `v${version}`,
      name: `Hanabi Survivors ${version}`,
      target_commitish: sha,
      body
    })
  })
} catch (err) {
  if (!String(err.message).includes('already_exists')) throw err
  release = await github(token, `https://api.github.com/repos/${repo}/releases/tags/v${version}`)
  release = await ensureReleaseNotes(token, release, version, sha)
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
