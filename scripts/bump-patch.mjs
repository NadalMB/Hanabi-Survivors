import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkgPath = resolve(root, 'package.json')
const lockPath = resolve(root, 'package-lock.json')

function bump(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)-alpha$/.exec(version)
  if (!match) throw new Error(`Versión no válida: ${version}`)
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}-alpha`
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const next = bump(pkg.version)
pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

let seen = 0
const lock = readFileSync(lockPath, 'utf8').replace(/"version": "\d+\.\d+\.\d+-alpha"/g, (match) => {
  seen += 1
  return seen <= 2 ? `"version": "${next}"` : match
})
writeFileSync(lockPath, lock)
console.log(`Versión ${next}`)
