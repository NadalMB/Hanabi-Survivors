import { Container, Graphics, Sprite, Text, TilingSprite, type Application } from 'pixi.js'
import type { GameEvent, PlayerId } from '@shared/protocol'
import type { CosmeticLoadout } from '@shared/save'
import type { SaveSettings } from '@shared/save'
import type { Sfx } from '@/audio/Sfx'
import { COSMETICS, playerSkinKey, weaponSkinFor, type EffectKind } from '@/game/data/cosmetics'
import { ENEMIES } from '@/game/data/enemies'
import { WEAPONS } from '@/game/data/weapons'
import { PLAYER_RADIUS, UNITS_PER_METER, VIEW_HEIGHT, VIEW_WIDTH } from '@/game/sim/config'
import { EnemyMode } from '@/game/sim/EnemyPool'
import { gemTier } from '@/game/systems/pickups'
import { PickupType } from '@/game/sim/PickupPool'
import { ProjKind, ProjVisual, VISUAL_BASE_RADIUS, visualIndex } from '@/game/sim/ProjectilePool'
import type { World } from '@/game/sim/World'
import { REVIVE_SECONDS } from '@/game/systems/players'
import { AURA_BASE_RADIUS } from '@/game/systems/weapons'
import { Camera } from './Camera'
import { DamageNumbers } from './DamageNumbers'
import { EdgeMarkers } from './EdgeMarkers'
import { Particles } from './Particles'
import { SpritePool } from './SpritePool'
import { PLAYER_ANCHOR_Y, type GameTextures } from './textures'

const PROP_CHUNK = 360
const CULL_MARGIN = 90
const FIREWORK_COLORS = [0xff5fa2, 0x5ff2ff, 0xffd166, 0xb38cff, 0x7dff9a, 0xff8a3b]

function hash2(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Draws a World snapshot with interpolation, and turns GameEvents into juice:
 * particles, floating numbers, shake and sound. Holds no gameplay state.
 */
export class GameRenderer {
  readonly camera: Camera
  /** Enemy types that entered the camera this run, reported once each. */
  private readonly spotted = new Set<number>()
  private readonly pendingSpot: number[] = []
  private readonly root = new Container()
  private readonly ground: TilingSprite
  private readonly worldLayer = new Container()
  private readonly propLayer = new Container()
  private readonly shadowLayer = new Container()
  private readonly auraLayer = new Container()
  private readonly pickupLayer = new Container()
  private readonly enemyLayer = new Container()
  private readonly backOrnamentLayer = new Container()
  private readonly playerLayer = new Container()
  private readonly projectileLayer = new Container()
  private readonly fxLayer = new Container()
  private readonly textLayer = new Container()
  private readonly hpBars = new Graphics()
  private readonly vignette: Sprite
  private readonly flash = new Graphics()

  private readonly props: SpritePool
  private readonly propGlows: SpritePool
  private readonly shadows: SpritePool
  private readonly auras: SpritePool
  private readonly eliteGlows: SpritePool
  private readonly pickups: SpritePool
  private readonly enemies: SpritePool
  private readonly players: SpritePool
  private readonly pets: SpritePool
  private readonly ornaments: SpritePool
  private readonly backOrnaments: SpritePool
  private readonly followers = new Map<number, { x: number; y: number; face: number }>()
  private readonly projectiles: SpritePool
  private readonly particles: Particles
  private readonly numbers: DamageNumbers
  private readonly markers = new EdgeMarkers()
  private readonly nameplates = new Map<PlayerId, Text>()

  private time = 0
  /** 1 is the default framing. The mouse wheel moves this. */
  private userZoom = 1
  private readonly onWheel = (e: WheelEvent): void => {
    if (document.querySelector('.overlay.visible')) return
    e.preventDefault()
    const next = this.userZoom * Math.exp(-e.deltaY * 0.0011)
    this.userZoom = Math.min(1.85, Math.max(0.55, next))
  }
  private flashAlpha = 0
  private vignetteAlpha = 0
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  constructor(
    private readonly app: Application,
    private readonly tex: GameTextures,
    private readonly sfx: Sfx,
    private settings: SaveSettings
  ) {
    this.camera = new Camera(settings.screenShake)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    this.ground = new TilingSprite({ texture: tex.ground, width: 1, height: 1 })
    this.root.addChild(this.ground, this.worldLayer)

    this.auraLayer.blendMode = 'add'
    this.fxLayer.blendMode = 'add'
    this.worldLayer.addChild(
      this.propLayer,
      this.shadowLayer,
      this.auraLayer,
      this.pickupLayer,
      this.enemyLayer,
      this.backOrnamentLayer,
      this.playerLayer,
      this.hpBars,
      this.projectileLayer,
      this.fxLayer,
      this.textLayer
    )

    this.vignette = new Sprite(tex.vignette)
    this.vignette.alpha = 0
    this.root.addChild(this.vignette, this.flash)

    this.props = new SpritePool(this.propLayer, 0.5, 0.85)
    this.propGlows = new SpritePool(this.auraLayer)
    this.shadows = new SpritePool(this.shadowLayer)
    this.auras = new SpritePool(this.auraLayer)
    this.eliteGlows = new SpritePool(this.auraLayer)
    this.pickups = new SpritePool(this.pickupLayer)
    this.enemies = new SpritePool(this.enemyLayer)
    this.players = new SpritePool(this.playerLayer, 0.5, PLAYER_ANCHOR_Y)
    this.pets = new SpritePool(this.playerLayer, 0.5, 0.7)
    this.ornaments = new SpritePool(this.playerLayer, 0.5, 0.5)
    this.backOrnaments = new SpritePool(this.backOrnamentLayer, 0.5, 0.5)
    this.projectiles = new SpritePool(this.projectileLayer)
    this.particles = new Particles(this.fxLayer)
    this.numbers = new DamageNumbers(this.textLayer)

    app.stage.addChild(this.root)
  }

  applySettings(settings: SaveSettings): void {
    this.settings = settings
    this.camera.strength = settings.screenShake
  }

  destroy(): void {
    window.removeEventListener('wheel', this.onWheel)
    this.markers.destroy()
    this.app.stage.removeChild(this.root)
    this.root.destroy({ children: true })
  }

  reset(): void {
    this.particles.clear()
    this.numbers.clear()
    this.camera.reset()
    this.flashAlpha = 0
    this.vignetteAlpha = 0
  }

  screenFlash(alpha: number): void {
    this.flashAlpha = Math.max(this.flashAlpha, alpha)
  }

  // ------------------------------------------------------------------ frame

  render(world: World, alpha: number, dt: number, localId: PlayerId): void {
    this.time += dt
    const sw = this.app.screen.width
    const sh = this.app.screen.height
    const zoom = Math.max(sw / VIEW_WIDTH, sh / VIEW_HEIGHT) * this.userZoom
    const local = world.playerById(localId) ?? world.players[0]
    const camX = local.prevX + (local.x - local.prevX) * alpha
    const camY = local.prevY + (local.y - local.prevY) * alpha

    this.camera.update(dt)
    const ox = sw / 2 - camX * zoom + this.camera.offsetX
    const oy = sh / 2 - camY * zoom + this.camera.offsetY
    this.worldLayer.scale.set(zoom)
    this.worldLayer.position.set(ox, oy)
    this.ground.texture = world.realm > 0 ? this.tex.groundAsh : this.tex.ground
    this.ground.width = sw
    this.ground.height = sh
    this.ground.tileScale.set(zoom)
    this.ground.tilePosition.set(ox, oy)

    const halfW = sw / 2 / zoom + CULL_MARGIN
    const halfH = sh / 2 / zoom + CULL_MARGIN
    this.bounds.minX = camX - halfW
    this.bounds.maxX = camX + halfW
    this.bounds.minY = camY - halfH
    this.bounds.maxY = camY + halfH

    this.shadows.begin()
    this.drawProps()
    this.drawPickups(world, alpha, localId)
    this.drawEnemies(world, alpha, camX)
    this.drawPlayers(world, alpha, localId)
    this.drawCosmetics(world, alpha, dt)
    this.drawProjectiles(world, alpha)
    this.shadows.end()
    this.drawEdgeMarkers(world, alpha, localId, sw, sh, zoom, camX, camY)

    this.particles.update(dt)
    this.numbers.update(dt)

    this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 2.2)
    const lowHp = local.alive && local.hp / local.stats.maxHp < 0.3 ? 0.25 + Math.sin(this.time * 6) * 0.1 : 0
    this.vignette.alpha = Math.max(this.vignetteAlpha, lowHp)
    this.vignette.width = sw
    this.vignette.height = sh

    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3)
    this.flash.clear()
    if (this.flashAlpha > 0) this.flash.rect(0, 0, sw, sh).fill({ color: 0xffffff, alpha: this.flashAlpha })

    this.app.renderer.render(this.app.stage)
  }

  private drawEdgeMarkers(world: World, alpha: number, localId: PlayerId, sw: number, sh: number, zoom: number, camX: number, camY: number): void {
    const canvas = this.app.canvas as HTMLCanvasElement
    const cssW = canvas.clientWidth || sw
    const cssH = canvas.clientHeight || sh
    const kx = cssW / sw
    const ky = cssH / sh
    const screen = (x: number, y: number): { sx: number; sy: number } => ({
      sx: (x - camX) * zoom * kx + cssW / 2 + this.camera.offsetX * kx,
      sy: (y - camY) * zoom * ky + cssH / 2 + this.camera.offsetY * ky
    })
    this.markers.begin()
    if (world.players.length > 1) {
      for (const p of world.players) {
        if (p.id === localId || p.disconnected) continue
        const x = p.prevX + (p.x - p.prevX) * alpha
        const y = p.prevY + (p.y - p.prevY) * alpha
        const { sx, sy } = screen(x, y)
        const meters = Math.hypot(x - camX, y - camY) / UNITS_PER_METER
        this.markers.mark(sx, sy, cssW, cssH, p.alive ? p.name : `${p.name} · caído`, meters, p.character.palette.accent)
      }
    }
    const pk = world.pickups
    for (let i = 0; i < pk.count; i++) {
      if (!pk.alive[i] || pk.type[i] !== PickupType.Chest) continue
      if (pk.owner[i] !== 0 && pk.owner[i] !== localId) continue
      const x = pk.prevX[i] + (pk.x[i] - pk.prevX[i]) * alpha
      const y = pk.prevY[i] + (pk.y[i] - pk.prevY[i]) * alpha
      const { sx, sy } = screen(x, y)
      const meters = Math.hypot(x - camX, y - camY) / UNITS_PER_METER
      this.markers.mark(sx, sy, cssW, cssH, '', meters, '#ffd166', this.tex.chestIcon, 'chest')
    }
    for (let i = 0; i < pk.count; i++) {
      if (!pk.alive[i] || pk.type[i] !== PickupType.Portal) continue
      const x = pk.prevX[i] + (pk.x[i] - pk.prevX[i]) * alpha
      const y = pk.prevY[i] + (pk.y[i] - pk.prevY[i]) * alpha
      const { sx, sy } = screen(x, y)
      const meters = Math.hypot(x - camX, y - camY) / UNITS_PER_METER
      this.markers.mark(sx, sy, cssW, cssH, 'Portal', meters, '#ffd166', '', 'portal')
    }
    const enemies = world.enemies
    for (let i = 0; i < enemies.count; i++) {
      if (!enemies.alive[i] || !ENEMIES[enemies.type[i]]?.boss) continue
      const x = enemies.prevX[i] + (enemies.x[i] - enemies.prevX[i]) * alpha
      const y = enemies.prevY[i] + (enemies.y[i] - enemies.prevY[i]) * alpha
      const { sx, sy } = screen(x, y)
      const meters = Math.hypot(x - camX, y - camY) / UNITS_PER_METER
      const def = ENEMIES[enemies.type[i]]
      const color = `#${def.color.toString(16).padStart(6, '0')}`
      this.markers.mark(sx, sy, cssW, cssH, def.name, meters, color, '', 'boss')
    }
    this.markers.end()
  }

  private visible(x: number, y: number): boolean {
    const b = this.bounds
    return x > b.minX && x < b.maxX && y > b.minY && y < b.maxY
  }

  private shadow(x: number, y: number, width: number): void {
    const s = this.shadows.next(this.tex.shadow)
    s.position.set(x, y)
    s.scale.set(width / 32)
  }

  private drawProps(): void {
    const b = this.bounds
    this.props.begin()
    this.propGlows.begin()
    const cx0 = Math.floor(b.minX / PROP_CHUNK)
    const cx1 = Math.floor(b.maxX / PROP_CHUNK)
    const cy0 = Math.floor(b.minY / PROP_CHUNK)
    const cy1 = Math.floor(b.maxY / PROP_CHUNK)
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const count = Math.floor(hash2(cx, cy, 1) * 4)
        for (let k = 0; k < count; k++) {
          const x = (cx + hash2(cx, cy, 10 + k)) * PROP_CHUNK
          const y = (cy + hash2(cx, cy, 20 + k)) * PROP_CHUNK
          const roll = hash2(cx, cy, 30 + k)
          const type = roll < 0.08 ? 1 : roll < 0.35 ? 0 : roll < 0.7 ? 2 : 3
          const s = this.props.next(this.tex.props[type])
          s.position.set(x, y)
          s.scale.set(hash2(cx, cy, 40 + k) > 0.5 ? 1 : -1, 1)
          if (type === 1) {
            const g = this.propGlows.next(this.tex.glow)
            g.position.set(x, y - 30)
            g.tint = 0xffb347
            g.scale.set(1.6 + Math.sin(this.time * 7 + x) * 0.08)
            g.alpha = 0.55
          }
        }
      }
    }
    this.props.end()
    this.propGlows.end()
  }

  private drawPickups(world: World, alpha: number, localId: PlayerId): void {
    const pk = world.pickups
    const t = this.tex
    this.pickups.begin()
    for (let i = 0; i < pk.count; i++) {
      const x = pk.prevX[i] + (pk.x[i] - pk.prevX[i]) * alpha
      const y = pk.prevY[i] + (pk.y[i] - pk.prevY[i]) * alpha
      if (!this.visible(x, y)) continue
      const type = pk.type[i]
      let texture = t.gems[0]
      let tier = 0
      if (type === PickupType.Gem) {
        tier = gemTier(pk.value[i])
        texture = t.gems[tier] ?? t.gems[0]
      } else if (type === PickupType.Heal) texture = t.heal
      else if (type === PickupType.Gold) texture = t.gold
      else if (type === PickupType.Chest) texture = t.chest
      else if (type === PickupType.Portal) texture = t.portal
      else texture = t.magnet
      const s = this.pickups.next(texture)
      s.alpha = 1
      s.tint = 0xffffff
      const bob = pk.attracted[i] ? 0 : Math.sin(this.time * 4 + i * 0.7) * 2
      s.position.set(x, y + bob)
      const big = type === PickupType.Gem ? 1.02 + tier * 0.04 : 1
      const pulse = type === PickupType.Gold ? 0.86 + Math.abs(Math.sin(this.time * 5 + i)) * 0.14 : big
      s.scale.set(pulse, type === PickupType.Gold ? big : pulse)
      if (type === PickupType.Gem && tier >= 4) s.tint = 0xfff6e0
      if (type === PickupType.Portal) {
        const pulse = 1.7 + Math.sin(this.time * 4) * 0.12
        s.scale.set(pulse)
        s.tint = 0xfff1c2
        this.shadow(x, y + 18, 64)
      }
      if (type === PickupType.Chest) {
        const mine = pk.owner[i] === 0 || pk.owner[i] === localId
        s.tint = mine ? 0xfff1b0 : 0x9ecbff
        s.alpha = mine ? 1 : 0.8
        s.scale.set((mine ? 1.25 : 1.05) + Math.sin(this.time * 6) * 0.06)
        this.shadow(x, y + 12, 34)
      }
    }
    this.pickups.end()
  }

  private drawEnemies(world: World, alpha: number, targetX: number): void {
    const e = world.enemies
    const t = this.tex
    this.enemies.begin()
    this.eliteGlows.begin()
    for (let i = 0; i < e.count; i++) {
      const x = e.prevX[i] + (e.x[i] - e.prevX[i]) * alpha
      const y = e.prevY[i] + (e.y[i] - e.prevY[i]) * alpha
      if (!this.visible(x, y)) continue
      const type = e.type[i]
      if (e.alive[i] && !this.spotted.has(type)) {
        this.spotted.add(type)
        this.pendingSpot.push(type)
      }
      const r = e.radius[i]
      const elite = e.elite[i] === 1
      const s = this.enemies.next(e.flash[i] > 0 ? t.enemiesWhite[type] : t.enemies[type])
      const bob = Math.sin(this.time * 9 + e.id[i] * 1.7)
      const sc = r / ENEMIES[type].radius
      const face = targetX < x ? -1 : 1
      s.scale.set(face * sc * (1 + bob * 0.05), sc * (1 - bob * 0.05))
      s.position.set(x, y)
      s.rotation = 0
      s.alpha = 1
      s.tint = 0xffffff
      if (elite) {
        const g = this.eliteGlows.next(t.glow)
        g.position.set(x, y)
        g.scale.set((r * 3.2) / 64 * (1 + Math.sin(this.time * 6 + e.id[i]) * 0.08))
        g.tint = 0xffc94a
        g.alpha = 0.75
      }
      if (e.mode[i] === EnemyMode.Boss && e.mark[i] > 0 && e.mark[i] < 50) {
        s.tint = 0xff7070
        s.x += Math.sin(this.time * 80) * 2
      }
      this.shadow(x, y + r * 0.85, r * 2.2 * sc)
    }
    this.enemies.end()
    this.eliteGlows.end()
  }

  /** Enemy types that became visible since the previous call. */
  takeSpotted(): number[] {
    if (this.pendingSpot.length === 0) return []
    const out = this.pendingSpot.slice()
    this.pendingSpot.length = 0
    return out
  }

  private nameplate(id: PlayerId, name: string, local: boolean): Text {
    let t = this.nameplates.get(id)
    if (!t) {
      t = new Text({
        text: name,
        style: {
          fontFamily: 'Dela Gothic One, Segoe UI Black, sans-serif',
          fontSize: 22,
          fill: local ? 0xffd166 : 0xffffff,
          stroke: { color: 0x1c0b26, width: 5, join: 'round' }
        },
        resolution: 2
      })
      t.anchor.set(0.5, 1)
      t.scale.set(0.5)
      this.textLayer.addChild(t)
      this.nameplates.set(id, t)
    }
    return t
  }

  private drawPlayers(world: World, alpha: number, localId: PlayerId): void {
    this.players.begin()
    this.auras.begin()
    const bars = this.hpBars
    bars.clear()
    const coop = world.players.length > 1
    for (const p of world.players) {
      const x = p.prevX + (p.x - p.prevX) * alpha
      const y = p.prevY + (p.y - p.prevY) * alpha
      const moving = p.alive && Math.abs(p.moveX) + Math.abs(p.moveY) > 0.1

      if (coop) {
        const label = this.nameplate(p.id, p.name, p.id === localId)
        label.visible = !p.disconnected
        label.position.set(x, y - 34)
        label.alpha = p.alive ? 1 : 0.6
      }
      if (!p.alive && p.reviveProgress > 0) {
        const r = 24
        const start = -Math.PI / 2
        const end = start + (Math.min(1, p.reviveProgress / REVIVE_SECONDS) * Math.PI * 2)
        bars.circle(x, y, r).stroke({ width: 4, color: 0x1c0b26, alpha: 0.7 })
        bars.moveTo(x + Math.cos(start) * r, y + Math.sin(start) * r)
        bars.arc(x, y, r, start, end).stroke({ width: 4, color: 0x7dff9a })
      }
      if (p.disconnected) continue
      const skin = playerSkinKey(p.loadout, p.character.id)
      const s = this.players.next(this.tex.players[skin] ?? this.tex.players[p.character.id])
      const step = moving ? Math.abs(Math.sin(this.time * 12)) : 0
      const breathe = Math.sin(this.time * 3) * 0.02
      s.position.set(x, y - step * 3)
      s.scale.set(p.facing * (1 - breathe + step * 0.04), 1 + breathe - step * 0.04)
      s.rotation = moving ? p.moveX * 0.08 : 0
      s.alpha = !p.alive ? 0.45 : p.iframes > 0 && Math.sin(this.time * 45) > 0 ? 0.45 : 1
      s.tint = !p.alive ? 0x8888aa : p.chill > 0 ? 0xbfefff : 0xffffff
      if (!p.alive) s.rotation = Math.PI / 2 * p.facing
      this.shadow(x, y + PLAYER_RADIUS * 1.1, 30)

      for (const w of p.weapons) {
        const def = WEAPONS[w.id]
        if (def.behavior !== 'aura' || !p.alive) continue
        const radius = AURA_BASE_RADIUS * w.stats.area
        const auraSkin = this.skinTex(p.loadout, 'aura')
        const a = this.auras.next(auraSkin ?? this.tex.aura)
        a.position.set(x, y)
        const pulse = Math.max(0, w.cooldown / w.stats.cooldown)
        const auraScale = (radius * 2) / 128 * (1 + (1 - pulse) * 0.04)
        a.scale.set(auraScale)
        a.tint = auraSkin ? 0xffffff : def.evolution ? 0xffd166 : 0xff7fc0
        const auraFade = auraScale <= 1.15 ? 1 : Math.max(0.34, 1 - (auraScale - 1.15) * 0.22)
        a.alpha = (0.35 + pulse * 0.4) * auraFade
      }

      if (!p.alive) continue
      const w = 34
      const ratio = Math.max(0, p.hp / p.stats.maxHp)
      bars.rect(x - w / 2 - 1, y + PLAYER_RADIUS + 9, w + 2, 6).fill({ color: 0x1c0b26, alpha: 0.85 })
      bars.rect(x - w / 2, y + PLAYER_RADIUS + 10, w * ratio, 4).fill({ color: ratio > 0.3 ? 0xff4f7b : 0xff2030 })
    }
    this.players.end()
    this.auras.end()
  }

  private drawCosmetics(world: World, alpha: number, dt: number): void {
    this.pets.begin()
    this.ornaments.begin()
    this.backOrnaments.begin()
    for (const p of world.players) {
      if (p.disconnected) continue
      const x = p.prevX + (p.x - p.prevX) * alpha
      const y = p.prevY + (p.y - p.prevY) * alpha
      const fx = this.effectOf(p)

      if (p.alive && fx?.effect) {
        const moving = Math.abs(p.moveX) + Math.abs(p.moveY) > 0.1
        if (moving && Math.random() < 0.62) {
          const kind = fx.effect
          const scale = kind === 'lightning' ? 0.7 : kind === 'petals' || kind === 'snow' ? 0.52 : 0.4
          this.particles.emit(this.effectSprite(kind), x - p.facing * 10, y + 12, {
            life: kind === 'lightning' ? 0.32 : 0.6,
            scale,
            scaleEnd: 0.08,
            tint: fx.tint ?? 0xffffff,
            vx: (Math.random() - 0.5) * 22,
            vy: kind === 'snow' ? 16 + Math.random() * 28 : kind === 'embers' ? -28 - Math.random() * 24 : -12 - Math.random() * 22,
            gravity: kind === 'snow' ? 36 : kind === 'embers' ? -22 : kind === 'petals' ? 16 : -6,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * (kind === 'lightning' ? 1.5 : 5)
          })
        }
      }

      const ornamentId = p.loadout.ornament
      if (ornamentId) {
        const def = COSMETICS[ornamentId]
        if (def?.ornament) {
          const kind = def.ornament
          const behind = kind === 'wings' || kind === 'moon'
          const o = (behind ? this.backOrnaments : this.ornaments).next(this.tex.ornaments[kind])
          const bob = Math.sin(this.time * 3 + p.id) * 2
          if (kind === 'wings') o.position.set(x, y - 2)
          else if (kind === 'moon') o.position.set(x, y - 8)
          else if (kind === 'lantern') {
            const ang = this.time * 1.3 + p.id
            o.position.set(x + Math.cos(ang) * 36, y - 6 + Math.sin(ang) * 14)
          } else if (kind === 'umbrella') o.position.set(x + p.facing * 6, y - 36 + bob)
          else if (kind === 'mask') o.position.set(x + p.facing * 20, y - 18 + bob * 0.4)
          else o.position.set(x, y - 32 + bob)
          const scale = kind === 'wings' ? 1.35 : kind === 'moon' ? 1.5 : kind === 'mask' ? 0.62 : kind === 'umbrella' ? 1.05 : 0.8
          o.scale.set(scale)
          o.alpha = p.alive ? (kind === 'moon' ? 0.85 : 1) : 0.35
          o.tint = 0xffffff
        }
      }

      const petId = p.loadout.pet
      if (petId && p.alive) {
        const def = COSMETICS[petId]
        if (def?.pet) {
          let f = this.followers.get(p.id)
          if (!f) {
            f = { x: x - p.facing * 56, y: y + 12, face: -p.facing || -1 }
            this.followers.set(p.id, f)
          }
          const goalX = x - p.facing * 86
          const goalY = y + 18
          const dx = goalX - f.x
          const dy = goalY - f.y
          const dist = Math.hypot(dx, dy)
          if (dist > 280) {
            f.x = goalX
            f.y = goalY
          } else {
            const catchup = 1 - Math.exp(-dt * (0.9 + Math.min(dist, 200) * 0.02))
            f.x += dx * catchup
            f.y += dy * catchup
          }
          if (Math.abs(dx) > 8) f.face = dx > 0 ? 1 : -1
          const hop = Math.sin(this.time * (dist > 10 ? 10 : 4)) * (dist > 10 ? 3 : 1.2)
          this.shadow(f.x, f.y + 16, 20)
          const s = this.pets.next(this.tex.pets[def.pet])
          s.position.set(f.x, f.y + hop)
          s.scale.set((f.face || 1) * 1.08, 1.08)
          s.alpha = 1
          s.tint = 0xffffff
        }
      }
    }
    this.pets.end()
    this.ornaments.end()
    this.backOrnaments.end()
  }

  private effectOf(p: { loadout: { effect: string | null } }) {
    return p.loadout.effect ? COSMETICS[p.loadout.effect] : undefined
  }

  private effectSprite(kind: EffectKind) {
    return this.tex.trails[kind]
  }

  private visualFamily(visual: number): string {
    switch (visualIndex(visual)) {
      case ProjVisual.Talisman:
      case ProjVisual.Seal:
        return 'talisman'
      case ProjVisual.Kunai:
        return 'kunai'
      case ProjVisual.Foxfire:
      case ProjVisual.SpiritFlame:
        return 'foxfire'
      case ProjVisual.Shuriken:
      case ProjVisual.Fuuma:
        return 'shuriken'
      case ProjVisual.Rocket:
        return 'hanabi'
      default:
        return ''
    }
  }

  private skinTex(loadout: CosmeticLoadout | undefined, family: string) {
    const skin = weaponSkinFor(loadout, family)
    return skin ? this.tex.weaponSkins[skin.id] : undefined
  }

  private projectileTint(world: World, ownerIndex: number, visual: number, fallback: number): number {
    if (this.skinTex(world.players[ownerIndex]?.loadout, this.visualFamily(visual))) return 0xffffff
    const p = world.players[ownerIndex]
    return weaponSkinFor(p?.loadout, this.visualFamily(visual))?.tint ?? fallback
  }

  private drawProjectiles(world: World, alpha: number): void {
    const pr = world.projectiles
    const t = this.tex
    this.projectiles.begin()
    for (let i = 0; i < pr.count; i++) {
      const x = pr.prevX[i] + (pr.x[i] - pr.prevX[i]) * alpha
      const y = pr.prevY[i] + (pr.y[i] - pr.prevY[i]) * alpha
      if (!this.visible(x, y)) continue
      const raw = pr.visual[i]
      const v = visualIndex(raw)
      const glow = raw !== v
      const skinned = this.skinTex(world.players[pr.owner[i]]?.loadout, this.visualFamily(v))
      const s = this.projectiles.next(skinned ?? t.projectiles[v])
      s.position.set(x, y)
      const hitScale = pr.radius[i] / (VISUAL_BASE_RADIUS[v] || 1)
      const scale = hitScale * 2 * (glow ? 1.22 : 1)
      s.scale.set(scale)
      const fallback = v === ProjVisual.Fuuma ? 0xc9a8ff : 0xffffff
      const tint = this.projectileTint(world, pr.owner[i], v, fallback)
      s.tint = glow && !skinned ? 0xffe7a0 : tint
      const aim = Math.atan2(pr.vy[i], pr.vx[i])
      const pointsUp =
        v === ProjVisual.Foxfire ||
        v === ProjVisual.SpiritFlame ||
        v === ProjVisual.Talisman ||
        v === ProjVisual.Seal ||
        (skinned && (v === ProjVisual.Kunai || v === ProjVisual.Rocket))
      s.rotation = aim + (pointsUp ? Math.PI / 2 : 0)
      if (v === ProjVisual.Foxfire || v === ProjVisual.SpiritFlame || glow) s.scale.set(scale * (1 + Math.sin(this.time * 14 + i) * 0.08))
      s.alpha = hitScale <= 1.45 ? 1 : Math.max(0.32, 1 - (hitScale - 1.45) * 0.26)
      const speed = Math.hypot(pr.vx[i], pr.vy[i])
      if (speed > 30 && (v === ProjVisual.Shuriken || v === ProjVisual.Fuuma || v === ProjVisual.Kunai || v === ProjVisual.Rocket) && Math.random() < 0.45) {
        this.particles.emit(t.spark, x - (pr.vx[i] / speed) * 10, y - (pr.vy[i] / speed) * 10, {
          life: 0.18,
          scale: 0.45,
          scaleEnd: 0,
          tint: s.tint === 0xffffff ? 0xd7e4ff : s.tint,
          alpha: 0.7
        })
      }
      if (pr.kind[i] === ProjKind.Rocket && Math.random() < 0.6) {
        const skinTint = weaponSkinFor(world.players[pr.owner[i]]?.loadout, 'hanabi')?.tint
        this.particles.emit(t.spark, x, y, {
          life: 0.35,
          scale: 0.7,
          scaleEnd: 0.1,
          tint: skinTint ?? FIREWORK_COLORS[(i + Math.floor(this.time * 10)) % FIREWORK_COLORS.length],
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30
        })
      }
    }
    this.projectiles.end()
  }

  // ------------------------------------------------------------------ events

  handleEvents(world: World, events: readonly GameEvent[], localId: PlayerId): void {
    const t = this.tex
    const fx = this.particles
    for (const ev of events) {
      switch (ev.e) {
        case 'damage':
          if (this.settings.damageNumbers) this.numbers.spawn(ev.x, ev.y, ev.amount, ev.crit ? 0xffd166 : 0xffffff, ev.crit)
          fx.burst(t.spark, ev.x, ev.y + 6, ev.crit ? 4 : 2, 160, { life: 0.22, scale: 0.6, scaleEnd: 0, align: true, drag: 4 })
          this.sfx.hit()
          break
        case 'kill': {
          const def = ENEMIES[ev.enemyType]
          const big = ev.elite
          fx.burst(t.petal, ev.x, ev.y, big ? 36 : 9, big ? 320 : 170, { life: 0.55, scale: 1, scaleEnd: 0.3, tint: def.color, drag: 3, spin: 8 })
          fx.emit(t.glow, ev.x, ev.y, { life: 0.25, scale: big ? 2.5 : 0.8, scaleEnd: big ? 4 : 1.4, tint: def.color, alpha: 0.8 })
          if (big) {
            this.camera.addTrauma(0.45)
            fx.emit(t.ring, ev.x, ev.y, { life: 0.4, scale: 0.4, scaleEnd: 2.2, tint: def.color })
          }
          this.sfx.kill()
          break
        }
        case 'player-hit':
          if (ev.playerId === localId) {
            this.camera.addTrauma(0.4)
            this.vignetteAlpha = 0.9
            this.sfx.hurt()
          }
          {
            const p = world.playerById(ev.playerId)
            if (p && this.settings.damageNumbers) this.numbers.spawn(p.x, p.y - 30, ev.amount, 0xff4060, false)
          }
          break
        case 'player-down': {
          const p = world.playerById(ev.playerId)
          if (p) fx.burst(t.star, p.x, p.y, 30, 260, { life: 0.8, scale: 0.8, scaleEnd: 0, tint: 0xff5fa2, drag: 2 })
          this.camera.addTrauma(0.8)
          break
        }
        case 'revive': {
          const p = world.playerById(ev.playerId)
          if (p) {
            fx.emit(t.ring, p.x, p.y, { life: 0.6, scale: 0.3, scaleEnd: 4, tint: 0xffd166 })
            fx.burst(t.star, p.x, p.y, 40, 300, { life: 0.9, scale: 0.8, scaleEnd: 0, tint: 0xffd166, drag: 2 })
          }
          this.screenFlash(0.6)
          this.sfx.evolution()
          break
        }
        case 'slash': {
          const slashSkin = this.skinTex(world.playerById(ev.playerId)?.loadout, 'katana')
          const slashTint = slashSkin ? 0xffffff : weaponSkinFor(world.playerById(ev.playerId)?.loadout, 'katana')?.tint ?? (ev.evolved ? 0xff8fc8 : 0xe8f4ff)
          fx.emit(slashSkin ?? t.slash, ev.x, ev.y, {
            life: 0.2,
            scale: (ev.ry * 2.4) / 96,
            scaleEnd: (ev.ry * 2.7) / 96,
            aspect: (ev.rx * 2) / 128 / ((ev.ry * 2.4) / 96),
            rotation: ev.angle ?? 0,
            flipX: ev.angle == null && ev.dir < 0,
            tint: slashTint,
            alpha: 0.95
          })
          if (ev.lead !== false) this.sfx.slash()
          break
        }
        case 'strike': {
          const boltSkin = this.skinTex(world.playerById(ev.playerId)?.loadout, 'thunder')
          const bolt = boltSkin ?? t.bolts[Math.floor(Math.random() * t.bolts.length)]
          const strikeTint = boltSkin ? 0xffffff : weaponSkinFor(world.playerById(ev.playerId)?.loadout, 'thunder')?.tint ?? (ev.evolved ? 0xffe066 : 0xbfe8ff)
          fx.emit(bolt, ev.x, ev.y - 128 * 1.6, { life: 0.18, scale: 1.6, aspect: 0.6 + Math.random() * 0.4, tint: strikeTint })
          fx.emit(t.glow, ev.x, ev.y, { life: 0.25, scale: ev.radius / 20, scaleEnd: ev.radius / 14, tint: strikeTint })
          fx.burst(t.spark, ev.x, ev.y, 10, 260, { life: 0.3, scale: 0.7, scaleEnd: 0, tint: strikeTint, align: true, drag: 3 })
          this.camera.addTrauma(0.12)
          this.sfx.thunder()
          break
        }
        case 'explosion': {
          const color = weaponSkinFor(world.playerById(ev.playerId)?.loadout, 'hanabi')?.tint ?? FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]
          fx.emit(t.glow, ev.x, ev.y, { life: 0.3, scale: ev.radius / 24, scaleEnd: ev.radius / 18, tint: color, alpha: 0.9 })
          fx.emit(t.ring, ev.x, ev.y, { life: 0.35, scale: 0.2, scaleEnd: (ev.radius * 2.2) / 128, tint: color })
          fx.burst(t.star, ev.x, ev.y, 18, ev.radius * 4, { life: 0.7, scale: 0.55, scaleEnd: 0, tint: color, drag: 3, gravity: 120, spin: 6 })
          fx.burst(t.spark, ev.x, ev.y, 14, ev.radius * 5, { life: 0.5, scale: 0.6, scaleEnd: 0, tint: 0xffffff, align: true, drag: 3 })
          this.camera.addTrauma(0.15)
          this.sfx.explosion()
          break
        }
        case 'pickup':
          if (ev.kind === PickupType.Gem) {
            fx.emit(t.spark, ev.x, ev.y, { life: 0.2, scale: 1.2, scaleEnd: 0, tint: 0x9fe6ff })
            this.sfx.gem()
          } else if (ev.kind === PickupType.Heal) {
            fx.burst(t.star, ev.x, ev.y, 10, 120, { life: 0.6, scale: 0.5, scaleEnd: 0, tint: 0x7dff9a, gravity: -80 })
            this.sfx.heal()
          } else if (ev.kind === PickupType.Gold) {
            this.sfx.coin()
          } else if (ev.kind === PickupType.Chest) {
            fx.burst(t.star, ev.x, ev.y, 40, 340, { life: 1, scale: 0.8, scaleEnd: 0, tint: 0xffd166, drag: 2, spin: 5 })
            fx.emit(t.ring, ev.x, ev.y, { life: 0.5, scale: 0.3, scaleEnd: 3, tint: 0xffd166 })
            this.camera.addTrauma(0.3)
            this.sfx.chest()
          } else if (ev.kind === PickupType.Magnet) {
            fx.emit(t.ring, ev.x, ev.y, { life: 0.6, scale: 0.3, scaleEnd: 6, tint: 0x9fe6ff })
            this.sfx.chest()
          }
          break
        case 'level-up': {
          const p = world.playerById(localId)
          if (p) {
            const fxDef = this.effectOf(p)
            const tint = fxDef?.tint ?? 0x5ff2ff
            fx.emit(t.ring, p.x, p.y, { life: 0.5, scale: 0.3, scaleEnd: 3.5, tint })
            fx.burst(t.star, p.x, p.y, 24, 260, { life: 0.8, scale: 0.6, scaleEnd: 0, tint, drag: 2 })
          }
          this.screenFlash(0.35)
          this.sfx.levelUp()
          break
        }
        case 'evolution':
          this.screenFlash(0.8)
          this.camera.addTrauma(0.5)
          this.sfx.evolution()
          break
        case 'boss':
          this.camera.addTrauma(0.6)
          this.sfx.boss()
          break
        case 'telegraph':
          fx.emit(t.ring, ev.x, ev.y, { life: 0.45, scale: 0.15, scaleEnd: (ev.radius * 2) / 64, tint: ev.tint, alpha: 0.85 })
          fx.emit(t.glow, ev.x, ev.y, { life: 0.35, scale: ev.radius / 40, scaleEnd: ev.radius / 28, tint: ev.tint, alpha: 0.45 })
          break
        case 'endless':
          break
        case 'chest':
          break
        case 'discover':
          break
      }
    }
  }
}
