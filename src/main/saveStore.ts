import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hydrateSave, type SaveData } from '@shared/save'

const savePath = (): string => join(app.getPath('userData'), 'save.json')

/** Older writes are dropped so a slow save cannot overwrite a newer one. */
let lastSaveGen = 0

function claimSave(gen: number): boolean {
  if (gen < lastSaveGen) return false
  lastSaveGen = gen
  return true
}

export function loadSave(): SaveData {
  try {
    const raw = JSON.parse(readFileSync(savePath(), 'utf8')) as Partial<SaveData>
    const save = hydrateSave(raw)
    if (typeof raw.accountXp !== 'number') writeSaveSync(save, 0)
    return save
  } catch {
    return hydrateSave(null)
  }
}

/** Writes to a temp file first so a crash mid-write never corrupts the save. */
export function writeSaveSync(data: SaveData, gen = 0): void {
  if (!claimSave(gen)) return
  const target = savePath()
  const tmp = `${target}.tmp`
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  if (gen < lastSaveGen) return
  renameSync(tmp, target)
}
