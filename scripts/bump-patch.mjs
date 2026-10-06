import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkgPath = resolve(root, 'package.json')
const lockPath = resolve(root, 'package-lock.json')

function bump(version) {
  const parts = version.split('.').map((n) => Number(n))
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Versión no válida: ${version}`)
  }
  parts[2] += 1
  return parts.join('.')
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const next = bump(pkg.version)
pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

let seen = 0
const lock = readFileSync(lockPath, 'utf8').replace(/"version": "\d+\.\d+\.\d+"/g, (match) => {
  seen += 1
  return seen <= 2 ? `"version": "${next}"` : match
})
writeFileSync(lockPath, lock)
console.log(`Versión ${next}`)
