import { CanvasSource, Texture } from 'pixi.js'
import { CHARACTERS, type Accessory, type CharacterDef, type CharacterPalette } from '@/game/data/characters'
import { COSMETICS, type CosmeticDef, type EffectKind, type OrnamentKind, type PetKind } from '@/game/data/cosmetics'
import { ENEMIES } from '@/game/data/enemies'
import sakuraCast from '../assets/characters/sakura.png'
import rinCast from '../assets/characters/rin.png'
import kaedeCast from '../assets/characters/kaede.png'
import yukiCast from '../assets/characters/yuki.png'
import hikariCast from '../assets/characters/hikari.png'
import akaneCast from '../assets/characters/akane.png'
import oniBossArt from '../assets/bosses/oni.png'
import shutenBossArt from '../assets/bosses/shuten.png'
import kitsuneBossArt from '../assets/bosses/kitsune.png'
import orochiBossArt from '../assets/bosses/orochi.png'
import raijinBossArt from '../assets/bosses/raijin.png'
import yukiBossArt from '../assets/bosses/yuki.png'
import wispArt from '../assets/enemies/wisp.png'
import impArt from '../assets/enemies/imp.png'
import crowArt from '../assets/enemies/crow.png'
import kasaArt from '../assets/enemies/kasa.png'
import yureiArt from '../assets/enemies/yurei.png'
import bruteArt from '../assets/enemies/brute.png'
import spiderArt from '../assets/enemies/spider.png'
import kodamaArt from '../assets/enemies/kodama.png'
import tenguArt from '../assets/enemies/tengu.png'
import nurikabeArt from '../assets/enemies/nurikabe.png'
import chochinArt from '../assets/enemies/chochin.png'
import kappaArt from '../assets/enemies/kappa.png'
import nueArt from '../assets/enemies/nue.png'
import omamoriProj from '../assets/icons/omamori.png'
import sealProj from '../assets/icons/seal.png'
import shikigamiArt from '../assets/pets/shikigami.png'

/** Textures are painted at 2x and exposed at logical size, so they stay crisp when zoomed. */
const RES = 2
const OUTLINE = '#1c0b26'
const SKIN = '#ffe9da'
const SKIN_SHADE = '#f4c2b0'

const CHIBI_W = 64
const CHIBI_H = 74
const CHIBI_GLOW = 4
/** Body centre (collision point) inside the chibi canvas, before glow padding. */
const CHIBI_CENTER_Y = 46

/** Anchor that puts the player's body centre on its world position. */
export const PLAYER_ANCHOR_Y = (CHIBI_CENTER_Y + CHIBI_GLOW * 1.5) / (CHIBI_H + CHIBI_GLOW * 3)

type Ctx = CanvasRenderingContext2D
type Paint = string | CanvasGradient

export interface GameTextures {
  players: Record<string, Texture>
  enemies: Texture[]
  enemiesWhite: Texture[]
  projectiles: Texture[]
  gems: Texture[]
  heal: Texture
  gold: Texture
  chest: Texture
  /** Data URL of the chest, for the off-screen marker. */
  chestIcon: string
  magnet: Texture
  spark: Texture
  glow: Texture
  ring: Texture
  slash: Texture
  bolts: Texture[]
  star: Texture
  petal: Texture
  shadow: Texture
  aura: Texture
  vignette: Texture
  ground: Texture
  groundAsh: Texture
  portal: Texture
  props: Texture[]
  moon: Texture
  pets: Record<PetKind, Texture>
  ornaments: Record<OrnamentKind, Texture>
  /** One crisp sprite per trail, tinted in-game by the cosmetic colour. */
  trails: Record<EffectKind, Texture>
  /** Unique in-game art for each weapon skin, keyed by cosmetic id. */
  weaponSkins: Record<string, Texture>
  /** Large character / skin renders (data URLs) for the DOM UI. */
  portraits: Record<string, string>
  /** Bestiary art, indexed like `enemies`. */
  enemyPortraits: string[]
  /** Preview art for every cosmetic. */
  previews: Record<string, string>
}

// ---------------------------------------------------------------- canvas helpers

function paint(w: number, h: number, draw: (ctx: Ctx) => void, res = RES): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * res)
  c.height = Math.ceil(h * res)
  const ctx = c.getContext('2d')!
  ctx.scale(res, res)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  draw(ctx)
  return c
}

function toTexture(c: HTMLCanvasElement, resolution = RES): Texture {
  return new Texture({ source: new CanvasSource({ resource: c, resolution }) })
}

function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

/** Uniform cel-style outline: stamp a dark silhouette around the sprite. */
function outlined(src: HTMLCanvasElement, px = 1.4, res = RES, color = OUTLINE): HTMLCanvasElement {
  const sil = silhouette(src, color)
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  const d = px * res
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2
    ctx.drawImage(sil, Math.cos(t) * d, Math.sin(t) * d)
  }
  ctx.drawImage(src, 0, 0)
  return c
}

/** Soft coloured halo; pads the canvas so the glow is never clipped. */
function withGlow(src: HTMLCanvasElement, color: string, blur: number, res = RES): HTMLCanvasElement {
  const pad = Math.ceil(blur * 1.5 * res)
  const c = document.createElement('canvas')
  c.width = src.width + pad * 2
  c.height = src.height + pad * 2
  const ctx = c.getContext('2d')!
  ctx.shadowColor = color
  ctx.shadowBlur = blur * res
  ctx.drawImage(src, pad, pad)
  ctx.shadowBlur = 0
  ctx.drawImage(src, pad, pad)
  return c
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: Paint): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2)
  ctx.fill()
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: Paint): void {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function star(ctx: Ctx, x: number, y: number, points: number, outer: number, inner: number, rotation = 0): void {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rotation + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

function hex(n: number, alpha = 1): string {
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** Cel shading for round bodies: core shadow bottom-right and a specular highlight top-left. */
function shadeBody(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  ellipse(ctx, x + rx * 0.35, y + ry * 0.45, rx * 1.05, ry * 0.85, 'rgba(30,0,50,0.28)')
  ellipse(ctx, x - rx * 0.38, y - ry * 0.45, rx * 0.32, ry * 0.2, 'rgba(255,255,255,0.45)')
  ctx.restore()
}

/** Specular band and a cool lower shadow, painted only on pixels that already exist. */
function glossStreak(ctx: Ctx, w: number, h: number): void {
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = lin(ctx, w * 0.05, 0, w * 0.85, h, [
    [0, 'rgba(255,255,255,0.32)'],
    [0.34, 'rgba(255,255,255,0.04)'],
    [0.68, 'rgba(255,255,255,0)'],
    [1, 'rgba(16,0,28,0.22)']
  ])
  ctx.fillRect(0, 0, w, h)
  ctx.beginPath()
  ctx.ellipse(w * 0.32, h * 0.2, Math.max(2.2, w * 0.15), Math.max(1.1, h * 0.04), -0.55, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
  ctx.restore()
}

/** Trail motif drawn around the origin, about 24px across. White so a tint can recolour it. */
function drawTrail(ctx: Ctx, kind: EffectKind, color = '#ffffff'): void {
  ctx.save()
  if (kind === 'petals') {
    ctx.rotate(-0.45)
    ctx.beginPath()
    ctx.moveTo(0, -11)
    ctx.bezierCurveTo(8, -5, 6.5, 6, 0, 11)
    ctx.bezierCurveTo(-5.5, 5, -8, -5, 0, -11)
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 0.45
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(-1.8, -2, 2.4, 5, -0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.quadraticCurveTo(1.4, 0, 0, 7)
    ctx.stroke()
  } else if (kind === 'sparks') {
    ctx.fillStyle = radial(ctx, 0, 0, 14, [
      [0, '#ffffff'],
      [0.25, color],
      [1, 'rgba(255,255,255,0)']
    ])
    ctx.beginPath()
    ctx.arc(0, 0, 14, 0, Math.PI * 2)
    ctx.fill()
    star(ctx, 0, 0, 4, 11, 2, 0.15)
    ctx.fillStyle = color
    ctx.fill()
    star(ctx, 0, 0, 4, 4.5, 1.1, 0.15)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  } else if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.strokeStyle = color
    ctx.lineWidth = 1.3
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2
      ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.15
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const x = Math.cos(a) * 7
      const y = Math.sin(a) * 7
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12)
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a + 0.55) * 3.1, y + Math.sin(a + 0.55) * 3.1)
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a - 0.55) * 3.1, y + Math.sin(a - 0.55) * 3.1)
      ctx.stroke()
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, 0, 1.7, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'embers') {
    ctx.beginPath()
    ctx.moveTo(0, -13)
    ctx.quadraticCurveTo(8, -4, 5, 3)
    ctx.quadraticCurveTo(3, -1, 1.4, 12)
    ctx.quadraticCurveTo(0, 5, -1.4, 12)
    ctx.quadraticCurveTo(-3, -1, -5, 3)
    ctx.quadraticCurveTo(-8, -4, 0, -13)
    ctx.fillStyle = radial(ctx, 0, 3, 14, [
      [0, '#ffffff'],
      [0.45, color],
      [1, 'rgba(255,255,255,0)']
    ])
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.bezierCurveTo(2.6, -1, 2, 4, 0, 6)
    ctx.bezierCurveTo(-2, 4, -2.6, -1, 0, -6)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  } else if (kind === 'stars') {
    ctx.fillStyle = radial(ctx, 0, 0, 13, [
      [0, 'rgba(255,255,255,0.95)'],
      [1, 'rgba(255,255,255,0)']
    ])
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, Math.PI * 2)
    ctx.fill()
    star(ctx, 0, 0, 5, 12, 5.2, 0.1)
    ctx.fillStyle = color
    ctx.fill()
    star(ctx, 0, 0, 5, 5.2, 2.1, 0.1)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  } else {
    ctx.shadowColor = color
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(-1, -13)
    ctx.lineTo(6, -3)
    ctx.lineTo(1, -2)
    ctx.lineTo(5, 13)
    ctx.lineTo(-6, 1)
    ctx.lineTo(-1, 2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.15
    ctx.beginPath()
    ctx.moveTo(0, -9)
    ctx.lineTo(3.2, -3)
    ctx.lineTo(0.4, -2)
    ctx.lineTo(2.4, 8)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------- characters

function drawEye(ctx: Ctx, x: number, y: number, p: CharacterPalette): void {
  ellipse(ctx, x, y + 0.3, 3.7, 4.7, '#ffffff')
  ellipse(ctx, x + 0.5, y + 0.5, 3, 4.1, lin(ctx, 0, y - 4.5, 0, y + 4.5, [[0, p.eyesDark], [0.55, p.eyes], [1, mix(p.eyes, '#ffffff', 0.55)]]))
  ellipse(ctx, x + 0.6, y + 0.1, 1.4, 2.3, mix(p.eyesDark, OUTLINE, 0.5))
  ellipse(ctx, x + 0.6, y + 2.7, 1.9, 0.9, 'rgba(255,255,255,0.4)')
  ellipse(ctx, x - 0.8, y - 1.8, 1.4, 1.6, '#ffffff')
  ellipse(ctx, x + 1.7, y + 1.5, 0.65, 0.65, '#ffffff')
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.9
  ctx.beginPath()
  ctx.ellipse(x, y, 3.9, 4.9, 0, Math.PI * 1.06, Math.PI * 1.94)
  ctx.stroke()
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x + 3.4, y - 2.4)
  ctx.lineTo(x + 5, y - 3.4)
  ctx.stroke()
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.ellipse(x + 0.3, y + 0.5, 3.4, 4.6, 0, Math.PI * 0.3, Math.PI * 0.7)
  ctx.stroke()
}

function bangsPath(ctx: Ctx, cx: number): void {
  ctx.beginPath()
  ctx.moveTo(cx - 16.5, 25)
  ctx.quadraticCurveTo(cx - 17, 4, cx, 4.5)
  ctx.quadraticCurveTo(cx + 17, 4, cx + 16.5, 25)
  ctx.lineTo(cx + 13, 17)
  ctx.lineTo(cx + 10, 22.5)
  ctx.lineTo(cx + 6, 14)
  ctx.lineTo(cx + 2, 21.5)
  ctx.lineTo(cx - 2, 14)
  ctx.lineTo(cx - 6, 21.5)
  ctx.lineTo(cx - 10, 15)
  ctx.lineTo(cx - 13, 23)
  ctx.closePath()
}

function drawBackProp(ctx: Ctx, c: CharacterDef, cx: number): void {
  const p = c.palette
  switch (c.prop) {
    case 'katana': {
      ctx.save()
      ctx.translate(cx, 38)
      ctx.rotate(-0.85)
      roundRect(ctx, -2.5, -4, 5, 34, 2, lin(ctx, -2.5, 0, 2.5, 0, [[0, '#5a1f3d'], [1, '#2a0c1e']]))
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(-2.5, 6, 5, 1.6)
      ctx.fillRect(-2.5, 20, 5, 1.6)
      ellipse(ctx, 0, -5, 4.5, 1.6, '#ffd166')
      roundRect(ctx, -2, -16, 4, 11, 1, '#2b1d33')
      ctx.fillStyle = p.accent
      for (let y = -15; y < -6; y += 3) ctx.fillRect(-2, y, 4, 1.2)
      ctx.restore()
      return
    }
    case 'fox-tail': {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx - 6, 50)
      ctx.bezierCurveTo(cx - 30, 52, cx - 32, 26, cx - 22, 18)
      ctx.bezierCurveTo(cx - 20, 30, cx - 14, 40, cx - 2, 44)
      ctx.closePath()
      ctx.fillStyle = lin(ctx, cx - 30, 20, cx - 4, 50, [[0, '#ffffff'], [0.35, p.hair], [1, p.hairShade]])
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - 22, 24)
      ctx.quadraticCurveTo(cx - 24, 38, cx - 10, 46)
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'rocket': {
      ctx.save()
      ctx.translate(cx - 10, 36)
      ctx.rotate(-0.5)
      roundRect(ctx, -3.5, -14, 7, 22, 2, lin(ctx, -3.5, 0, 3.5, 0, [[0, '#ff6b5b'], [1, '#a3121f']]))
      ctx.fillStyle = '#ffd166'
      ctx.beginPath()
      ctx.moveTo(-3.5, -14)
      ctx.lineTo(0, -21)
      ctx.lineTo(3.5, -14)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-3.5, -6, 7, 2)
      ctx.restore()
      return
    }
    case 'drums': {
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * (1.08 + (k / 5) * 0.84)
        const x = cx + Math.cos(a) * 25
        const y = 22 + Math.sin(a) * 19
        ellipse(ctx, x, y, 4.6, 4.6, radial(ctx, x - 1, y - 1, 5, [[0, '#fff6c8'], [1, '#d9a62b']]))
        ctx.strokeStyle = '#7a1a8f'
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.arc(x, y, 2.4, 0, Math.PI * 1.4)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255,224,102,0.8)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx, 22, 25, Math.PI * 1.08, Math.PI * 1.92)
      ctx.stroke()
      return
    }
    default:
      return
  }
}

function drawFrontProp(ctx: Ctx, c: CharacterDef, cx: number): void {
  const p = c.palette
  if (c.prop === 'scarf') {
    ctx.fillStyle = lin(ctx, 0, 34, 0, 42, [[0, '#ff6f8a'], [1, '#c8203f']])
    ctx.beginPath()
    ctx.roundRect(cx - 9, 34, 18, 6, 3)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - 6, 37)
    ctx.quadraticCurveTo(cx - 16, 40, cx - 24, 36)
    ctx.lineTo(cx - 22, 41)
    ctx.quadraticCurveTo(cx - 14, 45, cx - 4, 40)
    ctx.closePath()
    ctx.fill()
  } else if (c.prop === 'gohei') {
    ctx.strokeStyle = '#8a5a2b'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(cx + 11, 52)
    ctx.lineTo(cx + 19, 28)
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + 19, 29)
      ctx.lineTo(cx + 19 + s * 4, 31)
      ctx.lineTo(cx + 19 + s * 2, 34)
      ctx.lineTo(cx + 19 + s * 6, 36)
      ctx.lineTo(cx + 19 + s * 4, 40)
      ctx.lineTo(cx + 19 + s * 1, 37)
      ctx.closePath()
      ctx.fill()
    }
  } else if (c.prop === 'drums') {
    // lightning hairpin
    ctx.fillStyle = p.accent
    ctx.beginPath()
    ctx.moveTo(cx + 13, 6)
    ctx.lineTo(cx + 9, 12)
    ctx.lineTo(cx + 12, 12)
    ctx.lineTo(cx + 10, 17)
    ctx.lineTo(cx + 15, 10)
    ctx.lineTo(cx + 12, 10)
    ctx.closePath()
    ctx.fill()
  }
}

/** Extra costume pieces so a skin changes the silhouette, not only the palette. */
function drawSkinCostume(ctx: Ctx, c: CharacterDef, cx: number): void {
  const p = c.palette
  const horn = (sx: number, h = 16): void => {
    ctx.fillStyle = lin(ctx, 0, 0, 0, 18, [[0, '#fff6d0'], [1, p.accent]])
    ctx.beginPath()
    ctx.moveTo(cx + sx * 7, 14)
    ctx.quadraticCurveTo(cx + sx * (8 + h * 0.35), 2, cx + sx * 4, 6)
    ctx.quadraticCurveTo(cx + sx * 9, 10, cx + sx * 7, 14)
    ctx.fill()
  }
  switch (c.id) {
    case 'sakura_midnight':
      ellipse(ctx, cx + 16, 8, 5, 5, 'rgba(180,160,255,0.0)')
      ctx.strokeStyle = '#e7dcff'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx + 15, 8, 4.2, Math.PI * 0.15, Math.PI * 1.35)
      ctx.stroke()
      ellipse(ctx, cx + 18, 6, 1.1, 1.1, '#fff')
      return
    case 'sakura_shrine':
      ctx.fillStyle = lin(ctx, 0, 8, 0, 28, [[0, '#fffaf0'], [1, '#e7d2a0']])
      ctx.fillRect(cx + 14, 30, 3, 16)
      ctx.fillStyle = '#d8243c'
      ctx.fillRect(cx + 13.2, 34, 4.6, 3)
      ellipse(ctx, cx + 15.5, 28, 2.2, 2.2, '#ffd166')
      return
    case 'sakura_celestial':
      ctx.strokeStyle = '#9ef6ff'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.ellipse(cx, 6, 16, 5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ellipse(ctx, cx, 6, 2, 2, radial(ctx, cx, 6, 3, [[0, '#fff'], [1, '#7ef0ff']]))
      return
    case 'rin_ocean':
      ctx.strokeStyle = p.accent
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx - 12, 42)
      ctx.quadraticCurveTo(cx, 46, cx + 12, 42)
      ctx.stroke()
      ellipse(ctx, cx, 22, 2.4, 3, radial(ctx, cx, 21, 4, [[0, '#fff'], [1, '#4fd4ff']]))
      return
    case 'rin_oni':
      horn(-1)
      horn(1)
      ctx.fillStyle = '#fff6e8'
      ctx.beginPath()
      ctx.moveTo(cx - 3, 28)
      ctx.lineTo(cx - 1, 33)
      ctx.lineTo(cx + 1, 28)
      ctx.fill()
      return
    case 'rin_shadowmiko':
      ctx.fillStyle = 'rgba(12,8,20,0.82)'
      ctx.beginPath()
      ctx.moveTo(cx - 16, 10)
      ctx.quadraticCurveTo(cx, 4, cx + 8, 12)
      ctx.lineTo(cx + 4, 30)
      ctx.quadraticCurveTo(cx - 6, 22, cx - 16, 16)
      ctx.fill()
      ctx.fillStyle = '#ff4060'
      ctx.fillRect(cx - 2, 40, 7, 4)
      return
    case 'kaede_moon':
      ctx.strokeStyle = '#e8f4ff'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(cx - 14, 8, 4.5, Math.PI * 0.2, Math.PI * 1.4)
      ctx.stroke()
      return
    case 'kaede_venom':
      ctx.fillStyle = lin(ctx, 0, 36, 0, 52, [[0, '#e8ffb0'], [1, '#148848']])
      ctx.beginPath()
      ctx.moveTo(cx + 12, 38)
      ctx.lineTo(cx + 16, 38)
      ctx.lineTo(cx + 15, 50)
      ctx.lineTo(cx + 13, 50)
      ctx.fill()
      ellipse(ctx, cx + 14, 51, 1.6, 2.2, '#c8ff4a')
      return
    case 'kaede_phantom':
      ctx.globalAlpha = 0.35
      ellipse(ctx, cx + 8, 24, 14, 16, '#ff90d0')
      ctx.globalAlpha = 1
      return
    case 'yuki_blossom':
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        ellipse(ctx, cx + 14 + Math.cos(a) * 3, 10 + Math.sin(a) * 3, 2.1, 1.2, p.accent)
      }
      ellipse(ctx, cx + 14, 10, 1.2, 1.2, '#fff')
      return
    case 'yuki_void':
      ctx.fillStyle = '#0a1028'
      ctx.beginPath()
      ctx.moveTo(cx - 10, 18)
      ctx.lineTo(cx + 12, 16)
      ctx.lineTo(cx + 10, 26)
      ctx.lineTo(cx - 8, 27)
      ctx.fill()
      ellipse(ctx, cx + 4, 21, 2, 1.2, '#7a5cff')
      return
    case 'yuki_aurora':
      ctx.strokeStyle = '#5cffc0'
      ctx.lineWidth = 2
      for (const [x, y] of [[cx - 16, 40], [cx + 18, 36], [cx + 8, 48]] as const) {
        ctx.beginPath()
        ctx.moveTo(cx, 34)
        ctx.quadraticCurveTo(x, y - 6, x, y)
        ctx.stroke()
      }
      return
    case 'hikari_ivory':
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx - 16, 34)
      ctx.lineTo(cx - 22, 46)
      ctx.moveTo(cx + 16, 34)
      ctx.lineTo(cx + 22, 46)
      ctx.stroke()
      return
    case 'hikari_sunset':
      ctx.fillStyle = radial(ctx, cx - 18, 18, 8, [[0, '#fff6c8'], [0.5, '#ff8040'], [1, 'rgba(255,80,20,0)']])
      ctx.beginPath()
      ctx.arc(cx - 18, 18, 7, 0, Math.PI * 2)
      ctx.fill()
      return
    case 'hikari_raijin':
      ctx.strokeStyle = '#ffe040'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(cx - 14, 16)
      ctx.lineTo(cx - 10, 24)
      ctx.lineTo(cx - 16, 26)
      ctx.moveTo(cx + 14, 14)
      ctx.lineTo(cx + 10, 22)
      ctx.lineTo(cx + 17, 28)
      ctx.stroke()
      return
    case 'akane_jade':
      ctx.strokeStyle = '#40e090'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(cx + 14, 32)
      ctx.lineTo(cx + 20, 48)
      ctx.stroke()
      star(ctx, cx + 20, 30, 4, 3, 1.1)
      ctx.fillStyle = '#c8ff80'
      ctx.fill()
      return
    case 'akane_royal':
      ctx.fillStyle = lin(ctx, 0, 2, 0, 12, [[0, '#fff6d0'], [1, '#d4a020']])
      ctx.beginPath()
      ctx.moveTo(cx - 10, 10)
      ctx.lineTo(cx - 8, 2)
      ctx.lineTo(cx - 4, 8)
      ctx.lineTo(cx, 1)
      ctx.lineTo(cx + 4, 8)
      ctx.lineTo(cx + 8, 2)
      ctx.lineTo(cx + 10, 10)
      ctx.closePath()
      ctx.fill()
      return
    case 'akane_empress':
      ctx.fillStyle = lin(ctx, 0, 0, 0, 12, [[0, '#fff'], [1, '#ff4090']])
      ctx.beginPath()
      ctx.moveTo(cx - 12, 11)
      ctx.lineTo(cx - 8, 0)
      ctx.lineTo(cx, 8)
      ctx.lineTo(cx + 8, -1)
      ctx.lineTo(cx + 12, 11)
      ctx.closePath()
      ctx.fill()
      for (const [x, y] of [[cx - 18, 20], [cx + 18, 16], [cx + 16, 34]] as const) {
        star(ctx, x, y, 4, 2.4, 0.9)
        ctx.fillStyle = '#ffe08a'
        ctx.fill()
      }
      return
    default:
      return
  }
}

function drawChibi(ctx: Ctx, c: CharacterDef): void {
  const p = c.palette
  const cx = 30
  const has = (a: Accessory): boolean => c.accessories.includes(a)
  ctx.translate(2, 5)

  const hairGrad = lin(ctx, 0, 4, 0, 48, [[0, mix(p.hair, '#ffffff', 0.15)], [0.5, p.hair], [1, p.hairShade]])

  drawBackProp(ctx, c, cx)

  // Back hair
  if (c.longHair) roundRect(ctx, cx - 17, 16, 34, 35, 11, lin(ctx, 0, 16, 0, 51, [[0, p.hairShade], [1, mix(p.hairShade, OUTLINE, 0.3)]]))
  if (has('ponytail')) {
    ctx.fillStyle = lin(ctx, 0, 10, 0, 44, [[0, p.hair], [1, p.hairShade]])
    ctx.beginPath()
    ctx.moveTo(cx - 12, 12)
    ctx.bezierCurveTo(cx - 28, 14, cx - 26, 36, cx - 18, 44)
    ctx.bezierCurveTo(cx - 18, 32, cx - 14, 22, cx - 8, 16)
    ctx.closePath()
    ctx.fill()
    ellipse(ctx, cx - 12, 13, 3.5, 3.5, p.accent)
  }
  if (has('twin-tails')) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = lin(ctx, 0, 14, 0, 46, [[0, p.hair], [1, p.hairShade]])
      ctx.beginPath()
      ctx.moveTo(cx + s * 14, 14)
      ctx.bezierCurveTo(cx + s * 28, 18, cx + s * 26, 38, cx + s * 20, 46)
      ctx.bezierCurveTo(cx + s * 18, 34, cx + s * 16, 24, cx + s * 10, 18)
      ctx.closePath()
      ctx.fill()
      ellipse(ctx, cx + s * 14, 14, 3, 3, p.accent)
    }
  }
  ellipse(ctx, cx, 21, 18, 17, p.hairShade)

  // Legs and shoes
  roundRect(ctx, cx - 7, 50, 5, 9, 2, lin(ctx, 0, 50, 0, 59, [[0, SKIN_SHADE], [1, SKIN]]))
  roundRect(ctx, cx + 2, 50, 5, 9, 2, lin(ctx, 0, 50, 0, 59, [[0, SKIN_SHADE], [1, SKIN]]))
  roundRect(ctx, cx - 8.5, 57, 7.5, 4.5, 2, '#2b1d33')
  roundRect(ctx, cx + 1, 57, 7.5, 4.5, 2, '#2b1d33')
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(cx - 7, 57.6, 4, 1)
  ctx.fillRect(cx + 2.5, 57.6, 4, 1)

  // Body with folds and trim
  ctx.fillStyle = lin(ctx, 0, 36, 0, 56, [[0, p.outfit], [1, p.outfitShade]])
  ctx.beginPath()
  ctx.moveTo(cx - 8, 36)
  ctx.lineTo(cx + 8, 36)
  ctx.lineTo(cx + 13.5, 54)
  ctx.quadraticCurveTo(cx, 57.5, cx - 13.5, 54)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(30,0,50,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - 3, 48)
  ctx.lineTo(cx - 5, 55)
  ctx.moveTo(cx + 4, 48)
  ctx.lineTo(cx + 6, 55)
  ctx.stroke()
  ctx.strokeStyle = p.accent
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx - 13, 53.5)
  ctx.quadraticCurveTo(cx, 57, cx + 13, 53.5)
  ctx.stroke()
  if (c.pattern) drawOutfitPattern(ctx, cx, c.pattern, p.accent)

  // Wide kimono sleeves
  for (const s of [-1, 1]) {
    ctx.fillStyle = lin(ctx, 0, 37, 0, 50, [[0, p.outfit], [1, p.outfitShade]])
    ctx.beginPath()
    ctx.moveTo(cx + s * 6, 37)
    ctx.lineTo(cx + s * 14, 40)
    ctx.lineTo(cx + s * 15, 49)
    ctx.lineTo(cx + s * 8, 48)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx + s * 15, 49)
    ctx.lineTo(cx + s * 8, 48)
    ctx.stroke()
    ellipse(ctx, cx + s * 11, 49.5, 2.6, 2.6, SKIN)
  }

  // Obi sash with bow
  ctx.fillStyle = lin(ctx, 0, 42, 0, 47, [[0, mix(p.accent, '#ffffff', 0.25)], [1, p.accent]])
  ctx.fillRect(cx - 10, 42.5, 20, 4.5)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillRect(cx - 10, 44.3, 20, 0.8)

  // Collar
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(cx - 6.5, 36)
  ctx.lineTo(cx, 42.5)
  ctx.lineTo(cx + 6.5, 36)
  ctx.fill()
  ctx.fillStyle = SKIN
  ctx.beginPath()
  ctx.moveTo(cx - 3.2, 36)
  ctx.lineTo(cx, 39.8)
  ctx.lineTo(cx + 3.2, 36)
  ctx.fill()

  // Head
  ellipse(ctx, cx, 23, 15, 14, radial(ctx, cx - 3, 22, 18, [[0, SKIN], [0.85, SKIN], [1, SKIN_SHADE]]))

  if (has('fox-ears')) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, 13, [[0, '#ffffff'], [1, p.hair]])
      ctx.beginPath()
      ctx.moveTo(cx + s * 4, 8)
      ctx.lineTo(cx + s * 14, -1)
      ctx.lineTo(cx + s * 15, 13)
      ctx.fill()
      ctx.fillStyle = '#ffb3cc'
      ctx.beginPath()
      ctx.moveTo(cx + s * 7, 8.5)
      ctx.lineTo(cx + s * 13.3, 2.5)
      ctx.lineTo(cx + s * 13.5, 11)
      ctx.fill()
    }
  }

  // Shadow cast by the bangs, then the bangs themselves
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, 23, 15, 14, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(0.6, 2.4)
  bangsPath(ctx, cx)
  ctx.fillStyle = 'rgba(214,120,120,0.45)'
  ctx.fill()
  ctx.restore()
  bangsPath(ctx, cx)
  ctx.fillStyle = hairGrad
  ctx.fill()
  ellipse(ctx, cx - 14.5, 28, 3.2, 8.5, hairGrad)
  ellipse(ctx, cx + 14.5, 28, 3.2, 8.5, hairGrad)

  // "Angel ring" hair highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(cx, 17, 11.5, Math.PI * 1.12, Math.PI * 1.4)
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, 17, 11.5, Math.PI * 1.5, Math.PI * 1.62)
  ctx.stroke()

  // Face
  drawEye(ctx, cx - 4, 27, p)
  drawEye(ctx, cx + 8, 27, p)
  ellipse(ctx, cx - 8.5, 32, 2.8, 1.4, 'rgba(255,110,150,0.45)')
  ellipse(ctx, cx + 12, 32, 2.8, 1.4, 'rgba(255,110,150,0.45)')
  ctx.strokeStyle = 'rgba(230,80,120,0.6)'
  ctx.lineWidth = 0.6
  for (const bx of [cx - 9.5, cx + 11]) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(bx + k * 1.2, 31.2)
      ctx.lineTo(bx + k * 1.2 - 0.8, 32.8)
      ctx.stroke()
    }
  }
  ctx.strokeStyle = '#8a3a4a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx + 2.5, 32, 1.6, 0.25, Math.PI - 0.25)
  ctx.stroke()

  drawFrontProp(ctx, c, cx)

  // Front accessories
  if (has('flower')) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      ellipse(ctx, cx + 12 + Math.cos(a) * 3, 9 + Math.sin(a) * 3, 2.7, 2.7, radial(ctx, cx + 12, 9, 6, [[0, '#ffffff'], [1, '#ff9fc8']]))
    }
    ellipse(ctx, cx + 12, 9, 1.6, 1.6, '#ffe066')
  }
  if (has('ribbon')) {
    ctx.fillStyle = lin(ctx, 0, 0, 0, 12, [[0, '#ff5470'], [1, '#b3122a']])
    ctx.beginPath()
    ctx.moveTo(cx - 10, 7)
    ctx.lineTo(cx - 20, 0.5)
    ctx.lineTo(cx - 18.5, 12.5)
    ctx.closePath()
    ctx.moveTo(cx - 10, 7)
    ctx.lineTo(cx - 1.5, -0.5)
    ctx.lineTo(cx - 2.5, 12.5)
    ctx.closePath()
    ctx.fill()
    ellipse(ctx, cx - 10, 7, 2.6, 2.6, '#ff8a9a')
  }
  if (has('headband')) {
    ctx.fillStyle = '#2b2b45'
    ctx.fillRect(cx - 16, 11.5, 32, 4)
    ctx.beginPath()
    ctx.moveTo(cx - 15, 12)
    ctx.lineTo(cx - 26, 8)
    ctx.lineTo(cx - 25, 16)
    ctx.closePath()
    ctx.fill()
    roundRect(ctx, cx - 3, 10.5, 10, 6, 1.5, lin(ctx, 0, 10, 0, 17, [[0, '#ffffff'], [1, '#8f9ac0']]))
  }

  drawSkinCostume(ctx, c, cx)

  if (c.tier === 'rare') {
    ctx.fillStyle = '#9eebff'
    for (const [x, y, rot] of [
      [cx - 17, 17, 0.3],
      [cx + 18, 20, 0.9]
    ] as const) {
      star(ctx, x, y, 4, 2.2, 0.9, rot)
      ctx.fill()
    }
  }
  if (c.tier === 'epic' || c.tier === 'exclusive' || c.tier === 'legendary') {
    ctx.strokeStyle = '#ffe066'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - 12.5, 54.2)
    ctx.quadraticCurveTo(cx, 58.2, cx + 12.5, 54.2)
    ctx.stroke()
    for (const x of [cx - 6, cx, cx + 6]) ellipse(ctx, x, 44.7, 1.35, 1.35, radial(ctx, x, 44, 2, [[0, '#ffffff'], [1, '#ffd166']]))
  }
  if (c.tier === 'exclusive') {
    ctx.fillStyle = '#ffe066'
    for (const [x, y, rot] of [
      [cx - 18, 16, 0.4],
      [cx + 19, 14, 0.8],
      [cx - 17, 42, 1.2],
      [cx + 18, 40, 0.2]
    ] as const) {
      star(ctx, x, y, 4, 2.6, 1.05, rot)
      ctx.fill()
    }
    ellipse(ctx, cx, 48.5, 2.1, 2.1, radial(ctx, cx, 48, 3, [[0, '#ffffff'], [1, '#ff6b9a']]))
  }
  glossStreak(ctx, CHIBI_W, CHIBI_H)
}

function drawOutfitPattern(ctx: Ctx, cx: number, pattern: CharacterDef['pattern'], accent: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - 9, 38)
  ctx.lineTo(cx + 9, 38)
  ctx.lineTo(cx + 12, 53)
  ctx.lineTo(cx - 12, 53)
  ctx.closePath()
  ctx.clip()
  if (pattern === 'stripes') {
    for (let i = -2; i <= 2; i++) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(cx + i * 5, 37)
      ctx.lineTo(cx + i * 5 + 4, 55)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(cx + i * 5 - 0.5, 37)
      ctx.lineTo(cx + i * 5 + 3.2, 55)
      ctx.stroke()
    }
  } else if (pattern === 'waves') {
    for (const y of [42, 47, 52]) {
      ctx.beginPath()
      ctx.moveTo(cx - 13, y)
      ctx.quadraticCurveTo(cx - 5, y - 3.2, cx, y)
      ctx.quadraticCurveTo(cx + 5, y + 3.2, cx + 13, y)
      ctx.lineTo(cx + 13, y + 2.1)
      ctx.quadraticCurveTo(cx + 5, y + 5.2, cx, y + 2.1)
      ctx.quadraticCurveTo(cx - 5, y - 1.1, cx - 13, y + 2.1)
      ctx.closePath()
      ctx.fillStyle = accent
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 0.6
      ctx.stroke()
    }
  } else if (pattern === 'stars' || pattern === 'blossoms') {
    const spots = pattern === 'stars' ? [[cx - 4, 44], [cx + 5, 48], [cx, 52], [cx + 3, 41]] : [[cx - 5, 46], [cx + 4, 43], [cx + 1, 51]]
    for (const [x, y] of spots) {
      if (pattern === 'stars') {
        star(ctx, x, y, 4, 2.8, 1.15)
        ctx.fillStyle = accent
        ctx.fill()
        star(ctx, x, y, 4, 1.2, 0.45)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      } else {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.5, 0.85, a, 0, Math.PI * 2)
          ctx.fillStyle = accent
          ctx.fill()
        }
        ellipse(ctx, x, y, 0.85, 0.85, radial(ctx, x, y, 1.4, [[0, '#ffffff'], [1, '#ffe066']]))
      }
    }
  } else if (pattern === 'flames') {
    for (const x of [cx - 5, cx + 4]) {
      ctx.beginPath()
      ctx.moveTo(x, 39)
      ctx.quadraticCurveTo(x + 4, 46, x + 0.4, 53)
      ctx.quadraticCurveTo(x - 3.4, 46, x, 39)
      ctx.fillStyle = accent
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x, 43)
      ctx.quadraticCurveTo(x + 1.6, 47, x, 51)
      ctx.quadraticCurveTo(x - 1.6, 47, x, 43)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fill()
    }
  } else if (pattern === 'scales') {
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const x = cx + col * 6 + (row % 2) * 3
        const y = 42 + row * 4
        ctx.beginPath()
        ctx.arc(x, y, 2.6, 0.15, Math.PI - 0.15)
        ctx.fillStyle = accent
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0.35, Math.PI - 0.35)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 0.4
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(cx - 1, 42.5, 8.5, 2.2, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function chibiCanvas(def: CharacterDef, res = RES): HTMLCanvasElement {
  const body = outlined(paint(CHIBI_W, CHIBI_H, (ctx) => drawChibi(ctx, def), res), 1.3, res)
  const exclusive = def.tier === 'exclusive'
  const glow = exclusive
    ? '#ff6b9a'
    : def.tier === 'legendary'
      ? '#ffd166'
      : def.tier === 'epic'
        ? '#c084fc'
        : def.tier === 'rare'
          ? '#5fd3ff'
          : def.palette.accent
  return withGlow(body, glow, exclusive ? 8 : def.tier === 'legendary' || def.tier === 'epic' ? 6 : def.tier === 'rare' ? 5 : CHIBI_GLOW, res)
}

// ---------------------------------------------------------------- enemies

function yokaiEye(ctx: Ctx, x: number, y: number, s: number, iris = '#c43a62'): void {
  ellipse(ctx, x, y, s * 1.02, s * 1.22, '#fff8f4')
  ellipse(
    ctx,
    x + s * 0.06,
    y + s * 0.12,
    s * 0.58,
    s * 0.72,
    radial(ctx, x - s * 0.05, y - s * 0.1, s * 1.3, [
      [0, '#fff7ea'],
      [0.38, iris],
      [1, '#14060c']
    ])
  )
  ellipse(ctx, x + s * 0.14, y + s * 0.2, s * 0.26, s * 0.4, '#12060e')
  ellipse(ctx, x - s * 0.2, y - s * 0.4, s * 0.26, s * 0.2, '#ffffff')
  ellipse(ctx, x + s * 0.28, y + s * 0.38, s * 0.11, s * 0.11, '#ffffff')
  ctx.strokeStyle = '#1c0b26'
  ctx.lineWidth = Math.max(0.9, s * 0.28)
  ctx.beginPath()
  ctx.moveTo(x - s * 1.35, y - s * 1.05)
  ctx.lineTo(x + s * 1.15, y - s * 0.12)
  ctx.stroke()
}

function tusk(ctx: Ctx, x: number, y: number, s: number, flip = 1): void {
  ctx.fillStyle = '#fff8ee'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + flip * s * 0.35, y + s * 0.7, x + flip * s * 0.1, y + s * 1.7)
  ctx.quadraticCurveTo(x - flip * s * 0.4, y + s * 0.55, x, y)
  ctx.fill()
}

function drawIbaraki(ctx: Ctx, s: number): void {
  const c = s / 2
  const r = s * 0.36
  ctx.fillStyle = '#1a1020'
  ctx.beginPath()
  ctx.moveTo(c - r * 0.2, c - r * 0.7)
  ctx.quadraticCurveTo(c + r * 0.1, c - r * 1.7, c + r * 0.55, c - r * 0.45)
  ctx.quadraticCurveTo(c + r * 0.2, c - r * 1.05, c - r * 0.2, c - r * 0.7)
  ctx.fill()
  ellipse(ctx, c, c + r * 0.05, r * 0.72, r * 0.9, lin(ctx, c - r, c - r, c + r, c + r, [[0, '#f4efe6'], [1, '#c8b8d8']]))
  ctx.fillStyle = '#2a1840'
  ctx.beginPath()
  ctx.moveTo(c - r * 0.7, c - r * 0.2)
  ctx.quadraticCurveTo(c, c - r * 1.15, c + r * 0.85, c - r * 0.15)
  ctx.lineTo(c + r * 0.4, c + r * 0.15)
  ctx.lineTo(c - r * 0.45, c + r * 0.1)
  ctx.fill()
  yokaiEye(ctx, c - r * 0.18, c - r * 0.02, r * 0.16, '#c45cff')
  yokaiEye(ctx, c + r * 0.22, c - r * 0.02, r * 0.16, '#ffd166')
  ctx.fillStyle = '#fff'
  ctx.fillRect(c - r * 0.22, c + r * 0.28, r * 0.5, r * 0.08)
  ctx.strokeStyle = '#6b3a1c'
  ctx.lineWidth = Math.max(4, r * 0.18)
  ctx.beginPath()
  ctx.moveTo(c + r * 0.35, c + r * 0.15)
  ctx.lineTo(c + r * 1.15, c - r * 0.85)
  ctx.stroke()
  ellipse(ctx, c + r * 1.2, c - r * 0.95, r * 0.22, r * 0.16, '#5a3018')
  ctx.fillStyle = '#3a1848'
  ctx.beginPath()
  ctx.ellipse(c - r * 0.85, c + r * 0.15, r * 0.28, r * 0.18, 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawEnemy(ctx: Ctx, key: string, s: number): void {
  if (key === 'ibaraki') {
    drawIbaraki(ctx, s)
    glossStreak(ctx, s, s)
    return
  }
  drawEnemyBody(ctx, key, s)
  enemyOrnament(ctx, key, s)
  glossStreak(ctx, s, s)
}

/** Extra marks so each yokai reads as its own costume, not a plain silhouette. */
function enemyOrnament(ctx: Ctx, key: string, s: number): void {
  const c = s / 2
  const r = s * 0.34
  const spark = (x: number, y: number, col: string): void => {
    ctx.fillStyle = col
    star(ctx, x, y, 4, r * 0.12, r * 0.05)
    ctx.fill()
  }
  switch (key) {
    case 'wisp':
      spark(c - r * 0.7, c - r * 0.8, '#ffffff')
      spark(c + r * 0.75, c - r * 0.35, '#bff8ff')
      spark(c + r * 0.2, c - r * 1.15, '#fff6c8')
      return
    case 'imp':
      ellipse(ctx, c - r * 0.72, c + r * 0.05, r * 0.1, r * 0.1, '#ffd166')
      ellipse(ctx, c + r * 0.72, c + r * 0.05, r * 0.1, r * 0.1, '#ffd166')
      ctx.strokeStyle = '#5a0c14'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(c - r * 0.55, c + r * 0.72)
      ctx.lineTo(c + r * 0.55, c + r * 0.72)
      ctx.stroke()
      return
    case 'crow':
      ctx.strokeStyle = '#9a8cff'
      ctx.lineWidth = 1.2
      for (const k of [0.35, 0.55, 0.75]) {
        ctx.beginPath()
        ctx.moveTo(c - r * 1.05, c - r * k)
        ctx.quadraticCurveTo(c - r * 0.5, c - r * (k + 0.15), c - r * 0.2, c - r * k)
        ctx.stroke()
      }
      return
    case 'kasa':
      roundRect(ctx, c + r * 0.55, c + r * 0.15, r * 0.22, r * 0.42, 1, '#fffaf0')
      ctx.fillStyle = '#d8243c'
      ctx.fillRect(c + r * 0.62, c + r * 0.24, r * 0.08, r * 0.16)
      return
    case 'yurei':
      ctx.fillStyle = '#9ecbff'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.02, c + r * 0.18)
      ctx.quadraticCurveTo(c + r * 0.08, c + r * 0.45, c - r * 0.02, c + r * 0.55)
      ctx.quadraticCurveTo(c - r * 0.12, c + r * 0.4, c - r * 0.02, c + r * 0.18)
      ctx.fill()
      ellipse(ctx, c + r * 0.55, c - r * 0.55, r * 0.08, r * 0.08, '#ffd166')
      return
    case 'brute':
    case 'oniBoss':
      ellipse(ctx, c - r * 0.85, c + r * 0.35, r * 0.16, r * 0.1, key === 'oniBoss' ? '#ffd166' : '#d7e4ff')
      ctx.fillStyle = '#1c0b26'
      ctx.fillRect(c - r * 0.95, c + r * 0.32, r * 0.2, r * 0.05)
      spark(c, c - r * 1.2, key === 'oniBoss' ? '#ffe08a' : '#ffffff')
      return
    case 'spider':
      ellipse(ctx, c, c - r * 0.85, r * 0.12, r * 0.16, '#ff4f98')
      ellipse(ctx, c, c - r * 0.88, r * 0.05, r * 0.06, '#fff')
      return
    case 'kodama':
      ctx.fillStyle = '#7dce6a'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.2, c - r * 0.9)
      ctx.quadraticCurveTo(c + r * 0.7, c - r * 1.15, c + r * 0.45, c - r * 0.55)
      ctx.quadraticCurveTo(c + r * 0.15, c - r * 0.7, c + r * 0.2, c - r * 0.9)
      ctx.fill()
      return
    case 'tengu':
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(c + r * 0.7, c + r * 0.15)
      ctx.lineTo(c + r * 1.15, c - r * 0.15)
      ctx.lineTo(c + r * 0.85, c + r * 0.35)
      ctx.closePath()
      ctx.stroke()
      return
    case 'nurikabe':
      ctx.strokeStyle = 'rgba(255,209,102,0.85)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c - r * 0.7)
      ctx.lineTo(c + r * 0.05, c - r * 0.2)
      ctx.lineTo(c - r * 0.15, c + r * 0.35)
      ctx.stroke()
      return
    case 'chochin':
      spark(c + r * 0.55, c - r * 0.95, '#fff6c8')
      spark(c - r * 0.4, c - r * 0.7, '#ffb03b')
      return
    case 'kappa':
      ellipse(ctx, c, c - r * 0.95, r * 0.22, r * 0.1, '#7dffb2')
      ellipse(ctx, c, c - r * 0.95, r * 0.08, r * 0.04, '#e8fff4')
      return
    case 'nue':
      spark(c + r * 0.9, c - r * 0.7, '#c084fc')
      spark(c - r * 0.85, c - r * 0.4, '#9eebff')
      return
    case 'orochiBoss':
      for (let k = 0; k < 3; k++) ellipse(ctx, c - r * 0.2 + k * r * 0.22, c - r * 1.15, r * 0.07, r * 0.07, k === 1 ? '#ffd166' : '#ff4f7b')
      return
    case 'raijinBoss':
      ctx.strokeStyle = '#ffe066'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(c, c - r * 0.15, r * 1.05, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      spark(c, c - r * 1.25, '#fff')
      return
    case 'yukiBoss':
      spark(c - r * 0.8, c - r * 0.9, '#ffffff')
      spark(c + r * 0.7, c - r * 1.05, '#d7f4ff')
      ellipse(ctx, c, c + r * 0.95, r * 0.16, r * 0.1, '#9fd7ff')
      return
    case 'kitsuneBoss':
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.arc(c + r * 0.16, c - r * 0.72, r * 0.28, 0, Math.PI * 2)
      ctx.stroke()
      spark(c + r * 0.16, c - r * 1.15, '#ffe08a')
      return
    default:
      return
  }
}

function petExtra(ctx: Ctx, kind: PetKind): void {
  const c = 20
  switch (kind) {
    case 'fox':
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(16, 25)
      ctx.lineTo(11, 26)
      ctx.moveTo(24, 25)
      ctx.lineTo(29, 26)
      ctx.stroke()
      ellipse(ctx, 20, 28, 1.3, 0.8, '#ff6fae')
      ellipse(ctx, 32, 22, 1.4, 1.4, '#ffd166')
      break
    case 'wisp':
      star(ctx, 12, 14, 4, 2.2, 0.8)
      ctx.fillStyle = '#fff'
      ctx.fill()
      star(ctx, 28, 16, 4, 1.6, 0.6)
      ctx.fill()
      ellipse(ctx, c, 24, 2.2, 3, 'rgba(255,255,255,0.85)')
      break
    case 'neko':
      ellipse(ctx, 14, 30, 1.6, 1.1, '#ffd166')
      ctx.strokeStyle = '#fff6d0'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(15, 23)
      ctx.lineTo(11, 24)
      ctx.moveTo(25, 23)
      ctx.lineTo(29, 24)
      ctx.stroke()
      break
    case 'lantern':
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.moveTo(20, 16)
      ctx.bezierCurveTo(22, 18, 22, 22, 20, 24)
      ctx.bezierCurveTo(18, 22, 18, 18, 20, 16)
      ctx.fill()
      star(ctx, 28, 8, 4, 2, 0.7)
      ctx.fillStyle = '#ffe08a'
      ctx.fill()
      break
    case 'dragon':
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 0.8
      for (const x of [14, 18, 22]) {
        ctx.beginPath()
        ctx.arc(x, 24, 1.6, 0.2, Math.PI - 0.2)
        ctx.stroke()
      }
      ctx.strokeStyle = '#e8fff4'
      ctx.beginPath()
      ctx.moveTo(32, 16)
      ctx.quadraticCurveTo(40, 14, 39, 20)
      ctx.stroke()
      break
    case 'owl':
      ctx.strokeStyle = '#8ea0c4'
      ctx.lineWidth = 0.8
      for (const y of [26, 29]) {
        ctx.beginPath()
        ctx.moveTo(16, y)
        ctx.quadraticCurveTo(20, y + 1.4, 24, y)
        ctx.stroke()
      }
      ellipse(ctx, 20, 34, 2.2, 1.2, '#ffb03b')
      break
  }
}

function drawAshEnemy(ctx: Ctx, key: string, s: number): boolean {
  const spec = ASH[key]
  if (!spec) return false
  const c = s / 2
  const r = s * 0.34
  const fill = spec.fill
  const accent = spec.accent
  const eye = (x: number, y: number, scale = 1): void => yokaiEye(ctx, x, y, r * 0.16 * scale, accent)
  if (spec.shape === 'flame') {
    ctx.fillStyle = radial(ctx, c, c, r * 1.3, [[0, '#fff6c8'], [0.45, fill], [1, 'rgba(0,0,0,0)']])
    ctx.beginPath()
    ctx.moveTo(c, c - r * 1.3)
    ctx.quadraticCurveTo(c + r, c, c + r * 0.35, c + r)
    ctx.quadraticCurveTo(c, c + r * 0.4, c - r * 0.35, c + r)
    ctx.quadraticCurveTo(c - r, c, c, c - r * 1.3)
    ctx.fill()
    eye(c, c)
  } else if (spec.shape === 'ghost') {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(c, c - r * 0.15, r * 0.85, Math.PI, 0)
    ctx.lineTo(c + r * 0.85, c + r * 0.9)
    for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(c + r * (0.6 - k * 0.4), c + r * (k % 2 ? 0.45 : 1.15), c + r * (0.4 - k * 0.4), c + r * 0.9)
    ctx.closePath()
    ctx.fill()
    eye(c - r * 0.28, c - r * 0.1)
    eye(c + r * 0.28, c - r * 0.1)
  } else if (spec.shape === 'bird') {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(c - r * 1.3, c)
    ctx.quadraticCurveTo(c - r * 0.2, c - r * 0.8, c, c - r * 0.1)
    ctx.quadraticCurveTo(c + r * 0.2, c - r * 0.8, c + r * 1.3, c)
    ctx.quadraticCurveTo(c, c + r * 0.35, c - r * 1.3, c)
    ctx.fill()
    ellipse(ctx, c + r * 0.15, c - r * 0.05, r * 0.12, r * 0.1, accent)
  } else if (spec.shape === 'mask') {
    ellipse(ctx, c, c, r * 0.8, r * 1.05, fill)
    eye(c - r * 0.28, c - r * 0.15, 1.2)
    eye(c + r * 0.28, c - r * 0.15, 0.7)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(c, c + r * 0.35, r * 0.28, 0, Math.PI)
    ctx.fill()
  } else if (spec.shape === 'ox') {
    ellipse(ctx, c, c + r * 0.1, r * 0.7, r * 0.9, fill)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(c - r * 0.2, c - r * 0.7)
    ctx.quadraticCurveTo(c - r * 1.1, c - r * 1.5, c - r * 0.85, c - r * 0.2)
    ctx.lineTo(c - r * 0.35, c - r * 0.45)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(c + r * 0.2, c - r * 0.7)
    ctx.quadraticCurveTo(c + r * 1.1, c - r * 1.5, c + r * 0.85, c - r * 0.2)
    ctx.lineTo(c + r * 0.35, c - r * 0.45)
    ctx.fill()
    eye(c - r * 0.22, c)
    eye(c + r * 0.22, c)
  } else if (spec.shape === 'centipede') {
    for (let k = 0; k < 5; k++) ellipse(ctx, c - r * 0.9 + k * r * 0.45, c + Math.sin(k) * r * 0.12, r * 0.28, r * 0.22, k === 0 ? accent : fill)
    eye(c - r * 0.9, c, 0.8)
  } else if (spec.shape === 'tree') {
    ctx.fillStyle = fill
    ctx.fillRect(c - r * 0.12, c - r * 0.2, r * 0.24, r * 1.2)
    ctx.beginPath()
    ctx.moveTo(c, c - r * 1.3)
    ctx.lineTo(c + r * 0.7, c + r * 0.15)
    ctx.lineTo(c - r * 0.7, c + r * 0.15)
    ctx.fill()
    ellipse(ctx, c, c - r * 0.15, r * 0.1, r * 0.14, accent)
  } else if (spec.shape === 'wheel') {
    ctx.strokeStyle = fill
    ctx.lineWidth = r * 0.28
    ctx.beginPath()
    ctx.arc(c, c, r * 0.85, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = accent
    ctx.lineWidth = r * 0.08
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c, c)
      ctx.lineTo(c + Math.cos(a) * r * 0.85, c + Math.sin(a) * r * 0.85)
      ctx.stroke()
    }
    eye(c, c, 1.3)
  } else if (spec.shape === 'lantern') {
    roundRect(ctx, c - r * 0.45, c - r * 0.7, r * 0.9, r * 1.3, r * 0.2, fill)
    ellipse(ctx, c, c - r * 0.85, r * 0.12, r * 0.18, accent)
    eye(c, c, 1.1)
  } else if (spec.shape === 'woman') {
    ellipse(ctx, c, c - r * 0.35, r * 0.42, r * 0.48, fill)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(c - r * 0.7, c + r * 1.1)
    ctx.quadraticCurveTo(c, c - r * 0.1, c + r * 0.7, c + r * 1.1)
    ctx.quadraticCurveTo(c, c + r * 0.4, c - r * 0.7, c + r * 1.1)
    ctx.fill()
    ctx.fillStyle = accent
    ctx.fillRect(c - r * 0.55, c - r * 1.15, r * 1.1, r * 0.18)
    eye(c - r * 0.16, c - r * 0.4, 0.8)
    eye(c + r * 0.16, c - r * 0.4, 0.8)
  } else if (spec.shape === 'tapir') {
    ellipse(ctx, c, c + r * 0.1, r * 0.85, r * 0.55, fill)
    ellipse(ctx, c + r * 0.7, c - r * 0.15, r * 0.4, r * 0.28, fill)
    ellipse(ctx, c + r * 1.05, c - r * 0.05, r * 0.16, r * 0.1, accent)
    eye(c + r * 0.55, c - r * 0.22, 0.7)
  } else if (spec.shape === 'skeleton') {
    ellipse(ctx, c, c - r * 0.55, r * 0.55, r * 0.62, fill)
    ctx.strokeStyle = accent
    ctx.lineWidth = r * 0.08
    for (let k = 0; k < 4; k++) {
      ctx.beginPath()
      ctx.arc(c, c + r * 0.15 + k * r * 0.28, r * 0.38, 0.2, Math.PI - 0.2)
      ctx.stroke()
    }
    eye(c - r * 0.18, c - r * 0.6, 0.9)
    eye(c + r * 0.18, c - r * 0.6, 0.9)
  } else if (spec.shape === 'fox') {
    ellipse(ctx, c, c + r * 0.15, r * 0.55, r * 0.7, fill)
    ctx.fillStyle = accent
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(c + sx * r * 0.15, c - r * 0.4)
      ctx.lineTo(c + sx * r * 0.85, c - r * 1.35)
      ctx.lineTo(c + sx * r * 0.55, c - r * 0.25)
      ctx.fill()
    }
    eye(c - r * 0.18, c - r * 0.05)
    eye(c + r * 0.18, c - r * 0.05)
  } else if (spec.shape === 'blob') {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.ellipse(c, c + r * 0.15, r * 1.05, r * 0.85, 0, 0, Math.PI * 2)
    ctx.fill()
    eye(c - r * 0.3, c, 1.4)
    eye(c + r * 0.28, c - r * 0.05, 1.1)
  } else if (spec.shape === 'beast') {
    ellipse(ctx, c, c + r * 0.2, r * 0.9, r * 0.55, fill)
    ellipse(ctx, c + r * 0.55, c - r * 0.25, r * 0.48, r * 0.36, fill)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(c + r * 0.2, c - r * 0.45)
    ctx.lineTo(c + r * 0.55, c - r * 1.1)
    ctx.lineTo(c + r * 0.8, c - r * 0.35)
    ctx.fill()
    eye(c + r * 0.45, c - r * 0.3, 0.8)
  } else if (spec.shape === 'demon') {
    ellipse(ctx, c, c + r * 0.15, r * 0.72, r * 0.95, fill)
    ctx.fillStyle = accent
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(c + sx * r * 0.2, c - r * 0.85)
      ctx.quadraticCurveTo(c + sx * r * 1.15, c - r * 1.7, c + sx * r * 0.7, c - r * 0.35)
      ctx.fill()
    }
    eye(c - r * 0.22, c - r * 0.05, 1.2)
    eye(c + r * 0.22, c - r * 0.05, 1.2)
    ctx.fillStyle = '#fff'
    ctx.fillRect(c - r * 0.28, c + r * 0.28, r * 0.56, r * 0.1)
  } else if (spec.shape === 'hannya') {
    ellipse(ctx, c, c, r * 0.7, r * 0.95, fill)
    ctx.fillStyle = accent
    for (const sx of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(c + sx * r * 0.15, c - r * 0.7)
      ctx.lineTo(c + sx * r * 0.7, c - r * 1.25)
      ctx.lineTo(c + sx * r * 0.45, c - r * 0.45)
      ctx.fill()
    }
    eye(c - r * 0.22, c - r * 0.1, 1.3)
    eye(c + r * 0.22, c - r * 0.1, 1.3)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, r * 0.06)
    ctx.beginPath()
    ctx.moveTo(c - r * 0.2, c + r * 0.35)
    ctx.lineTo(c, c + r * 0.55)
    ctx.lineTo(c + r * 0.2, c + r * 0.35)
    ctx.stroke()
  }
  ashCostume(ctx, key, c, r, fill, accent)
  return true
}

/** Props and costume layers so each ash yokai has its own silhouette. */
function ashCostume(ctx: Ctx, key: string, c: number, r: number, fill: string, accent: string): void {
  const limb = (x0: number, y0: number, x1: number, y1: number, w: number): void => {
    ctx.strokeStyle = fill
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  switch (key) {
    case 'onibi':
      ellipse(ctx, c, c + r * 0.1, r * 0.28, r * 0.4, '#fff6c8')
      yokaiEye(ctx, c - r * 0.1, c, r * 0.08, '#ff2a00')
      yokaiEye(ctx, c + r * 0.1, c, r * 0.08, '#ff2a00')
      return
    case 'gaki':
      limb(c - r * 0.4, c + r * 0.1, c - r * 1.15, c + r * 0.55, r * 0.16)
      limb(c + r * 0.4, c + r * 0.1, c + r * 1.15, c + r * 0.45, r * 0.16)
      ctx.fillStyle = '#1c0b26'
      ctx.beginPath()
      ctx.ellipse(c, c + r * 0.35, r * 0.28, r * 0.18, 0, 0, Math.PI)
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath()
        ctx.moveTo(c + k * r * 0.12, c + r * 0.15)
        ctx.lineTo(c + k * r * 0.12, c + r * 0.55)
        ctx.stroke()
      }
      return
    case 'hinotori':
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(c, c - r * 0.45)
      ctx.lineTo(c - r * 0.16, c - r * 0.15)
      ctx.lineTo(c + r * 0.16, c - r * 0.15)
      ctx.fill()
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c + r * 0.15)
      ctx.quadraticCurveTo(c - r * 0.8, c + r * 0.55, c - r * 1.15, c + r * 0.15)
      ctx.stroke()
      return
    case 'hyottoko':
      ellipse(ctx, c, c - r * 0.85, r * 0.7, r * 0.22, '#c45a28')
      ctx.strokeStyle = '#6b3a1c'
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(c + r * 0.35, c + r * 0.15)
      ctx.quadraticCurveTo(c + r * 0.9, c + r * 0.35, c + r * 1.15, c + r * 0.05)
      ctx.stroke()
      ellipse(ctx, c + r * 1.15, c + r * 0.02, r * 0.1, r * 0.1, '#2a1a14')
      return
    case 'funayurei':
      ctx.fillStyle = '#3a4a58'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.9, c + r * 0.85)
      ctx.lineTo(c + r * 0.95, c + r * 0.7)
      ctx.lineTo(c + r * 0.7, c + r * 1.05)
      ctx.lineTo(c - r * 1.05, c + r * 1.1)
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(c, c + r * 0.2)
      ctx.lineTo(c - r * 0.15, c + r * 0.95)
      ctx.stroke()
      return
    case 'gozu':
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(c - r * 0.35, c - r * 0.7)
      ctx.quadraticCurveTo(c - r * 1.2, c - r * 1.5, c - r * 0.85, c - r * 0.35)
      ctx.quadraticCurveTo(c - r * 0.7, c - r * 0.9, c - r * 0.35, c - r * 0.7)
      ctx.moveTo(c + r * 0.35, c - r * 0.7)
      ctx.quadraticCurveTo(c + r * 1.2, c - r * 1.5, c + r * 0.85, c - r * 0.35)
      ctx.quadraticCurveTo(c + r * 0.7, c - r * 0.9, c + r * 0.35, c - r * 0.7)
      ctx.fill()
      ellipse(ctx, c, c + r * 0.15, r * 0.16, r * 0.1, '#ffd166')
      ctx.strokeStyle = '#5a3018'
      ctx.lineWidth = r * 0.12
      ctx.beginPath()
      ctx.moveTo(c + r * 0.5, c + r * 0.2)
      ctx.lineTo(c + r * 1.2, c - r * 0.55)
      ctx.stroke()
      return
    case 'mukade':
      for (let k = 0; k < 6; k++) {
        limb(c - r * 0.7 + k * r * 0.22, c, c - r * 1.05 + k * r * 0.28, c + (k % 2 ? r * 0.55 : -r * 0.45), r * 0.07)
      }
      ellipse(ctx, c + r * 0.85, c, r * 0.22, r * 0.16, fill)
      tusk(ctx, c + r * 0.95, c + r * 0.05, r * 0.1, 1)
      return
    case 'jubokko':
      ctx.strokeStyle = fill
      ctx.lineWidth = r * 0.1
      ctx.beginPath()
      ctx.moveTo(c - r * 0.1, c - r * 0.2)
      ctx.quadraticCurveTo(c - r * 0.8, c - r * 0.8, c - r * 1.05, c - r * 1.15)
      ctx.moveTo(c + r * 0.15, c - r * 0.3)
      ctx.quadraticCurveTo(c + r * 0.7, c - r * 0.9, c + r * 0.95, c - r * 1.2)
      ctx.stroke()
      ellipse(ctx, c, c + r * 0.15, r * 0.18, r * 0.22, '#f4efe2')
      yokaiEye(ctx, c - r * 0.06, c + r * 0.1, r * 0.06, '#ff2030')
      yokaiEye(ctx, c + r * 0.08, c + r * 0.1, r * 0.06, '#ff2030')
      return
    case 'amanojaku':
      limb(c - r * 0.3, c + r * 0.3, c - r * 0.95, c + r * 0.85, r * 0.1)
      limb(c + r * 0.3, c + r * 0.3, c + r * 0.95, c + r * 0.8, r * 0.1)
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(c, c + r * 0.35, r * 0.22, 0.15, Math.PI - 0.15)
      ctx.fill()
      return
    case 'wanyudo':
      yokaiEye(ctx, c - r * 0.22, c - r * 0.05, r * 0.14, '#1c0b26')
      yokaiEye(ctx, c + r * 0.22, c - r * 0.05, r * 0.14, '#1c0b26')
      ctx.fillStyle = '#1c0b26'
      ctx.beginPath()
      ctx.arc(c, c + r * 0.28, r * 0.16, 0.2, Math.PI - 0.2)
      ctx.fill()
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        ellipse(ctx, c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95, r * 0.1, r * 0.16, '#ffe08a')
      }
      return
    case 'hozuki':
      ctx.strokeStyle = '#6b3a1c'
      ctx.lineWidth = r * 0.06
      ctx.beginPath()
      ctx.moveTo(c, c - r * 0.7)
      ctx.lineTo(c, c - r * 1.2)
      ctx.stroke()
      ellipse(ctx, c, c - r * 1.25, r * 0.28, r * 0.12, '#3a8a28')
      ctx.fillStyle = '#fff6c8'
      ctx.fillRect(c - r * 0.08, c - r * 0.15, r * 0.16, r * 0.45)
      return
    case 'isoonna':
      ctx.strokeStyle = accent
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(c - r * 0.55, c - r * 0.9)
      ctx.quadraticCurveTo(c - r * 0.2, c + r * 0.2, c - r * 0.7, c + r * 0.7)
      ctx.moveTo(c + r * 0.5, c - r * 0.85)
      ctx.quadraticCurveTo(c + r * 0.15, c + r * 0.1, c + r * 0.65, c + r * 0.65)
      ctx.stroke()
      ellipse(ctx, c + r * 0.85, c + r * 0.35, r * 0.22, r * 0.16, '#f4efe2')
      return
    case 'baku':
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(c + r * 0.9, c)
      ctx.quadraticCurveTo(c + r * 1.35, c + r * 0.15, c + r * 1.05, c + r * 0.35)
      ctx.quadraticCurveTo(c + r * 0.85, c + r * 0.2, c + r * 0.9, c)
      ctx.fill()
      tusk(ctx, c + r * 0.55, c + r * 0.05, r * 0.12, 1)
      ellipse(ctx, c - r * 0.7, c - r * 0.35, r * 0.28, r * 0.16, 'rgba(255,255,255,0.55)')
      return
    case 'gashadokuro':
      ctx.strokeStyle = fill
      ctx.lineWidth = r * 0.1
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        ctx.arc(c, c + r * 0.05 + k * r * 0.22, r * (0.55 - k * 0.06), 0.4, Math.PI - 0.4)
        ctx.stroke()
      }
      ctx.fillStyle = accent
      ctx.fillRect(c - r * 0.22, c - r * 0.35, r * 0.12, r * 0.28)
      ctx.fillRect(c + r * 0.1, c - r * 0.35, r * 0.12, r * 0.28)
      limb(c - r * 0.45, c, c - r * 1.15, c + r * 0.7, r * 0.12)
      limb(c + r * 0.45, c, c + r * 1.2, c - r * 0.2, r * 0.12)
      return
    case 'tamamo':
      ctx.fillStyle = accent
      for (let k = 0; k < 5; k++) {
        const a = -0.8 + k * 0.4
        ctx.beginPath()
        ctx.moveTo(c, c + r * 0.35)
        ctx.quadraticCurveTo(c + Math.cos(a) * r * 0.8, c + r * 0.2, c + Math.cos(a) * r * 1.25, c - r * 0.15 + Math.sin(a) * r * 0.2)
        ctx.quadraticCurveTo(c + Math.cos(a) * r * 0.5, c + r * 0.55, c, c + r * 0.35)
        ctx.fill()
      }
      ellipse(ctx, c, c - r * 0.55, r * 0.1, r * 0.1, '#ffd166')
      return
    case 'umibozu':
      yokaiEye(ctx, c, c - r * 0.15, r * 0.28, '#041018')
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(c - r * 0.8, c + r * 0.35)
      ctx.quadraticCurveTo(c, c + r * 0.85, c + r * 0.8, c + r * 0.3)
      ctx.quadraticCurveTo(c, c + r * 0.55, c - r * 0.8, c + r * 0.35)
      ctx.fill()
      return
    case 'raiju':
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = r * 0.07
      ctx.beginPath()
      ctx.moveTo(c - r * 0.1, c - r * 0.55)
      ctx.lineTo(c + r * 0.15, c - r * 0.15)
      ctx.lineTo(c - r * 0.05, c - r * 0.1)
      ctx.lineTo(c + r * 0.35, c + r * 0.35)
      ctx.stroke()
      tusk(ctx, c + r * 0.7, c - r * 0.05, r * 0.12, 1)
      return
    case 'hannya':
      ctx.strokeStyle = '#1c0b26'
      ctx.lineWidth = r * 0.08
      ctx.beginPath()
      ctx.moveTo(c - r * 0.45, c - r * 0.35)
      ctx.quadraticCurveTo(c - r * 0.15, c - r * 0.05, c - r * 0.05, c - r * 0.4)
      ctx.moveTo(c + r * 0.45, c - r * 0.35)
      ctx.quadraticCurveTo(c + r * 0.15, c - r * 0.05, c + r * 0.05, c - r * 0.4)
      ctx.stroke()
      ctx.fillStyle = '#ffd166'
      for (const sx of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.08, c + r * 0.32)
        ctx.lineTo(c + sx * r * 0.02, c + r * 0.55)
        ctx.lineTo(c + sx * r * 0.16, c + r * 0.32)
        ctx.fill()
      }
      return
    case 'shutendoji':
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c - r * 1.05)
      ctx.quadraticCurveTo(c - r * 0.85, c - r * 1.85, c - r * 0.55, c - r * 0.55)
      ctx.quadraticCurveTo(c - r * 0.4, c - r * 1.1, c - r * 0.2, c - r * 1.05)
      ctx.moveTo(c + r * 0.2, c - r * 1.05)
      ctx.quadraticCurveTo(c + r * 0.9, c - r * 1.9, c + r * 0.6, c - r * 0.5)
      ctx.quadraticCurveTo(c + r * 0.4, c - r * 1.15, c + r * 0.2, c - r * 1.05)
      ctx.fill()
      ctx.strokeStyle = '#5a3018'
      ctx.lineWidth = r * 0.16
      ctx.beginPath()
      ctx.moveTo(c + r * 0.35, c + r * 0.15)
      ctx.lineTo(c + r * 1.25, c - r * 0.85)
      ctx.stroke()
      ellipse(ctx, c + r * 1.3, c - r * 0.95, r * 0.22, r * 0.18, '#6b3a1c')
      ctx.fillStyle = '#ffd166'
      ctx.beginPath()
      ctx.ellipse(c - r * 0.85, c + r * 0.15, r * 0.28, r * 0.16, -0.4, 0, Math.PI * 2)
      ctx.fill()
      return
    default:
      return
  }
}

const ASH: Record<string, { fill: string; accent: string; shape: 'flame' | 'ghost' | 'bird' | 'mask' | 'ox' | 'centipede' | 'tree' | 'wheel' | 'lantern' | 'woman' | 'tapir' | 'skeleton' | 'fox' | 'blob' | 'beast' | 'demon' | 'hannya' }> = {
  onibi: { fill: '#ff4a1a', accent: '#ffe08a', shape: 'flame' },
  gaki: { fill: '#8a4030', accent: '#ffd166', shape: 'ghost' },
  hinotori: { fill: '#ff8a2a', accent: '#fff6c8', shape: 'bird' },
  hyottoko: { fill: '#f4e2c0', accent: '#d8243c', shape: 'mask' },
  funayurei: { fill: '#6a90a4', accent: '#d7f4ff', shape: 'ghost' },
  gozu: { fill: '#6e2424', accent: '#f4efe2', shape: 'ox' },
  mukade: { fill: '#c43a2a', accent: '#ffd166', shape: 'centipede' },
  jubokko: { fill: '#7a1828', accent: '#ff4a4a', shape: 'tree' },
  amanojaku: { fill: '#c45a28', accent: '#ffe08a', shape: 'demon' },
  wanyudo: { fill: '#ff5a18', accent: '#fff1c2', shape: 'wheel' },
  hozuki: { fill: '#e23a3a', accent: '#ffe08a', shape: 'lantern' },
  isoonna: { fill: '#2f8f96', accent: '#e8fff8', shape: 'woman' },
  baku: { fill: '#c4a27a', accent: '#fff6e0', shape: 'tapir' },
  gashadokuro: { fill: '#f4efe2', accent: '#ff5a5a', shape: 'skeleton' },
  tamamo: { fill: '#f0c8a0', accent: '#fff', shape: 'fox' },
  umibozu: { fill: '#1e3e56', accent: '#9ad7ff', shape: 'blob' },
  raiju: { fill: '#f0d24a', accent: '#fff', shape: 'beast' },
  hannya: { fill: '#e23a55', accent: '#fff', shape: 'hannya' },
  shutendoji: { fill: '#9a1020', accent: '#ffd166', shape: 'demon' }
}

function drawEnemyBody(ctx: Ctx, key: string, s: number): void {
  if (drawAshEnemy(ctx, key, s)) return
  const c = s / 2
  const r = s * 0.34
  switch (key) {
    case 'wisp': {
      ctx.fillStyle = radial(ctx, c, c + r * 0.15, r * 1.4, [[0, '#ffffff'], [0.4, '#8ef4ff'], [1, 'rgba(30,120,255,0)']])
      ctx.beginPath()
      ctx.moveTo(c, c - r * 1.25)
      ctx.bezierCurveTo(c + r * 0.95, c - r * 0.15, c + r * 0.62, c + r * 0.85, c, c + r * 1.05)
      ctx.bezierCurveTo(c - r * 0.62, c + r * 0.85, c - r * 0.95, c - r * 0.15, c, c - r * 1.25)
      ctx.fill()
      ctx.fillStyle = '#f4feff'
      ctx.beginPath()
      ctx.moveTo(c, c - r * 0.45)
      ctx.bezierCurveTo(c + r * 0.32, c + r * 0.05, c + r * 0.22, c + r * 0.45, c, c + r * 0.58)
      ctx.bezierCurveTo(c - r * 0.22, c + r * 0.45, c - r * 0.32, c + r * 0.05, c, c - r * 0.45)
      ctx.fill()
      yokaiEye(ctx, c - r * 0.2, c + r * 0.02, r * 0.14)
      yokaiEye(ctx, c + r * 0.2, c + r * 0.02, r * 0.14)
      roundRect(ctx, c - r * 0.14, c + r * 0.78, r * 0.28, r * 0.42, 1, '#fff4d8')
      ctx.fillStyle = '#d8243c'
      ctx.fillRect(c - r * 0.05, c + r * 0.88, r * 0.1, r * 0.2)
      return
    }
    case 'imp': {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = lin(ctx, 0, c - r * 1.35, 0, c - r * 0.3, [[0, '#fff1c4'], [1, '#c42828']])
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.22, c - r * 0.35)
        ctx.quadraticCurveTo(c + sx * r * 1.05, c - r * 1.4, c + sx * r * 0.48, c - r * 1.22)
        ctx.quadraticCurveTo(c + sx * r * 0.72, c - r * 0.65, c + sx * r * 0.42, c - r * 0.25)
        ctx.fill()
        ellipse(ctx, c + sx * r * 0.55, c - r * 1.15, r * 0.08, r * 0.08, '#ffd166')
      }
      ellipse(ctx, c, c + r * 0.08, r * 0.9, r * 0.86, radial(ctx, c - r * 0.25, c - r * 0.25, r * 1.4, [[0, '#ff8a78'], [1, '#9a1420']]))
      shadeBody(ctx, c, c + r * 0.08, r * 0.9, r * 0.86)
      roundRect(ctx, c - r * 0.72, c - r * 0.22, r * 1.44, r * 0.14, r * 0.06, '#5a0c14')
      yokaiEye(ctx, c - r * 0.28, c - r * 0.02, r * 0.16)
      yokaiEye(ctx, c + r * 0.28, c - r * 0.02, r * 0.16)
      tusk(ctx, c - r * 0.16, c + r * 0.28, r * 0.16, -1)
      tusk(ctx, c + r * 0.16, c + r * 0.28, r * 0.16, 1)
      ctx.fillStyle = '#1c0b26'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.32, c + r * 0.55)
      ctx.lineTo(c, c + r * 1.02)
      ctx.lineTo(c + r * 0.32, c + r * 0.55)
      ctx.fill()
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(c - r * 0.36, c + r * 0.5, r * 0.72, r * 0.07)
      return
    }
    case 'crow': {
      ctx.fillStyle = lin(ctx, c - r, c - r, c + r, c + r, [[0, '#6a54a8'], [1, '#1a142c']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.1, c)
      ctx.quadraticCurveTo(c - r * 1.35, c - r * 0.9, c - r * 1.2, c - r * 0.15)
      ctx.quadraticCurveTo(c - r * 0.7, c + r * 0.15, c - r * 0.15, c + r * 0.15)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c - r * 0.15)
      ctx.lineTo(c - r * 0.55, c - r * 1.2)
      ctx.lineTo(c + r * 0.15, c - r * 0.25)
      ctx.fill()
      ellipse(ctx, c + r * 0.05, c + r * 0.05, r * 0.72, r * 0.58, lin(ctx, 0, c - r * 0.5, 0, c + r * 0.6, [[0, '#4a3a78'], [1, '#1c1430']]))
      shadeBody(ctx, c + r * 0.05, c + r * 0.05, r * 0.72, r * 0.58)
      roundRect(ctx, c + r * 0.15, c - r * 0.72, r * 0.55, r * 0.16, 1, '#1c0b26')
      ctx.fillStyle = lin(ctx, 0, c - r * 0.2, 0, c + r * 0.15, [[0, '#ffe08a'], [1, '#e07020']])
      ctx.beginPath()
      ctx.moveTo(c + r * 0.55, c - r * 0.12)
      ctx.lineTo(c + r * 1.25, c + r * 0.02)
      ctx.lineTo(c + r * 0.55, c + r * 0.16)
      ctx.fill()
      ellipse(ctx, c + r * 0.42, c - r * 0.22, r * 0.13, r * 0.13, '#ff3355')
      ellipse(ctx, c + r * 0.45, c - r * 0.24, r * 0.05, r * 0.05, '#ffffff')
      return
    }
    case 'kasa': {
      ctx.strokeStyle = '#6b3a1c'
      ctx.lineWidth = Math.max(2, r * 0.12)
      ctx.beginPath()
      ctx.moveTo(c, c + r * 0.15)
      ctx.lineTo(c, c + r * 1.05)
      ctx.stroke()
      roundRect(ctx, c - r * 0.28, c + r * 0.98, r * 0.56, r * 0.16, 2, '#5a3018')
      ctx.fillStyle = lin(ctx, 0, c - r, 0, c + r * 0.3, [[0, '#f0c8ff'], [0.45, '#b45cff'], [1, '#5a2088']])
      ctx.beginPath()
      ctx.moveTo(c - r * 1.15, c + r * 0.28)
      ctx.quadraticCurveTo(c, c - r * 1.25, c + r * 1.15, c + r * 0.28)
      ctx.quadraticCurveTo(c + r * 0.4, c + r * 0.05, c, c + r * 0.22)
      ctx.quadraticCurveTo(c - r * 0.4, c + r * 0.05, c - r * 1.15, c + r * 0.28)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,209,102,0.8)'
      ctx.lineWidth = 1.1
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath()
        ctx.moveTo(c, c - r * 0.85)
        ctx.lineTo(c - r * 1.05 + k * r * 0.42, c + r * 0.18)
        ctx.stroke()
      }
      ellipse(ctx, c, c - r * 0.15, r * 0.38, r * 0.42, '#fffaf0')
      ellipse(ctx, c + r * 0.06, c - r * 0.12, r * 0.2, r * 0.28, radial(ctx, c, c - r * 0.2, r * 0.3, [[0, '#3a0848'], [1, '#e040c8']]))
      ellipse(ctx, c - r * 0.02, c - r * 0.22, r * 0.07, r * 0.07, '#ffffff')
      ctx.fillStyle = '#ff4f7b'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.28, c + r * 0.12)
      ctx.quadraticCurveTo(c + r * 0.15, c + r * 0.7, c + r * 0.48, c + r * 0.22)
      ctx.fill()
      return
    }
    case 'yurei': {
      ctx.fillStyle = lin(ctx, 0, c - r * 0.8, 0, c + r, [[0, '#f7fbff'], [1, 'rgba(190,210,240,0.35)']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.85, c - r * 0.15)
      ctx.lineTo(c - r * 0.95, c + r * 0.85)
      ctx.quadraticCurveTo(c - r * 0.4, c + r * 1.15, c, c + r * 0.7)
      ctx.quadraticCurveTo(c + r * 0.45, c + r * 1.2, c + r * 0.95, c + r * 0.85)
      ctx.lineTo(c + r * 0.85, c - r * 0.15)
      ctx.quadraticCurveTo(c, c - r * 0.45, c - r * 0.85, c - r * 0.15)
      ctx.fill()
      ctx.fillStyle = '#d8243c'
      ctx.fillRect(c - r * 0.7, c + r * 0.05, r * 1.4, r * 0.08)
      ctx.fillStyle = lin(ctx, 0, c - r, 0, c + r * 0.2, [[0, '#2a2148'], [1, '#0c0814']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.9, c - r * 0.2)
      ctx.quadraticCurveTo(c, c - r * 1.25, c + r * 0.9, c - r * 0.15)
      ctx.lineTo(c + r * 0.55, c + r * 0.55)
      ctx.lineTo(c - r * 0.15, c + r * 0.15)
      ctx.lineTo(c - r * 0.7, c + r * 0.7)
      ctx.closePath()
      ctx.fill()
      ellipse(ctx, c - r * 0.08, c - r * 0.05, r * 0.1, r * 0.16, '#101018')
      ellipse(ctx, c + r * 0.28, c - r * 0.02, r * 0.1, r * 0.16, '#101018')
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.12, c - r * 0.72)
      ctx.lineTo(c + r * 0.08, c - r * 1.02)
      ctx.lineTo(c + r * 0.28, c - r * 0.7)
      ctx.fill()
      ellipse(ctx, c - r * 0.72, c + r * 0.35, r * 0.14, r * 0.1, '#f4f7ff')
      ellipse(ctx, c + r * 0.7, c + r * 0.38, r * 0.14, r * 0.1, '#f4f7ff')
      return
    }
    case 'brute':
    case 'oniBoss': {
      const boss = key === 'oniBoss'
      const skin = boss ? ['#ff7a6a', '#8e1018'] : ['#8eb6ff', '#1e4eb8']
      if (boss) {
        ctx.strokeStyle = 'rgba(255,209,102,0.9)'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.arc(c, c, r * 1.18, Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
      }
      for (const sx of [-1, 1]) {
        ctx.fillStyle = lin(ctx, 0, c - r * 1.45, 0, c - r * 0.4, boss ? [[0, '#fff6c8'], [1, '#c4891a']] : [[0, '#f4efe2'], [1, '#c8b48a']])
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.28, c - r * 0.55)
        ctx.quadraticCurveTo(c + sx * r * 0.15, c - r * 1.15, c + sx * r * 0.72, c - r * 1.35)
        ctx.quadraticCurveTo(c + sx * r * 0.95, c - r * 0.7, c + sx * r * 0.55, c - r * 0.4)
        ctx.fill()
      }
      ctx.fillStyle = lin(ctx, 0, c - r * 1.1, 0, c - r * 0.4, [[0, '#3a3048'], [1, '#1a1424']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.7, c - r * 0.35)
      ctx.quadraticCurveTo(c, c - r * 1.05, c + r * 0.7, c - r * 0.35)
      ctx.lineTo(c + r * 0.55, c - r * 0.15)
      ctx.quadraticCurveTo(c, c - r * 0.7, c - r * 0.55, c - r * 0.15)
      ctx.fill()
      ellipse(ctx, c, c - r * 0.72, r * 0.16, r * 0.22, '#ffd166')
      ellipse(ctx, c, c + r * 0.12, r * 0.95, r * 0.82, radial(ctx, c - r * 0.3, c - r * 0.2, r * 1.5, [[0, skin[0]], [1, skin[1]]]))
      shadeBody(ctx, c, c + r * 0.12, r * 0.95, r * 0.82)
      ctx.strokeStyle = '#6b3a1c'
      ctx.lineWidth = Math.max(3, r * 0.16)
      ctx.beginPath()
      ctx.moveTo(c + r * 0.15, c + r * 0.35)
      ctx.lineTo(c + r * 0.85, c - r * 0.55)
      ctx.stroke()
      ellipse(ctx, c + r * 0.95, c - r * 0.62, r * 0.22, r * 0.22, '#5a3018')
      for (let k = 0; k < 4; k++) ellipse(ctx, c + r * 0.95, c - r * 0.62, r * (0.08 + k * 0.03), r * 0.04, k % 2 ? '#3a2010' : '#8a5a32')
      const stripe = ctx.createLinearGradient(c - r, 0, c + r, 0)
      for (let k = 0; k <= 8; k++) stripe.addColorStop(k / 8, k % 2 ? '#1c0b26' : '#ffcc33')
      ctx.fillStyle = stripe
      ctx.beginPath()
      ctx.ellipse(c, c + r * 0.62, r * 0.78, r * 0.28, 0, 0, Math.PI)
      ctx.fill()
      yokaiEye(ctx, c - r * 0.3, c - r * 0.02, r * 0.15)
      yokaiEye(ctx, c + r * 0.3, c - r * 0.02, r * 0.15)
      tusk(ctx, c - r * 0.18, c + r * 0.22, r * 0.14, -1)
      tusk(ctx, c + r * 0.18, c + r * 0.22, r * 0.14, 1)
      return
    }
    case 'spider': {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 1
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        ctx.arc(c, c, r * (0.35 + k * 0.28), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.strokeStyle = '#2a1038'
      ctx.lineWidth = Math.max(1.6, r * 0.07)
      for (let k = 0; k < 4; k++) {
        for (const sx of [-1, 1]) {
          const y0 = c - r * 0.25 + k * r * 0.2
          ctx.beginPath()
          ctx.moveTo(c + sx * r * 0.2, y0)
          ctx.lineTo(c + sx * r * 0.75, y0 - r * 0.45)
          ctx.lineTo(c + sx * r * 1.15, y0 + r * 0.35)
          ctx.stroke()
        }
      }
      ellipse(ctx, c - r * 0.28, c + r * 0.12, r * 0.62, r * 0.5, radial(ctx, c - r * 0.4, c, r, [[0, '#e0a0ff'], [1, '#4a1478']]))
      shadeBody(ctx, c - r * 0.28, c + r * 0.12, r * 0.62, r * 0.5)
      ctx.fillStyle = '#ffd166'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.28, c + r * 0.02)
      ctx.lineTo(c - r * 0.12, c + r * 0.22)
      ctx.lineTo(c - r * 0.28, c + r * 0.28)
      ctx.lineTo(c - r * 0.44, c + r * 0.22)
      ctx.fill()
      ellipse(ctx, c + r * 0.42, c - r * 0.08, r * 0.38, r * 0.4, '#f6e6ff')
      ctx.fillStyle = lin(ctx, 0, c - r * 0.5, 0, c, [[0, '#2a1030'], [1, '#140818']])
      ctx.beginPath()
      ctx.arc(c + r * 0.42, c - r * 0.12, r * 0.4, Math.PI * 1.05, Math.PI * 1.95)
      ctx.fill()
      yokaiEye(ctx, c + r * 0.28, c - r * 0.05, r * 0.1)
      yokaiEye(ctx, c + r * 0.55, c - r * 0.05, r * 0.1)
      ctx.fillStyle = '#ff4f7b'
      ctx.fillRect(c + r * 0.32, c + r * 0.12, r * 0.2, r * 0.05)
      return
    }
    case 'kodama': {
      ellipse(ctx, c - r * 0.45, c + r * 0.85, r * 0.28, r * 0.12, '#4a3018')
      ellipse(ctx, c + r * 0.4, c + r * 0.88, r * 0.22, r * 0.1, '#4a3018')
      roundRect(ctx, c - r * 0.55, c - r * 0.35, r * 1.1, r * 1.25, r * 0.2, lin(ctx, c - r, c - r, c + r, c + r, [[0, '#c4a06a'], [1, '#5a3818']]))
      ctx.strokeStyle = 'rgba(40,20,8,0.45)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c - r * 0.3)
      ctx.quadraticCurveTo(c - r * 0.05, c + r * 0.3, c - r * 0.28, c + r * 0.8)
      ctx.moveTo(c + r * 0.25, c - r * 0.2)
      ctx.quadraticCurveTo(c + r * 0.1, c + r * 0.2, c + r * 0.3, c + r * 0.75)
      ctx.stroke()
      ctx.fillStyle = '#2f8a38'
      ctx.beginPath()
      ctx.moveTo(c, c - r * 1.15)
      ctx.quadraticCurveTo(c + r * 0.7, c - r * 0.55, c + r * 0.1, c - r * 0.25)
      ctx.quadraticCurveTo(c - r * 0.15, c - r * 0.7, c, c - r * 1.15)
      ctx.fill()
      ctx.fillStyle = '#7dff9a'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.15, c - r * 0.7)
      ctx.quadraticCurveTo(c + r * 0.7, c - r * 0.85, c + r * 0.35, c - r * 0.35)
      ctx.fill()
      yokaiEye(ctx, c - r * 0.2, c + r * 0.15, r * 0.13)
      yokaiEye(ctx, c + r * 0.22, c + r * 0.15, r * 0.13)
      return
    }
    case 'tengu': {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = lin(ctx, 0, c - r * 0.8, 0, c + r * 0.4, [[0, '#ffb199'], [1, '#9a241c']])
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.15, c - r * 0.05)
        ctx.quadraticCurveTo(c + sx * r * 0.7, c - r * 0.85, c + sx * r * 1.2, c - r * 0.35)
        ctx.lineTo(c + sx * r * 1.05, c + r * 0.15)
        ctx.lineTo(c + sx * r * 0.55, c + r * 0.05)
        ctx.quadraticCurveTo(c + sx * r * 0.35, c + r * 0.2, c + sx * r * 0.12, c + r * 0.1)
        ctx.fill()
      }
      ellipse(ctx, c, c + r * 0.12, r * 0.7, r * 0.72, radial(ctx, c, c - r * 0.2, r, [[0, '#ff7a62'], [1, '#a01820']]))
      shadeBody(ctx, c, c + r * 0.12, r * 0.7, r * 0.72)
      roundRect(ctx, c - r * 0.42, c - r * 0.95, r * 0.84, r * 0.22, 2, '#1c0b26')
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(c - r * 0.18, c - r * 0.78, r * 0.36, r * 0.06)
      ctx.fillStyle = '#ffe1b0'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.1, c + r * 0.05)
      ctx.lineTo(c, c + r * 0.85)
      ctx.lineTo(c + r * 0.1, c + r * 0.05)
      ctx.fill()
      yokaiEye(ctx, c - r * 0.2, c - r * 0.08, r * 0.11)
      yokaiEye(ctx, c + r * 0.2, c - r * 0.08, r * 0.11)
      ctx.fillStyle = '#fff6e8'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.85, c + r * 0.15)
      ctx.lineTo(c + r * 1.15, c - r * 0.15)
      ctx.lineTo(c + r * 0.7, c + r * 0.35)
      ctx.closePath()
      ctx.fill()
      return
    }
    case 'nurikabe': {
      roundRect(ctx, c - r * 0.95, c - r * 0.15, r * 1.9, r * 0.85, r * 0.08, lin(ctx, 0, c, 0, c + r, [[0, '#d5dde8'], [1, '#6d7c90']]))
      roundRect(ctx, c - r * 0.7, c - r * 0.85, r * 1.15, r * 0.75, r * 0.08, lin(ctx, 0, c - r, 0, c, [[0, '#f2f6fb'], [1, '#8b98ab']]))
      ctx.fillStyle = '#3f8f6a'
      ctx.beginPath()
      ctx.ellipse(c - r * 0.2, c - r * 0.82, r * 0.35, r * 0.12, -0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(30,40,55,0.55)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(c - r * 0.15, c - r * 0.7)
      ctx.lineTo(c + r * 0.05, c - r * 0.2)
      ctx.moveTo(c + r * 0.35, c + r * 0.05)
      ctx.lineTo(c + r * 0.1, c + r * 0.6)
      ctx.stroke()
      yokaiEye(ctx, c - r * 0.28, c - r * 0.42, r * 0.12)
      yokaiEye(ctx, c + r * 0.22, c - r * 0.38, r * 0.12)
      ctx.strokeStyle = '#1c2433'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(c - r * 0.22, c + r * 0.28)
      ctx.lineTo(c - r * 0.05, c + r * 0.42)
      ctx.lineTo(c + r * 0.12, c + r * 0.3)
      ctx.lineTo(c + r * 0.28, c + r * 0.46)
      ctx.stroke()
      return
    }
    case 'chochin': {
      ctx.strokeStyle = '#5a3418'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(c - r * 0.2, c - r * 1.15)
      ctx.quadraticCurveTo(c, c - r * 1.35, c + r * 0.2, c - r * 1.15)
      ctx.moveTo(c, c - r * 1.15)
      ctx.lineTo(c, c - r * 0.82)
      ctx.stroke()
      roundRect(ctx, c - r * 0.48, c - r * 0.88, r * 0.96, r * 0.16, 2, '#3a2412')
      ctx.fillStyle = lin(ctx, 0, c - r * 0.6, 0, c + r * 0.7, [[0, '#fff6d0'], [0.5, '#ffb347'], [1, '#e25820']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.48, c - r * 0.72)
      ctx.quadraticCurveTo(c - r * 0.95, c + r * 0.05, c - r * 0.38, c + r * 0.62)
      ctx.lineTo(c + r * 0.38, c + r * 0.62)
      ctx.quadraticCurveTo(c + r * 0.95, c + r * 0.05, c + r * 0.48, c - r * 0.72)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(90,30,8,0.4)'
      ctx.lineWidth = 1.2
      for (let k = 0; k < 4; k++) {
        ctx.beginPath()
        ctx.moveTo(c - r * 0.7, c - r * 0.45 + k * r * 0.24)
        ctx.quadraticCurveTo(c, c - r * 0.28 + k * r * 0.24, c + r * 0.7, c - r * 0.45 + k * r * 0.24)
        ctx.stroke()
      }
      roundRect(ctx, c - r * 0.42, c + r * 0.55, r * 0.84, r * 0.14, 2, '#3a2412')
      yokaiEye(ctx, c - r * 0.16, c - r * 0.05, r * 0.12)
      ctx.fillStyle = '#2a1208'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.28, c + r * 0.22)
      ctx.quadraticCurveTo(c, c + r * 0.55, c + r * 0.28, c + r * 0.22)
      ctx.lineTo(c + r * 0.16, c + r * 0.32)
      ctx.lineTo(c - r * 0.16, c + r * 0.32)
      ctx.fill()
      ctx.fillStyle = '#fff6ea'
      for (const x of [-0.12, 0, 0.12]) ctx.fillRect(c + r * x - r * 0.03, c + r * 0.24, r * 0.06, r * 0.08)
      ctx.fillStyle = '#ff5a6a'
      ctx.beginPath()
      ctx.moveTo(c - r * 0.1, c + r * 0.34)
      ctx.quadraticCurveTo(c, c + r * 0.58, c + r * 0.1, c + r * 0.34)
      ctx.fill()
      return
    }
    case 'kappa': {
      ellipse(ctx, c - r * 0.15, c + r * 0.2, r * 0.7, r * 0.55, lin(ctx, 0, c - r * 0.2, 0, c + r * 0.8, [[0, '#7a8a3a'], [1, '#3a4a18']]))
      ctx.strokeStyle = '#243010'
      ctx.lineWidth = 1.2
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.beginPath()
          ctx.ellipse(c - r * 0.45 + col * r * 0.28, c + r * 0.05 + row * r * 0.28, r * 0.12, r * 0.1, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ellipse(ctx, c + r * 0.15, c + r * 0.15, r * 0.72, r * 0.68, radial(ctx, c, c - r * 0.1, r, [[0, '#b6ff8a'], [1, '#147848']]))
      shadeBody(ctx, c + r * 0.15, c + r * 0.15, r * 0.72, r * 0.68)
      ellipse(ctx, c + r * 0.15, c - r * 0.55, r * 0.48, r * 0.16, lin(ctx, 0, c - r * 0.75, 0, c - r * 0.35, [[0, '#f4fff8'], [1, '#5ae0a0']]))
      ctx.strokeStyle = '#147848'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.ellipse(c + r * 0.15, c - r * 0.55, r * 0.28, r * 0.08, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#f4e2b0'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.02, c + r * 0.12)
      ctx.lineTo(c + r * 0.15, c + r * 0.48)
      ctx.lineTo(c + r * 0.28, c + r * 0.12)
      ctx.fill()
      yokaiEye(ctx, c - r * 0.05, c + r * 0.02, r * 0.1)
      yokaiEye(ctx, c + r * 0.32, c + r * 0.02, r * 0.1)
      ctx.fillStyle = '#8ae07a'
      ctx.beginPath()
      ctx.moveTo(c + r * 0.7, c + r * 0.35)
      ctx.lineTo(c + r * 1.05, c + r * 0.2)
      ctx.lineTo(c + r * 1.0, c + r * 0.45)
      ctx.lineTo(c + r * 0.72, c + r * 0.5)
      ctx.fill()
      return
    }
    case 'nue': {
      ctx.fillStyle = 'rgba(210,190,255,0.35)'
      ctx.beginPath()
      ctx.ellipse(c, c + r * 0.1, r * 1.15, r * 0.55, -0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = lin(ctx, c, c - r * 0.2, c + r, c + r * 0.6, [[0, '#ffb03b'], [1, '#1c0b26']])
      ctx.beginPath()
      ctx.moveTo(c + r * 0.1, c)
      ctx.quadraticCurveTo(c + r * 0.8, c - r * 0.5, c + r * 1.15, c + r * 0.15)
      ctx.quadraticCurveTo(c + r * 0.7, c + r * 0.35, c + r * 0.2, c + r * 0.25)
      ctx.fill()
      ctx.strokeStyle = '#1c0b26'
      ctx.lineWidth = 1.4
      for (const y of [0.05, 0.18]) {
        ctx.beginPath()
        ctx.moveTo(c + r * 0.35, c + r * y)
        ctx.quadraticCurveTo(c + r * 0.7, c + r * (y - 0.15), c + r * 1.0, c + r * y)
        ctx.stroke()
      }
      ellipse(ctx, c - r * 0.15, c + r * 0.05, r * 0.55, r * 0.5, radial(ctx, c - r * 0.3, c - r * 0.1, r, [[0, '#d8c4ff'], [1, '#4a2e86']]))
      shadeBody(ctx, c - r * 0.15, c + r * 0.05, r * 0.55, r * 0.5)
      ellipse(ctx, c - r * 0.42, c - r * 0.28, r * 0.16, r * 0.18, '#3a2468')
      ellipse(ctx, c + r * 0.12, c - r * 0.28, r * 0.16, r * 0.18, '#3a2468')
      yokaiEye(ctx, c - r * 0.28, c - r * 0.02, r * 0.1)
      yokaiEye(ctx, c + r * 0.02, c, r * 0.1)
      ctx.strokeStyle = '#2a1848'
      ctx.lineWidth = Math.max(3, r * 0.14)
      ctx.beginPath()
      ctx.moveTo(c + r * 0.35, c + r * 0.25)
      ctx.quadraticCurveTo(c + r * 0.9, c + r * 0.85, c + r * 0.4, c + r * 1.05)
      ctx.stroke()
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(c + r * 0.55, c + r * 0.55)
      ctx.quadraticCurveTo(c + r * 0.75, c + r * 0.8, c + r * 0.48, c + r * 0.95)
      ctx.stroke()
      return
    }
    case 'orochiBoss': {
      ctx.strokeStyle = 'rgba(255,209,102,0.75)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(c, c + r * 0.15, r * 1.2, 0.3, Math.PI - 0.3)
      ctx.stroke()
      for (let k = 0; k < 6; k++) {
        const y = c + r * 0.15 + k * r * 0.08
        ellipse(ctx, c, y, r * (1.05 - k * 0.08), r * 0.32, k % 2 ? '#145c32' : '#3cb86a')
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(c, y, r * (0.7 - k * 0.05), r * 0.12, 0, Math.PI, 0)
        ctx.stroke()
      }
      for (const sx of [-0.72, 0, 0.72]) {
        ctx.fillStyle = '#e8ffe0'
        ctx.beginPath()
        ctx.moveTo(c + r * sx - r * 0.18, c - r * 0.55)
        ctx.lineTo(c + r * sx, c - r * 0.95)
        ctx.lineTo(c + r * sx + r * 0.18, c - r * 0.55)
        ctx.fill()
        ellipse(ctx, c + r * sx, c - r * 0.28, r * 0.34, r * 0.38, radial(ctx, c + r * sx, c - r * 0.45, r * 0.5, [[0, '#c8ffb0'], [1, '#0e5a28']]))
        yokaiEye(ctx, c + r * sx - r * 0.1, c - r * 0.32, r * 0.07)
        yokaiEye(ctx, c + r * sx + r * 0.1, c - r * 0.32, r * 0.07)
        ctx.fillStyle = '#ff4060'
        ctx.beginPath()
        ctx.moveTo(c + r * sx - r * 0.08, c - r * 0.08)
        ctx.quadraticCurveTo(c + r * sx, c + r * 0.18, c + r * sx + r * 0.08, c - r * 0.08)
        ctx.fill()
        tusk(ctx, c + r * sx - r * 0.08, c - r * 0.08, r * 0.06, -1)
        tusk(ctx, c + r * sx + r * 0.08, c - r * 0.08, r * 0.06, 1)
      }
      return
    }
    case 'raijinBoss': {
      for (const sx of [-1, 1]) {
        ellipse(ctx, c + sx * r * 0.85, c + r * 0.2, r * 0.42, r * 0.42, lin(ctx, 0, c - r * 0.1, 0, c + r * 0.6, [[0, '#fff6d0'], [1, '#d09030']]))
        ellipse(ctx, c + sx * r * 0.85, c + r * 0.2, r * 0.22, r * 0.22, '#6a2808')
        ctx.strokeStyle = '#fff6c8'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(c + sx * r * 0.85, c + r * 0.2, r * 0.3, 0.4, Math.PI * 1.2)
        ctx.stroke()
        ctx.fillStyle = lin(ctx, 0, c - r * 1.2, 0, c - r * 0.3, [[0, '#fff6c8'], [1, '#e0a020']])
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.15, c - r * 0.45)
        ctx.lineTo(c + sx * r * 0.55, c - r * 1.25)
        ctx.lineTo(c + sx * r * 0.72, c - r * 0.35)
        ctx.fill()
      }
      ellipse(ctx, c, c + r * 0.12, r * 0.78, r * 0.74, radial(ctx, c - r * 0.2, c - r * 0.15, r, [[0, '#ffe08a'], [1, '#b04010']]))
      shadeBody(ctx, c, c + r * 0.12, r * 0.78, r * 0.74)
      ctx.strokeStyle = '#6b3a1c'
      ctx.lineWidth = Math.max(2.4, r * 0.1)
      ctx.beginPath()
      ctx.moveTo(c - r * 0.9, c + r * 0.55)
      ctx.lineTo(c - r * 0.35, c - r * 0.15)
      ctx.moveTo(c + r * 0.9, c + r * 0.55)
      ctx.lineTo(c + r * 0.35, c - r * 0.15)
      ctx.stroke()
      yokaiEye(ctx, c - r * 0.22, c - r * 0.02, r * 0.12)
      yokaiEye(ctx, c + r * 0.22, c - r * 0.02, r * 0.12)
      tusk(ctx, c - r * 0.12, c + r * 0.22, r * 0.1, -1)
      tusk(ctx, c + r * 0.12, c + r * 0.22, r * 0.1, 1)
      return
    }
    case 'yukiBoss': {
      ctx.fillStyle = lin(ctx, 0, c - r, 0, c + r, [[0, '#ffffff'], [1, '#b7dcff']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.35, c - r * 0.2)
      ctx.lineTo(c - r * 0.95, c + r * 0.95)
      ctx.lineTo(c + r * 0.95, c + r * 0.95)
      ctx.lineTo(c + r * 0.35, c - r * 0.2)
      ctx.closePath()
      ctx.fill()
      for (const sx of [-1, 1]) {
        ctx.fillStyle = lin(ctx, 0, c - r * 0.1, 0, c + r * 0.8, [[0, '#f4fbff'], [1, '#9fd0ff']])
        ctx.beginPath()
        ctx.moveTo(c + sx * r * 0.2, c - r * 0.05)
        ctx.quadraticCurveTo(c + sx * r * 1.15, c + r * 0.15, c + sx * r * 0.85, c + r * 0.85)
        ctx.lineTo(c + sx * r * 0.35, c + r * 0.15)
        ctx.fill()
      }
      ctx.strokeStyle = '#7ec8ff'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(c - r * 0.7, c + r * 0.9)
      ctx.lineTo(c + r * 0.7, c + r * 0.9)
      ctx.stroke()
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? '#d7f4ff' : '#ffffff'
        ctx.beginPath()
        ctx.moveTo(c - r * 0.4 + k * r * 0.18, c - r * 0.35)
        ctx.lineTo(c - r * 0.55 + k * r * 0.22, c - r * 1.15)
        ctx.lineTo(c - r * 0.22 + k * r * 0.18, c - r * 0.4)
        ctx.fill()
      }
      ellipse(ctx, c, c + r * 0.02, r * 0.4, r * 0.46, '#f7fbff')
      ctx.fillStyle = '#9fd4ff'
      star(ctx, c, c - r * 0.72, 6, r * 0.16, r * 0.07)
      ctx.fill()
      ellipse(ctx, c - r * 0.12, c - r * 0.02, r * 0.05, r * 0.1, '#1c4b73')
      ellipse(ctx, c + r * 0.12, c - r * 0.02, r * 0.05, r * 0.1, '#1c4b73')
      ctx.fillStyle = '#7ec8ff'
      ctx.fillRect(c - r * 0.1, c + r * 0.16, r * 0.2, r * 0.045)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(c, c + r * 0.35)
      ctx.lineTo(c, c + r * 0.7)
      ctx.moveTo(c - r * 0.12, c + r * 0.5)
      ctx.lineTo(c + r * 0.12, c + r * 0.5)
      ctx.stroke()
      return
    }
    case 'kitsuneBoss': {
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (0.62 + (k / 8) * 0.76)
        const tx = c - r * 0.15 + Math.cos(a) * r * 1.05
        const ty = c + Math.sin(a) * r * 0.9
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(a + Math.PI / 2)
        ellipse(ctx, 0, 0, r * 0.16, r * 0.4, lin(ctx, 0, r * 0.4, 0, -r * 0.4, [[0, '#f4eadc'], [1, '#ffffff']]))
        ellipse(ctx, 0, -r * 0.32, r * 0.1, r * 0.12, radial(ctx, 0, -r * 0.32, r * 0.14, [[0, '#ffe066'], [1, '#ff6a2b']]))
        ctx.restore()
      }
      ctx.fillStyle = lin(ctx, 0, c, 0, c + r, [[0, '#fffaf4'], [1, '#e4d2bc']])
      ctx.beginPath()
      ctx.moveTo(c - r * 0.28, c + r * 0.15)
      ctx.lineTo(c - r * 0.55, c + r * 0.85)
      ctx.lineTo(c + r * 0.15, c + r * 0.85)
      ctx.lineTo(c + r * 0.05, c + r * 0.15)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#d8243c'
      ctx.fillRect(c - r * 0.4, c + r * 0.78, r * 0.5, r * 0.06)
      ellipse(ctx, c + r * 0.15, c - r * 0.15, r * 0.48, r * 0.42, '#fffaf4')
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(c + r * 0.15 + sx * r * 0.12, c - r * 0.45)
        ctx.lineTo(c + r * 0.15 + sx * r * 0.42, c - r * 1.05)
        ctx.lineTo(c + r * 0.15 + sx * r * 0.48, c - r * 0.35)
        ctx.fill()
        ctx.fillStyle = '#ff8aa8'
        ctx.beginPath()
        ctx.moveTo(c + r * 0.15 + sx * r * 0.2, c - r * 0.48)
        ctx.lineTo(c + r * 0.15 + sx * r * 0.38, c - r * 0.9)
        ctx.lineTo(c + r * 0.15 + sx * r * 0.4, c - r * 0.42)
        ctx.fill()
      }
      ctx.strokeStyle = '#e0243c'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(c - r * 0.02, c - r * 0.28)
      ctx.lineTo(c + r * 0.12, c - r * 0.12)
      ctx.moveTo(c + r * 0.38, c - r * 0.28)
      ctx.lineTo(c + r * 0.22, c - r * 0.12)
      ctx.stroke()
      ellipse(ctx, c + r * 0.02, c - r * 0.12, r * 0.06, r * 0.09, '#c8102e')
      ellipse(ctx, c + r * 0.3, c - r * 0.12, r * 0.06, r * 0.09, '#c8102e')
      ctx.fillStyle = '#ffd166'
      star(ctx, c + r * 0.16, c - r * 0.48, 5, r * 0.1, r * 0.04)
      ctx.fill()
      return
    }
  }
}

// ---------------------------------------------------------------- projectiles & fx

function charmFromImage(img: HTMLImageElement, logicalH: number): HTMLCanvasElement {
  const canvasH = Math.round(logicalH * RES)
  const canvasW = Math.max(1, Math.round((img.width * canvasH) / img.height))
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvasW, canvasH)
  return canvas
}

function projectileCanvases(): HTMLCanvasElement[] {
  const ofuda = (gold: boolean): HTMLCanvasElement => {
    const img = gold ? projectileCharms.seal : projectileCharms.talisman
    if (img) return charmFromImage(img, 64)
    return withGlow(
      outlined(
        paint(22, 36, (ctx) => {
          roundRect(
            ctx,
            1.2,
            1.2,
            19.6,
            33.6,
            2,
            lin(ctx, 0, 1, 0, 35, gold ? [[0, '#fff8dc'], [1, '#e8b34a']] : [[0, '#fffdf8'], [1, '#f3d7a2']])
          )
          ctx.strokeStyle = gold ? '#5b21b6' : '#b01028'
          ctx.lineWidth = 2
          ctx.strokeRect(4, 4, 14, 28)
          ctx.strokeStyle = gold ? '#3b0764' : '#7f1020'
          ctx.lineWidth = 2.2
          ctx.beginPath()
          ctx.moveTo(11, 8)
          ctx.lineTo(11, 20)
          ctx.moveTo(6.4, 12)
          ctx.lineTo(15.6, 12)
          ctx.moveTo(6.8, 16.4)
          ctx.lineTo(15.2, 16.4)
          ctx.stroke()
          ctx.fillStyle = gold ? '#e11d48' : '#d0122c'
          ctx.beginPath()
          ctx.arc(11, 26.2, 4.1, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff6ea'
          ctx.beginPath()
          ctx.arc(11, 26.2, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }),
        1.8
      ),
      gold ? 'rgba(255,209,102,0.95)' : 'rgba(255,64,96,0.9)',
      gold ? 5 : 4
    )
  }

  const flame = (inner: string, mid: string, outer: string): HTMLCanvasElement =>
    paint(36, 36, (ctx) => {
      ctx.fillStyle = radial(ctx, 18, 18, 17, [
        [0, 'rgba(255,255,255,0.9)'],
        [0.35, mid],
        [1, 'rgba(0,0,0,0)']
      ])
      ctx.fillRect(0, 0, 36, 36)
      ctx.fillStyle = radial(ctx, 18, 20, 9, [
        [0, '#ffffff'],
        [0.6, inner],
        [1, outer]
      ])
      ctx.beginPath()
      ctx.moveTo(17, 5)
      ctx.bezierCurveTo(19, 11, 26, 13, 24.5, 20)
      ctx.bezierCurveTo(23, 27, 13, 27, 11.5, 20)
      ctx.bezierCurveTo(10.5, 14, 15, 11, 17, 5)
      ctx.fill()
    })

  const shuriken = (size: number): HTMLCanvasElement =>
    paint(size, size, (ctx) => {
      const c = size / 2
      ctx.fillStyle = lin(ctx, 0, 0, size, size, [[0, '#ffffff'], [0.5, '#c9d3f0'], [1, '#6c78a3']])
      star(ctx, c, c, 4, c - 2, c * 0.32, Math.PI / 2)
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 0.8
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(c + Math.cos(a) * (c - 4), c + Math.sin(a) * (c - 4))
        ctx.stroke()
      }
      ellipse(ctx, c, c, c * 0.14, c * 0.14, OUTLINE)
    })

  return [
    ofuda(false),
    ofuda(true),
    withGlow(
      paint(30, 12, (ctx) => {
        ctx.fillStyle = lin(ctx, 0, 2.5, 0, 9.5, [[0, '#ffffff'], [0.5, '#d4dcf5'], [1, '#6c78a3']])
        ctx.beginPath()
        ctx.moveTo(28, 6)
        ctx.lineTo(16, 2.5)
        ctx.lineTo(12, 6)
        ctx.lineTo(16, 9.5)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1
        ctx.stroke()
        roundRect(ctx, 6, 4.8, 7, 2.4, 1, '#3a2d5c')
        ctx.strokeStyle = '#3a2d5c'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(4.5, 6, 2, 0, Math.PI * 2)
        ctx.stroke()
      }),
      'rgba(160,220,255,0.9)',
      3
    ),
    flame('#7fe9ff', 'rgba(90,200,255,0.55)', '#2a6cff'),
    flame('#ffb3f0', 'rgba(200,110,255,0.55)', '#8a2bff'),
    withGlow(shuriken(30), 'rgba(200,220,255,0.8)', 3),
    withGlow(shuriken(30), 'rgba(190,140,255,1)', 5),
    paint(30, 14, (ctx) => {
      ctx.fillStyle = radial(ctx, 6, 7, 7, [
        [0, 'rgba(255,230,140,0.95)'],
        [1, 'rgba(255,120,40,0)']
      ])
      ctx.fillRect(0, 0, 14, 14)
      roundRect(ctx, 8, 4, 15, 6, 2, lin(ctx, 0, 4, 0, 10, [[0, '#ff8a7a'], [1, '#a3121f']]))
      ctx.fillStyle = lin(ctx, 23, 0, 28, 0, [[0, '#ffd166'], [1, '#fff6c8']])
      ctx.beginPath()
      ctx.moveTo(23, 3.5)
      ctx.lineTo(28, 7)
      ctx.lineTo(23, 10.5)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(13, 4, 2, 6)
    }),
    withGlow(
      paint(16, 12, (ctx) => {
        ctx.fillStyle = lin(ctx, 1, 0, 15, 0, [[0, '#ff7fb6'], [1, '#ffe0ef']])
        ctx.beginPath()
        ctx.moveTo(1, 6)
        ctx.quadraticCurveTo(7, -1, 15, 5)
        ctx.lineTo(12, 6)
        ctx.lineTo(15, 7)
        ctx.quadraticCurveTo(7, 13, 1, 6)
        ctx.fill()
        ellipse(ctx, 6, 5, 3, 1.3, 'rgba(255,255,255,0.8)')
      }),
      'rgba(255,120,190,1)',
      3
    ),
    withGlow(
      paint(18, 18, (ctx) => {
        ctx.translate(9, 10)
        ctx.fillStyle = '#1c0b26'
        ctx.beginPath()
        ctx.ellipse(0, 0, 4.2, 3.2, -0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffd166'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(2.2, -2.4)
        ctx.quadraticCurveTo(6, -8, 4, -1)
        ctx.stroke()
        ctx.fillStyle = '#fff6d0'
        ctx.beginPath()
        ctx.ellipse(-0.6, -0.4, 1.6, 1.1, -0.4, 0, Math.PI * 2)
        ctx.fill()
      }),
      'rgba(255,209,102,0.9)',
      3
    )
  ]
}

function boltCanvas(seed: number): HTMLCanvasElement {
  return paint(48, 256, (ctx) => {
    let s = seed
    const rand = (): number => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const pts: [number, number][] = []
    for (let y = 0; y <= 256; y += 18) pts.push([24 + (rand() - 0.5) * 26, y])
    pts[pts.length - 1] = [24, 256]
    const stroke = (width: number, color: string, blur: number): void => {
      ctx.save()
      ctx.shadowColor = '#7fd8ff'
      ctx.shadowBlur = blur
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      for (const [x, y] of pts) ctx.lineTo(x, y)
      ctx.stroke()
      ctx.restore()
    }
    stroke(8, 'rgba(120,200,255,0.5)', 12)
    stroke(2.5, '#ffffff', 4)
  })
}

// ---------------------------------------------------------------- pickups

function gemDiamondCanvas(tier: number): HTMLCanvasElement {
  const light = ['#e7eef6', '#d5e8f8', '#f3d5df', '#f6e7c0', '#f8f0d8'][tier]
  const mid = ['#8eb6d8', '#6aa6e0', '#e07a96', '#e2b15a', '#ecd28a'][tier]
  const dark = ['#4d7396', '#3d6ea8', '#a84d68', '#a87830', '#b08a3a'][tier]
  const glow = ['rgba(160,190,220,0.28)', 'rgba(90,150,210,0.32)', 'rgba(210,110,140,0.34)', 'rgba(210,170,80,0.36)', 'rgba(220,190,120,0.4)'][tier]
  const grow = tier <= 0 ? 0 : tier >= 4 ? 2 : 1
  const w = 16 + grow
  const h = 20 + grow
  const gem = outlined(
    paint(w, h, (ctx) => {
      const cx = w / 2
      const girdle = h * 0.4
      ctx.beginPath()
      ctx.moveTo(cx, 1.5)
      ctx.lineTo(w - 1.5, girdle)
      ctx.lineTo(cx, h - 1.5)
      ctx.lineTo(1.5, girdle)
      ctx.closePath()
      ctx.fillStyle = lin(ctx, cx, 1, cx, h, [[0, light], [0.42, mid], [1, dark]])
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx, 2.5)
      ctx.lineTo(cx + w * 0.16, girdle * 0.7)
      ctx.lineTo(cx, girdle)
      ctx.lineTo(cx - w * 0.16, girdle * 0.7)
      ctx.closePath()
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fill()
    }),
    1
  )
  return withGlow(gem, glow, 2)
}

// ---------------------------------------------------------------- environment

function wrapDraw(size: number, x: number, y: number, margin: number, draw: (x: number, y: number) => void): void {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      const px = x + ox
      const py = y + oy
      if (px > -margin && px < size + margin && py > -margin && py < size + margin) draw(px, py)
    }
  }
}

function groundCanvas(): HTMLCanvasElement {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  let s = 1337
  const rand = (): number => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  ctx.fillStyle = '#1a1430'
  ctx.fillRect(0, 0, size, size)
  for (let k = 0; k < 26; k++) {
    const x = rand() * size
    const y = rand() * size
    const r = 40 + rand() * 90
    const color = rand() > 0.5 ? 'rgba(48,36,86,0.55)' : 'rgba(26,44,70,0.5)'
    wrapDraw(size, x, y, r, (px, py) => {
      ctx.fillStyle = radial(ctx, px, py, r, [
        [0, color],
        [1, 'rgba(0,0,0,0)']
      ])
      ctx.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }
  for (let k = 0; k < 40; k++) {
    const x = rand() * size
    const y = rand() * size
    const w = 16 + rand() * 22
    const h = 10 + rand() * 12
    wrapDraw(size, x, y, 40, (px, py) => {
      ctx.fillStyle = 'rgba(70,58,110,0.35)'
      ctx.beginPath()
      ctx.roundRect(px, py, w, h, 5)
      ctx.fill()
      ctx.fillStyle = 'rgba(140,120,200,0.12)'
      ctx.fillRect(px + 3, py + 1, w - 6, 2)
      ctx.fillStyle = 'rgba(5,0,15,0.25)'
      ctx.fillRect(px + 3, py + h - 2, w - 6, 2)
    })
  }
  for (let k = 0; k < 220; k++) {
    const x = rand() * size
    const y = rand() * size
    const h = 3 + rand() * 5
    const color = rand() > 0.3 ? 'rgba(80,140,150,0.45)' : 'rgba(120,180,170,0.4)'
    wrapDraw(size, x, y, 10, (px, py) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - 1.5, py - h)
      ctx.moveTo(px + 2, py)
      ctx.lineTo(px + 3, py - h * 0.8)
      ctx.stroke()
    })
  }
  for (let k = 0; k < 70; k++) {
    const x = rand() * size
    const y = rand() * size
    const a = rand() * Math.PI
    wrapDraw(size, x, y, 6, (px, py) => {
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(a)
      ellipse(ctx, 0, 0, 3, 1.6, 'rgba(255,170,205,0.55)')
      ctx.restore()
    })
  }
  return c
}

function ashGroundCanvas(): HTMLCanvasElement {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  let s = 90210
  const rand = (): number => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  ctx.fillStyle = '#1a0c0c'
  ctx.fillRect(0, 0, size, size)
  for (let k = 0; k < 22; k++) {
    const x = rand() * size
    const y = rand() * size
    const r = 50 + rand() * 100
    wrapDraw(size, x, y, r, (px, py) => {
      ctx.fillStyle = radial(ctx, px, py, r, [
        [0, rand() > 0.5 ? 'rgba(90, 24, 18, 0.55)' : 'rgba(40, 16, 12, 0.6)'],
        [1, 'rgba(0,0,0,0)']
      ])
      ctx.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }
  for (let k = 0; k < 18; k++) {
    const x = rand() * size
    const y = rand() * size
    const len = 40 + rand() * 90
    wrapDraw(size, x, y, len, (px, py) => {
      ctx.strokeStyle = 'rgba(255, 90, 30, 0.28)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + len * 0.4, py + len)
      ctx.stroke()
    })
  }
  for (let k = 0; k < 80; k++) {
    const x = rand() * size
    const y = rand() * size
    wrapDraw(size, x, y, 8, (px, py) => {
      ellipse(ctx, px, py, 2 + rand() * 3, 1.4, rand() > 0.6 ? 'rgba(255,160,60,0.55)' : 'rgba(80,70,64,0.7)')
    })
  }
  return c
}

function portalCanvas(): HTMLCanvasElement {
  return paint(64, 80, (ctx) => {
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(10, 70)
    ctx.lineTo(10, 28)
    ctx.quadraticCurveTo(32, 4, 54, 28)
    ctx.lineTo(54, 70)
    ctx.stroke()
    ctx.strokeStyle = '#fff6d0'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = radial(ctx, 32, 46, 22, [
      [0, 'rgba(255, 240, 180, 0.95)'],
      [0.5, 'rgba(255, 120, 40, 0.45)'],
      [1, 'rgba(255, 40, 20, 0)']
    ])
    ctx.beginPath()
    ctx.ellipse(32, 48, 16, 22, 0, 0, Math.PI * 2)
    ctx.fill()
  }, 4)
}

function propCanvases(): HTMLCanvasElement[] {
  return [
    outlined(
      paint(44, 30, (ctx) => {
        ellipse(ctx, 22, 17, 19, 11, lin(ctx, 0, 6, 0, 28, [[0, '#6a6496'], [1, '#353058']]))
        ellipse(ctx, 19, 13, 14, 7, lin(ctx, 0, 6, 0, 20, [[0, '#8a84b8'], [1, '#5a5488']]))
        ellipse(ctx, 15, 11, 5, 2.5, 'rgba(255,255,255,0.22)')
        ellipse(ctx, 30, 21, 6, 3, '#3c7a6a')
        ellipse(ctx, 12, 22, 4, 2, '#3c7a6a')
      })
    ),
    outlined(
      paint(30, 58, (ctx) => {
        const stone = lin(ctx, 0, 0, 30, 0, [[0, '#9a96bd'], [1, '#5f5b85']])
        roundRect(ctx, 9, 44, 12, 10, 2, stone)
        roundRect(ctx, 12, 30, 6, 16, 1, stone)
        roundRect(ctx, 5, 26, 20, 5, 2, stone)
        roundRect(ctx, 8, 14, 14, 12, 2, stone)
        roundRect(ctx, 11, 17, 8, 6, 1, radial(ctx, 15, 20, 6, [[0, '#ffffff'], [1, '#ffb347']]))
        ctx.fillStyle = stone
        ctx.beginPath()
        ctx.moveTo(2, 14)
        ctx.lineTo(15, 3)
        ctx.lineTo(28, 14)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#4a7a5a'
        ellipse(ctx, 10, 52, 3, 1.5, '#3c7a6a')
      })
    ),
    paint(34, 22, (ctx) => {
      for (let k = 0; k < 7; k++) {
        const x = 6 + k * 3.6
        ctx.strokeStyle = k % 2 ? '#3f8f7f' : '#55b39e'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 20)
        ctx.quadraticCurveTo(x + (k - 3) * 1.5, 10, x + (k - 3) * 3, 3 + (k % 2) * 4)
        ctx.stroke()
      }
    }),
    paint(34, 20, (ctx) => {
      for (let k = 0; k < 6; k++) {
        const x = 5 + k * 5 + (k % 2) * 2
        const y = 8 + (k % 3) * 3
        ctx.strokeStyle = '#3f8f7f'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, 19)
        ctx.stroke()
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2
          ellipse(ctx, x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.5, 1.5, k % 2 ? '#ff9fc8' : '#c9b3ff')
        }
        ellipse(ctx, x, y, 0.9, 0.9, '#ffe066')
      }
    })
  ]
}

// ---------------------------------------------------------------- assembly

function petEye(ctx: Ctx, x: number, y: number, iris: string): void {
  ellipse(ctx, x, y, 2.35, 2.9, '#fff')
  ellipse(ctx, x + 0.15, y + 0.25, 1.55, 2.05, radial(ctx, x, y - 0.4, 2.6, [[0, '#fff'], [0.42, iris], [1, '#1c0b26']]))
  ellipse(ctx, x + 0.2, y + 0.45, 0.62, 0.95, '#1c0b26')
  ellipse(ctx, x - 0.55, y - 0.95, 0.62, 0.72, '#fff')
  ellipse(ctx, x + 0.75, y + 1.05, 0.28, 0.28, '#fff')
}

function drawPet(ctx: Ctx, kind: PetKind): void {
  if (kind === 'shikigami') return
  const c = 20
  const blush = (x: number, y: number): void => ellipse(ctx, x, y, 1.7, 0.85, 'rgba(255,120,150,0.55)')
  switch (kind) {
    case 'fox': {
      ctx.fillStyle = lin(ctx, 6, 12, 30, 36, [[0, '#ffe0b8'], [0.55, '#ff8a32'], [1, '#c24a12']])
      ctx.beginPath()
      ctx.moveTo(7, 28)
      ctx.quadraticCurveTo(4, 14, 15, 13)
      ctx.quadraticCurveTo(22, 11, 27, 15)
      ctx.quadraticCurveTo(34, 18, 32, 27)
      ctx.quadraticCurveTo(24, 36, 10, 32)
      ctx.closePath()
      ctx.fill()
      ellipse(ctx, 20, 25, 7.2, 5.6, lin(ctx, 14, 20, 26, 30, [[0, '#fff8f2'], [1, '#ffd0aa']]))
      for (const s of [-1, 1] as const) {
        ctx.fillStyle = lin(ctx, c, 14, c + s * 12, 4, [[0, '#ff9a40'], [1, '#ffd7a8']])
        ctx.beginPath()
        ctx.moveTo(c + s * 4.2, 15)
        ctx.quadraticCurveTo(c + s * 12, 6, c + s * 11.5, 3)
        ctx.quadraticCurveTo(c + s * 6, 8, c + s * 1.5, 14)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ffb3cc'
        ctx.beginPath()
        ctx.moveTo(c + s * 5.2, 13.5)
        ctx.lineTo(c + s * 10.2, 5.2)
        ctx.lineTo(c + s * 3.6, 12.6)
        ctx.fill()
      }
      ellipse(ctx, 12, 26, 2.4, 1.8, 'rgba(255,255,255,0.45)')
      petEye(ctx, c - 3.2, 23, '#3a2418')
      petEye(ctx, c + 3.2, 23, '#3a2418')
      blush(c - 6.2, 26)
      blush(c + 6.2, 26)
      ctx.fillStyle = lin(ctx, 22, 14, 39, 36, [[0, '#fff6ea'], [0.4, '#ffb15a'], [1, '#d24a10']])
      ctx.beginPath()
      ctx.moveTo(22, 27)
      ctx.quadraticCurveTo(30, 12, 37, 18)
      ctx.quadraticCurveTo(40, 28, 33, 34)
      ctx.quadraticCurveTo(26, 32, 22, 29)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(35.2, 20.5, 2.8, 0, Math.PI * 2)
      ctx.fillStyle = '#fff8f0'
      ctx.fill()
      break
    }
    case 'wisp': {
      for (const s of [-1, 1] as const) {
        ctx.beginPath()
        ctx.moveTo(c, 33)
        ctx.bezierCurveTo(c + s * 6, 20, c + s * 18, 14, c + s * 11, 5)
        ctx.bezierCurveTo(c + s * 6, 14, c + s * 3, 24, c, 33)
        ctx.fillStyle = lin(ctx, c + s * 10, 6, c, 32, [[0, '#ffffff'], [0.45, '#9eecff'], [1, '#2aa8c8']])
        ctx.fill()
      }
      ctx.beginPath()
      ctx.moveTo(c, 6)
      ctx.bezierCurveTo(29, 14, 27, 28, c, 34)
      ctx.bezierCurveTo(11, 28, 11, 14, c, 6)
      ctx.fillStyle = lin(ctx, c, 6, c, 34, [[0, '#ffffff'], [0.35, '#d8fbff'], [1, '#5ad4ea']])
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(c, 12)
      ctx.bezierCurveTo(25, 18, 24, 26, c, 30)
      ctx.bezierCurveTo(15, 26, 15, 18, c, 12)
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.fill()
      petEye(ctx, c - 3, 20, '#1a6a88')
      petEye(ctx, c + 3, 20, '#1a6a88')
      ctx.strokeStyle = '#1c4a5a'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(c - 1.4, 24)
      ctx.quadraticCurveTo(c, 25.4, c + 1.4, 24)
      ctx.stroke()
      break
    }
    case 'neko': {
      ctx.fillStyle = lin(ctx, 26, 12, 36, 26, [[0, '#fff6d8'], [1, '#e0a020']])
      ctx.beginPath()
      ctx.moveTo(26, 20)
      ctx.quadraticCurveTo(36, 12, 35, 18)
      ctx.quadraticCurveTo(32, 24, 26, 24)
      ctx.fill()
      roundRect(ctx, 8, 15, 20, 16, 7, lin(ctx, 8, 14, 28, 32, [[0, '#fffaf0'], [0.55, '#ffe08a'], [1, '#e09818']]))
      roundRect(ctx, 11, 21.5, 14, 4.2, 1.2, lin(ctx, 0, 21, 0, 26, [[0, '#ff6a7a'], [1, '#9a1028']]))
      ellipse(ctx, 18, 23.6, 1.5, 1.5, radial(ctx, 17.4, 23, 2, [[0, '#fff'], [1, '#ffd166']]))
      for (const s of [-1, 1] as const) {
        ctx.fillStyle = lin(ctx, c, 16, c + s * 10, 4, [[0, '#ffe08a'], [1, '#fff6d0']])
        ctx.beginPath()
        ctx.moveTo(c + s * 4, 16.5)
        ctx.lineTo(c + s * 11, 4.5)
        ctx.lineTo(c + s * 1.2, 15.2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ff9ab8'
        ctx.beginPath()
        ctx.moveTo(c + s * 4.6, 15.4)
        ctx.lineTo(c + s * 9.4, 7)
        ctx.lineTo(c + s * 2.4, 14.4)
        ctx.fill()
      }
      petEye(ctx, c - 3.6, 18.8, '#5a3a10')
      petEye(ctx, c + 3.6, 18.8, '#5a3a10')
      blush(c - 6.2, 21)
      blush(c + 6.2, 21)
      ellipse(ctx, c, 26.4, 1.5, 0.9, '#ff6fae')
      break
    }
    case 'lantern': {
      ctx.strokeStyle = '#5a3418'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(15, 5)
      ctx.quadraticCurveTo(20, 1.5, 25, 5)
      ctx.moveTo(20, 4.5)
      ctx.lineTo(20, 8)
      ctx.stroke()
      roundRect(ctx, 12, 8, 16, 3.2, 1, lin(ctx, 12, 8, 28, 11, [[0, '#6a4420'], [1, '#2a180c']]))
      roundRect(ctx, 11, 11, 18, 17, 4, lin(ctx, 11, 11, 29, 28, [[0, '#fff8dc'], [0.45, '#ffd27a'], [1, '#ff7a2a']]))
      ellipse(ctx, 20, 19, 5.2, 6, radial(ctx, 20, 18, 7, [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,190,60,0.55)'], [1, 'rgba(255,120,20,0)']]))
      ctx.strokeStyle = 'rgba(90,30,8,0.4)'
      ctx.lineWidth = 0.9
      for (const y of [15.5, 20, 24.5]) {
        ctx.beginPath()
        ctx.moveTo(12.5, y)
        ctx.quadraticCurveTo(20, y + 1.6, 27.5, y)
        ctx.stroke()
      }
      petEye(ctx, 16.2, 18.2, '#8a3a10')
      petEye(ctx, 23.8, 18.2, '#8a3a10')
      ctx.strokeStyle = '#5a2410'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(18, 22.5)
      ctx.quadraticCurveTo(20, 24.2, 22, 22.5)
      ctx.stroke()
      roundRect(ctx, 13, 27, 14, 3, 1, lin(ctx, 13, 27, 27, 30, [[0, '#6a4420'], [1, '#2a180c']]))
      ctx.fillStyle = lin(ctx, 18, 30, 22, 36, [[0, '#ffe08a'], [1, '#ff8a20']])
      ctx.beginPath()
      ctx.moveTo(20, 30)
      ctx.lineTo(22.2, 36)
      ctx.lineTo(17.8, 36)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'dragon': {
      ellipse(ctx, 11, 28, 8, 5.5, lin(ctx, 4, 22, 18, 34, [[0, '#d8ffe8'], [1, '#0c6a40']]))
      ellipse(ctx, 20, 22, 7, 5, lin(ctx, 14, 16, 26, 28, [[0, '#f4fff8'], [1, '#14945a']]))
      ctx.fillStyle = lin(ctx, 16, 18, 28, 30, [[0, '#f4fff8'], [1, '#7ee0b0']])
      ctx.beginPath()
      ctx.moveTo(14, 24)
      ctx.quadraticCurveTo(20, 19, 26, 24)
      ctx.quadraticCurveTo(20, 28, 14, 24)
      ctx.fill()
      for (const [x, y] of [[9, 7], [15, 4], [21, 6.5]] as const) {
        ctx.fillStyle = lin(ctx, x, y, x, y + 7, [[0, '#fff6c0'], [1, '#e0a020']])
        ctx.beginPath()
        ctx.moveTo(x + 1, y + 7)
        ctx.quadraticCurveTo(x + 2.2, y, x + 4.5, y + 1)
        ctx.quadraticCurveTo(x + 3, y + 4, x + 5, y + 7)
        ctx.closePath()
        ctx.fill()
      }
      ellipse(ctx, 31, 16, 6, 5, lin(ctx, 26, 12, 36, 22, [[0, '#d8ffe8'], [1, '#14945a']]))
      ctx.fillStyle = '#fffaf2'
      ctx.beginPath()
      ctx.moveTo(34, 14)
      ctx.quadraticCurveTo(39, 12, 37.5, 18)
      ctx.quadraticCurveTo(35, 17, 34, 15.5)
      ctx.fill()
      ctx.fillStyle = '#ffd166'
      ctx.beginPath()
      ctx.moveTo(28, 11)
      ctx.quadraticCurveTo(31, 7, 33, 12)
      ctx.closePath()
      ctx.fill()
      petEye(ctx, 29.2, 15.4, '#0e4a30')
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(12, 21)
      ctx.quadraticCurveTo(20, 15, 30, 19)
      ctx.stroke()
      break
    }
    case 'owl': {
      ellipse(ctx, c, 24, 12, 12.5, lin(ctx, 8, 12, 32, 36, [[0, '#f8f6ff'], [0.5, '#d5e2ff'], [1, '#7e94c0']]))
      ctx.fillStyle = lin(ctx, 8, 16, 16, 34, [[0, '#ffffff'], [1, '#b7c8ee']])
      ctx.beginPath()
      ctx.moveTo(12, 18)
      ctx.quadraticCurveTo(4, 24, 8, 33)
      ctx.quadraticCurveTo(14, 28, 15, 18)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(28, 18)
      ctx.quadraticCurveTo(36, 24, 32, 33)
      ctx.quadraticCurveTo(26, 28, 25, 18)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(9, 24)
      ctx.quadraticCurveTo(12, 22, 14, 26)
      ctx.moveTo(31, 24)
      ctx.quadraticCurveTo(28, 22, 26, 26)
      ctx.stroke()
      for (const s of [-1, 1] as const) {
        ctx.fillStyle = lin(ctx, c, 12, c + s * 8, 3, [[0, '#e8eeff'], [1, '#ffffff']])
        ctx.beginPath()
        ctx.moveTo(c + s * 3.2, 13)
        ctx.lineTo(c + s * 8.5, 3)
        ctx.lineTo(c + s * 1.2, 12)
        ctx.closePath()
        ctx.fill()
      }
      ellipse(ctx, c - 4.2, 21, 4.5, 4.6, radial(ctx, c - 5, 19, 5, [[0, '#fffef8'], [1, '#ffe08a']]))
      ellipse(ctx, c + 4.2, 21, 4.5, 4.6, radial(ctx, c + 3, 19, 5, [[0, '#fffef8'], [1, '#ffe08a']]))
      ellipse(ctx, c - 4.2, 21.2, 1.9, 2.3, '#1c0b26')
      ellipse(ctx, c + 4.2, 21.2, 1.9, 2.3, '#1c0b26')
      ellipse(ctx, c - 4.9, 20.2, 0.7, 0.8, '#ffffff')
      ellipse(ctx, c + 3.5, 20.2, 0.7, 0.8, '#ffffff')
      ctx.fillStyle = lin(ctx, c - 2, 23, c + 2, 28, [[0, '#ffe08a'], [1, '#e07020']])
      ctx.beginPath()
      ctx.moveTo(c, 22.6)
      ctx.lineTo(c + 2.5, 27.2)
      ctx.lineTo(c - 2.5, 27.2)
      ctx.closePath()
      ctx.fill()
      star(ctx, c, 7.5, 4, 2.6, 1)
      ctx.fillStyle = radial(ctx, c, 7, 3, [[0, '#ffffff'], [1, '#ffd166']])
      ctx.fill()
      break
    }
  }
  petExtra(ctx, kind)
  glossStreak(ctx, 40, 40)
}

function drawOrnament(ctx: Ctx, kind: OrnamentKind, tint: string): void {
  const c = 24
  switch (kind) {
    case 'halo':
      ctx.strokeStyle = lin(ctx, 4, 8, 44, 28, [[0, '#fff8c8'], [1, tint]])
      ctx.lineWidth = 3.4
      ctx.beginPath()
      ctx.ellipse(c, 18, 15, 5.5, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      for (const x of [10, 24, 38]) {
        roundRect(ctx, x - 2, 22, 4, 7, 0.6, '#fff6e0')
        ctx.fillStyle = '#d8243c'
        ctx.fillRect(x - 0.6, 23.2, 1.2, 3.2)
      }
      break
    case 'crown':
      ctx.fillStyle = lin(ctx, 8, 8, 40, 30, [[0, '#fff6d0'], [1, '#b8860b']])
      ctx.beginPath()
      ctx.moveTo(8, 28)
      ctx.lineTo(11, 12)
      ctx.lineTo(17, 20)
      ctx.lineTo(24, 7)
      ctx.lineTo(31, 20)
      ctx.lineTo(37, 12)
      ctx.lineTo(40, 28)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#7a5a10'
      ctx.fillRect(8, 26, 32, 3)
      ellipse(ctx, 24, 14, 2.4, 2.4, '#ff5fa2')
      ellipse(ctx, 14, 18, 1.8, 1.8, '#5fd3ff')
      ellipse(ctx, 34, 18, 1.8, 1.8, '#5fd3ff')
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(12, 24)
      ctx.lineTo(36, 24)
      ctx.stroke()
      break
    case 'lantern':
      ctx.strokeStyle = '#5a3418'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(20, 4)
      ctx.quadraticCurveTo(24, 1, 28, 4)
      ctx.moveTo(24, 4)
      ctx.lineTo(24, 8)
      ctx.stroke()
      roundRect(ctx, 15, 8, 18, 4, 1, '#3a2412')
      roundRect(ctx, 14, 12, 20, 22, 4, lin(ctx, 14, 12, 34, 34, [[0, '#fff6d0'], [1, tint]]))
      ctx.strokeStyle = 'rgba(90,30,8,0.4)'
      ctx.lineWidth = 1.1
      for (const y of [17, 22, 27]) {
        ctx.beginPath()
        ctx.moveTo(15, y)
        ctx.quadraticCurveTo(24, y + 2, 33, y)
        ctx.stroke()
      }
      roundRect(ctx, 16, 33, 16, 3, 1, '#3a2412')
      ctx.fillStyle = '#ffd166'
      ctx.beginPath()
      ctx.moveTo(24, 36)
      ctx.lineTo(22, 44)
      ctx.lineTo(26, 44)
      ctx.fill()
      break
    case 'umbrella':
      ctx.fillStyle = lin(ctx, 6, 6, 42, 26, [[0, '#ffffff'], [1, tint]])
      ctx.beginPath()
      ctx.moveTo(6, 22)
      ctx.quadraticCurveTo(24, 2, 42, 22)
      ctx.quadraticCurveTo(33, 18, 24, 22)
      ctx.quadraticCurveTo(15, 18, 6, 22)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#7a2048'
      ctx.lineWidth = 1
      for (const x of [14, 24, 34]) {
        ctx.beginPath()
        ctx.moveTo(24, 8)
        ctx.lineTo(x, 21)
        ctx.stroke()
      }
      ctx.fillStyle = '#ffe066'
      for (const x of [16, 24, 32]) {
        ctx.beginPath()
        ctx.arc(x, 16, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = '#5a3018'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(c, 8)
      ctx.lineTo(c, 40)
      ctx.stroke()
      ellipse(ctx, c, 40, 3, 1.4, '#5a3018')
      break
    case 'horns':
      for (const s of [-1, 1]) {
        ctx.fillStyle = lin(ctx, 0, 6, 0, 28, [[0, '#ffb0bc'], [1, '#7a1020']])
        ctx.beginPath()
        ctx.moveTo(c + s * 3, 26)
        ctx.quadraticCurveTo(c + s * 8, 14, c + s * 16, 6)
        ctx.quadraticCurveTo(c + s * 12, 16, c + s * 8, 28)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#ffd166'
        ctx.lineWidth = 1.3
        ctx.beginPath()
        ctx.moveTo(c + s * 6, 18)
        ctx.lineTo(c + s * 11, 16)
        ctx.stroke()
      }
      break
    case 'wings':
      for (const s of [-1, 1]) {
        ctx.fillStyle = lin(ctx, c, 10, c + s * 22, 34, [[0, '#ffffff'], [1, tint]])
        ctx.beginPath()
        ctx.moveTo(c, 24)
        ctx.quadraticCurveTo(c + s * 10, 8, c + s * 20, 12)
        ctx.quadraticCurveTo(c + s * 16, 20, c + s * 18, 30)
        ctx.quadraticCurveTo(c + s * 10, 24, c, 28)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(c + s * 4, 22)
        ctx.quadraticCurveTo(c + s * 12, 14, c + s * 18, 16)
        ctx.moveTo(c + s * 3, 26)
        ctx.quadraticCurveTo(c + s * 12, 22, c + s * 16, 28)
        ctx.stroke()
        ellipse(ctx, c + s * 16, 14, 1.6, 1.6, '#ffd166')
      }
      ctx.fillStyle = '#ffd166'
      star(ctx, c, 16, 4, 3, 1.2)
      ctx.fill()
      break
    case 'moon':
      ctx.beginPath()
      ctx.arc(c - 2, c + 1, 14, 0, Math.PI * 2)
      ctx.arc(c + 5, c - 1, 11, 0, Math.PI * 2, true)
      ctx.fillStyle = radial(ctx, c - 6, c - 2, 16, [[0, '#fffaf0'], [0.55, '#ffe08a'], [1, '#ff9ec4']])
      ctx.fill('evenodd')
      ctx.strokeStyle = '#fff6d0'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(c - 2, c + 1, 13.2, 0.8, Math.PI * 1.35)
      ctx.stroke()
      ellipse(ctx, c - 7, c - 2, 2.2, 1.3, 'rgba(255,255,255,0.8)')
      star(ctx, c + 12, c - 10, 4, 2.2, 0.8)
      ctx.fillStyle = '#fff6ea'
      ctx.fill()
      break
    case 'mask':
      ctx.fillStyle = lin(ctx, 10, 8, 38, 40, [[0, '#fff8ee'], [1, '#f0d2b0']])
      ctx.beginPath()
      ctx.moveTo(c, 8)
      ctx.quadraticCurveTo(38, 12, 36, 28)
      ctx.quadraticCurveTo(c, 42, 12, 28)
      ctx.quadraticCurveTo(10, 12, c, 8)
      ctx.fill()
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.fillStyle = '#d8243c'
      ctx.beginPath()
      ctx.moveTo(c, 14)
      ctx.lineTo(c + 3, 20)
      ctx.lineTo(c, 18)
      ctx.lineTo(c - 3, 20)
      ctx.fill()
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#1c0b26'
        ctx.beginPath()
        ctx.ellipse(c + s * 6, 22, 3.2, 2.2, s * -0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#d8243c'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(c + s * 10, 20)
        ctx.lineTo(c + s * 16, 16)
        ctx.moveTo(c + s * 10, 24)
        ctx.lineTo(c + s * 16, 26)
        ctx.stroke()
        ctx.fillStyle = '#fff6e8'
        ctx.beginPath()
        ctx.moveTo(c + s * 8, 12)
        ctx.lineTo(c + s * 16, 2)
        ctx.lineTo(c + s * 4, 11)
        ctx.fill()
        ctx.fillStyle = '#ffb3cc'
        ctx.beginPath()
        ctx.moveTo(c + s * 8, 11)
        ctx.lineTo(c + s * 14, 4)
        ctx.lineTo(c + s * 6, 10)
        ctx.fill()
      }
      ctx.strokeStyle = '#1c0b26'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(c - 3, 30)
      ctx.quadraticCurveTo(c, 33, c + 3, 30)
      ctx.stroke()
      break
  }
  ornamentPolish(ctx, kind, tint)
  glossStreak(ctx, 48, 48)
}

function ornamentPolish(ctx: Ctx, kind: OrnamentKind, tint: string): void {
  const c = 24
  if (kind === 'halo') {
    ctx.fillStyle = '#fff8d8'
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      star(ctx, c + Math.cos(a) * 16.5, 18 + Math.sin(a) * 6.2, 4, 1.7, 0.6, a)
      ctx.fill()
    }
  } else if (kind === 'crown') {
    ellipse(ctx, 24, 13, 1.1, 1.1, '#ffffff')
    ellipse(ctx, 14, 17, 0.7, 0.7, '#ffffff')
    ellipse(ctx, 34, 17, 0.7, 0.7, '#ffffff')
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(16, 16)
    ctx.lineTo(24, 8)
    ctx.lineTo(32, 16)
    ctx.stroke()
  } else if (kind === 'lantern') {
    ellipse(ctx, c, 22, 5, 6.5, radial(ctx, c, 20, 8, [[0, 'rgba(255,255,255,0.95)'], [0.45, 'rgba(255,200,80,0.45)'], [1, 'rgba(255,120,20,0)']]))
    ctx.fillStyle = '#ffd166'
    for (const x of [16, 32]) ellipse(ctx, x, 14, 1, 1, '#ffd166')
  } else if (kind === 'umbrella') {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(12, 18)
    ctx.quadraticCurveTo(24, 6, 36, 18)
    ctx.stroke()
    ellipse(ctx, 24, 10, 1.6, 1.6, radial(ctx, 23, 9, 2, [[0, '#ffffff'], [1, tint]]))
  } else if (kind === 'horns') {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 1.1
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(c + s * 5, 22)
      ctx.quadraticCurveTo(c + s * 10, 12, c + s * 15, 7)
      ctx.stroke()
    }
  } else if (kind === 'wings') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 0.9
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(c + s * 2, 20)
      ctx.quadraticCurveTo(c + s * 10, 10, c + s * 18, 14)
      ctx.moveTo(c + s * 2, 24)
      ctx.quadraticCurveTo(c + s * 11, 18, c + s * 16, 26)
      ctx.moveTo(c + s * 4, 27)
      ctx.quadraticCurveTo(c + s * 10, 24, c + s * 14, 30)
      ctx.stroke()
    }
  } else if (kind === 'moon') {
    ellipse(ctx, c - 6, c - 6, 3.2, 2, 'rgba(255,255,255,0.55)')
    star(ctx, c + 14, c - 12, 4, 2.4, 0.9)
    ctx.fillStyle = '#fff6ea'
    ctx.fill()
  } else {
    ellipse(ctx, c - 6, 26, 2.2, 1.1, 'rgba(255,140,160,0.45)')
    ellipse(ctx, c + 6, 26, 2.2, 1.1, 'rgba(255,140,160,0.45)')
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(16, 12)
    ctx.quadraticCurveTo(c, 8, 32, 12)
    ctx.stroke()
  }
}

function petCanvas(kind: PetKind): HTMLCanvasElement {
  const exclusive = kind === 'dragon' || kind === 'owl'
  const epic = kind === 'neko'
  const glow = exclusive ? '#ffd166' : epic ? '#c084fc' : kind === 'wisp' ? '#9ef6ff' : '#5fd3ff'
  const res = 4
  return withGlow(outlined(paint(40, 40, (ctx) => drawPet(ctx, kind), res), 1.25, res), glow, exclusive ? 8 : 5, res)
}

function ornamentCanvas(kind: OrnamentKind, tint: string): HTMLCanvasElement {
  const exclusive = kind === 'wings' || kind === 'moon' || kind === 'mask'
  const epic = kind === 'crown' || kind === 'umbrella'
  const glow = exclusive ? '#ffd166' : epic ? '#c084fc' : tint
  const res = 4
  return withGlow(outlined(paint(48, 48, (ctx) => drawOrnament(ctx, kind, tint), res), exclusive ? 1.6 : 1.25, res), glow, exclusive ? 9 : 6, res)
}

function paintEffectPreview(ctx: Ctx, kind: EffectKind, tint: string): void {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - 0.4
    ctx.save()
    ctx.translate(24 + Math.cos(a) * 13, 24 + Math.sin(a) * 13)
    ctx.rotate(a + 0.6)
    ctx.scale(0.48, 0.48)
    drawTrail(ctx, kind, i % 2 ? tint : '#ffffff')
    ctx.restore()
  }
}

function disk(ctx: Ctx, x: number, y: number, r: number, fill: Paint): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

/** A projectile, slash, bolt or aura that is recognisable on its own, not a recolor. */
function weaponSkinCanvas(id: string): HTMLCanvasElement {
  const slash = id.startsWith('katana')
  const bolt = id.startsWith('thunder')
  const aura = id.startsWith('aura')
  const w = slash ? 128 : bolt ? 48 : aura ? 128 : 40
  const h = slash ? 96 : bolt ? 256 : aura ? 128 : 40
  const body = paint(w, h, (ctx) => {
    if (id === 'shuriken_pizza') {
      disk(ctx, 20, 20, 15, lin(ctx, 8, 8, 32, 32, [[0, '#f6d27a'], [1, '#c47a28']]))
      disk(ctx, 20, 20, 11, '#e23b3b')
      disk(ctx, 20, 20, 9, '#ffe38a')
      ctx.fillStyle = '#c41230'
      for (const [x, y] of [[14, 16], [22, 15], [18, 22], [25, 21], [15, 24]]) disk(ctx, x, y, 1.7, '#c41230')
      ctx.strokeStyle = 'rgba(120,60,10,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(20, 20)
      ctx.lineTo(32, 12)
      ctx.moveTo(20, 20)
      ctx.lineTo(8, 28)
      ctx.stroke()
    } else if (id === 'shuriken_ice') {
      ctx.strokeStyle = '#e8fbff'
      ctx.lineWidth = 2
      ctx.shadowColor = '#7fd8ff'
      ctx.shadowBlur = 6
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(20, 20)
        ctx.lineTo(20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15)
        ctx.stroke()
        disk(ctx, 20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15, 2.2, '#ffffff')
      }
      disk(ctx, 20, 20, 3, '#bfefff')
    } else if (id === 'shuriken_neon') {
      ctx.shadowColor = '#ff5fa2'
      ctx.shadowBlur = 8
      star(ctx, 20, 20, 4, 15, 4, Math.PI / 2)
      ctx.fillStyle = '#1a1030'
      ctx.fill()
      ctx.strokeStyle = '#ff5fa2'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.strokeStyle = '#5ff2ff'
      ctx.lineWidth = 1
      star(ctx, 20, 20, 4, 9, 2.5, Math.PI / 4)
      ctx.stroke()
    } else if (id === 'kunai_poison') {
      ctx.fillStyle = lin(ctx, 12, 4, 28, 36, [[0, '#d8ffe0'], [1, '#1f9a3a']])
      ctx.beginPath()
      ctx.moveTo(20, 4)
      ctx.lineTo(28, 18)
      ctx.lineTo(20, 16)
      ctx.lineTo(12, 18)
      ctx.closePath()
      ctx.fill()
      roundRect(ctx, 17, 16, 6, 12, 1, '#14301c')
      ctx.strokeStyle = '#7dff4a'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(20, 28)
      ctx.quadraticCurveTo(26, 34, 18, 37)
      ctx.stroke()
    } else if (id === 'kunai_gold') {
      ctx.fillStyle = lin(ctx, 10, 4, 30, 20, [[0, '#fff6c8'], [1, '#d4a017']])
      ctx.beginPath()
      ctx.moveTo(20, 3)
      ctx.lineTo(29, 18)
      ctx.lineTo(20, 14)
      ctx.lineTo(11, 18)
      ctx.closePath()
      ctx.fill()
      roundRect(ctx, 16, 15, 8, 14, 2, '#5a3a08')
      disk(ctx, 20, 32, 3, '#ffd166')
    } else if (id === 'talisman_gold' || id === 'talisman_ink' || id === 'talisman_divine') {
      const paper = id === 'talisman_ink' ? '#1a1020' : id === 'talisman_divine' ? '#f4fbff' : '#fff3c4'
      const ink = id === 'talisman_ink' ? '#ff4060' : id === 'talisman_divine' ? '#7a5cff' : '#c47a10'
      roundRect(ctx, 8, 4, 24, 32, 2, paper)
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.4
      ctx.strokeRect(11, 7, 18, 26)
      ctx.font = '700 14px serif'
      ctx.fillStyle = ink
      ctx.textAlign = 'center'
      ctx.fillText(id === 'talisman_divine' ? '光' : '封', 20, 26)
    } else if (id.startsWith('foxfire')) {
      const mid = id === 'foxfire_azure' ? '#5fd3ff' : id === 'foxfire_rose' ? '#ff6fae' : '#4affc8'
      ctx.fillStyle = radial(ctx, 20, 22, 16, [[0, '#ffffff'], [0.4, mid], [1, 'rgba(0,0,0,0)']])
      ctx.fillRect(0, 0, 40, 40)
      ctx.beginPath()
      ctx.moveTo(20, 6)
      ctx.bezierCurveTo(30, 16, 28, 28, 20, 34)
      ctx.bezierCurveTo(12, 28, 10, 16, 20, 6)
      ctx.fillStyle = mid
      ctx.fill()
      if (id === 'foxfire_ninefold') {
        ctx.strokeStyle = '#c8fff0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(20, 20, 12, 0.2, Math.PI - 0.2)
        ctx.stroke()
      }
    } else if (id.startsWith('hanabi')) {
      const body = id === 'hanabi_oni' ? '#ff3a20' : id === 'hanabi_galaxy' ? '#6a4cff' : '#9ef6ff'
      ctx.fillStyle = lin(ctx, 16, 4, 24, 36, [[0, '#ffffff'], [1, body]])
      ctx.beginPath()
      ctx.moveTo(20, 4)
      ctx.lineTo(28, 22)
      ctx.lineTo(20, 18)
      ctx.lineTo(12, 22)
      ctx.closePath()
      ctx.fill()
      if (id === 'hanabi_star') {
        star(ctx, 20, 14, 5, 6, 2.5)
        ctx.fillStyle = '#ffe066'
        ctx.fill()
      } else if (id === 'hanabi_oni') {
        disk(ctx, 16, 14, 1.4, '#1c0b26')
        disk(ctx, 24, 14, 1.4, '#1c0b26')
        ctx.strokeStyle = '#1c0b26'
        ctx.beginPath()
        ctx.arc(20, 18, 3, 0.2, Math.PI - 0.2)
        ctx.stroke()
      } else {
        disk(ctx, 20, 16, 5, radial(ctx, 18, 14, 6, [[0, '#ffffff'], [1, '#c084fc']]))
      }
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(18, 22, 4, 10)
    } else if (slash) {
      const color = id === 'katana_moon' ? '#d6e6ff' : id === 'katana_phoenix' ? '#ff9a3a' : '#ff3a5a'
      ctx.fillStyle = lin(ctx, 16, 0, 128, 48, [[0, 'rgba(255,255,255,0)'], [0.45, color], [1, '#ffffff']])
      ctx.beginPath()
      ctx.ellipse(64, 48, 60, 40, 0, -Math.PI / 2, Math.PI / 2)
      ctx.ellipse(50, 48, 46, 24, 0, Math.PI / 2, -Math.PI / 2, true)
      ctx.fill()
      if (id === 'katana_phoenix') {
        ctx.fillStyle = '#ffe066'
        ctx.beginPath()
        ctx.moveTo(96, 30)
        ctx.quadraticCurveTo(112, 48, 90, 62)
        ctx.quadraticCurveTo(104, 48, 96, 30)
        ctx.fill()
      } else if (id === 'katana_moon') {
        disk(ctx, 100, 40, 8, '#fffaf0')
        disk(ctx, 104, 38, 6, 'rgba(20,16,40,0.25)')
      } else {
        ctx.fillStyle = '#ffd0e0'
        for (const [x, y] of [[40, 30], [70, 62], [90, 28]]) ellipse(ctx, x, y, 5, 2.4, '#ffd0e0')
      }
    } else if (bolt) {
      const color = id === 'thunder_crimson' ? '#ff4060' : '#ffe066'
      ctx.strokeStyle = color
      ctx.lineWidth = 6
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(24, 0)
      const zig = [8, 36, 12, 40, 10, 34, 16]
      let y = 0
      zig.forEach((x, i) => {
        y += 32
        ctx.lineTo(i % 2 ? 24 + x : 24 - x, y)
      })
      ctx.lineTo(24, 256)
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (aura) {
      const color = id === 'aura_blood' ? 'rgba(255,60,90,' : 'rgba(60,220,140,'
      ctx.strokeStyle = color + '0.15)'
      ctx.lineWidth = 18
      ctx.beginPath()
      ctx.arc(64, 64, 48, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = color + '1)'
      ctx.lineWidth = 4
      ctx.shadowColor = color + '1)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(64, 64, 48, 0, Math.PI * 2)
      ctx.stroke()
      if (id === 'aura_blood') disk(ctx, 64, 64, 8, '#ff4f7b')
      else disk(ctx, 64, 64, 6, '#b8ffd8')
    }
    glossStreak(ctx, w, h)
  })
  const exclusiveSkin = /phoenix|divine|ninefold|galaxy/.test(id)
  const glow = exclusiveSkin ? '#ffd166' : id === 'shuriken_pizza' ? '#ffb03b' : id.includes('poison') || id.includes('jade') ? '#4affc8' : '#ffffff'
  return withGlow(aura || slash ? body : outlined(body, exclusiveSkin ? 1.8 : 1.15), glow, exclusiveSkin ? 10 : slash || aura || bolt ? 7 : 5)
}

function cosmeticPreview(def: CosmeticDef): string {
  if (def.kind === 'character_skin' && def.characterId && def.palette) {
    const base = CHARACTERS[def.characterId]
    return chibiCanvas({ ...base, palette: def.palette, pattern: def.pattern }, 5).toDataURL()
  }
  if (def.kind === 'weapon_skin') return weaponSkinCanvas(def.id).toDataURL()
  const tint = hex(def.tint ?? 0xffffff)
  const res = 4
  const c = paint(48, 48, (ctx) => {
    if (def.kind === 'ornament' && def.ornament) drawOrnament(ctx, def.ornament, tint)
    else if (def.kind === 'pet' && def.pet) {
      ctx.translate(4, 4)
      drawPet(ctx, def.pet)
    } else if (def.kind === 'effect' && def.effect) paintEffectPreview(ctx, def.effect, tint)
  }, res)
  const glow = def.rarity === 'exclusive' ? '#ffd166' : def.rarity === 'epic' ? '#c084fc' : def.rarity === 'rare' ? '#5fd3ff' : tint
  return withGlow(outlined(c, def.rarity === 'exclusive' ? 1.7 : 1.2, res), glow, def.rarity === 'exclusive' ? 7 : 4, res).toDataURL()
}

function skinnedDef(def: CosmeticDef): CharacterDef | null {
  if (def.kind !== 'character_skin' || !def.characterId || !def.palette) return null
  const base = CHARACTERS[def.characterId]
  const tier = def.rarity === 'common' ? undefined : def.rarity
  return { ...base, id: def.id, palette: def.palette, pattern: def.pattern, tier }
}

const CAST_URLS: Record<string, string> = {
  sakura: sakuraCast,
  rin: rinCast,
  kaede: kaedeCast,
  yuki: yukiCast,
  hikari: hikariCast,
  akane: akaneCast
}

const BOSS_URLS: Record<string, string> = {
  oniBoss: oniBossArt,
  shutendoji: shutenBossArt,
  kitsuneBoss: kitsuneBossArt,
  orochiBoss: orochiBossArt,
  raijinBoss: raijinBossArt,
  yukiBoss: yukiBossArt,
  wisp: wispArt,
  imp: impArt,
  crow: crowArt,
  kasa: kasaArt,
  yurei: yureiArt,
  brute: bruteArt,
  spider: spiderArt,
  kodama: kodamaArt,
  tengu: tenguArt,
  nurikabe: nurikabeArt,
  chochin: chochinArt,
  kappa: kappaArt,
  nue: nueArt
}

function loadImages(urls: Record<string, string>): Promise<Record<string, HTMLImageElement>> {
  return Promise.all(
    Object.entries(urls).map(
      ([id, url]) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve([id, img])
          img.onerror = () => reject(new Error(id))
          img.src = url
        })
    )
  ).then((pairs) => Object.fromEntries(pairs))
}

/** Painted character sheets. The top-right figure is Kaede even though the sheet labeled her Rin. */
export function loadCastImages(): Promise<Record<string, HTMLImageElement>> {
  return loadImages(CAST_URLS)
}

/** Painted bosses of the first world. */
export function loadBossImages(): Promise<Record<string, HTMLImageElement>> {
  return loadImages(BOSS_URLS)
}

const PET_URLS: Record<string, string> = {
  shikigami: shikigamiArt
}

/** Painted familiars that replace the procedural pet sprites. */
export function loadPetImages(): Promise<Record<string, HTMLImageElement>> {
  return loadImages(PET_URLS)
}

let projectileCharms: Record<string, HTMLImageElement> = {}

/** The flying ofuda uses the same charm art as the weapon icon. */
export function loadProjectileCharms(): Promise<void> {
  return loadImages({ talisman: omamoriProj, seal: sealProj }).then((imgs) => {
    projectileCharms = imgs
  })
}

/** On-screen height of a painted heroine, in world pixels. A little taller than the previous cut. */
const CAST_LOGICAL_H = 82

/** Places the full-resolution art so the waist matches the other chibis, without resampling. */
function castCanvas(img: HTMLImageElement): { canvas: HTMLCanvasElement; resolution: number } {
  const resolution = img.height / CAST_LOGICAL_H
  const waist = img.height * 0.62
  const canvasH = Math.max(img.height, Math.ceil(waist / PLAYER_ANCHOR_Y))
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, PLAYER_ANCHOR_Y * canvasH - waist)
  return { canvas, resolution }
}

/** Painted sticker, sized to a world height so the extra pixels stay sharp. */
function paintedFollower(img: HTMLImageElement, logicalH: number): Texture {
  const maxEdge = 512
  const fit = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * fit))
  canvas.height = Math.max(1, Math.round(img.height * fit))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = fit < 1
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return toTexture(canvas, canvas.height / logicalH)
}

/** The original crop, unscaled, so menus are not stretching a blurred enlargement. */
function castPortrait(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL()
}

export function createTextures(
  cast: Record<string, HTMLImageElement> = {},
  bosses: Record<string, HTMLImageElement> = {},
  petsArt: Record<string, HTMLImageElement> = {}
): GameTextures {
  const players: Record<string, Texture> = {}
  const portraits: Record<string, string> = {}
  for (const def of Object.values(CHARACTERS)) {
    const painted = cast[def.id]
    if (painted) {
      const sheet = castCanvas(painted)
      players[def.id] = toTexture(sheet.canvas, sheet.resolution)
      portraits[def.id] = castPortrait(painted)
    } else {
      players[def.id] = toTexture(chibiCanvas(def))
      portraits[def.id] = chibiCanvas(def, 6).toDataURL()
    }
  }
  for (const cosmetic of Object.values(COSMETICS)) {
    const painted = cast[cosmetic.id]
    if (painted) {
      const sheet = castCanvas(painted)
      players[cosmetic.id] = toTexture(sheet.canvas, sheet.resolution)
      portraits[cosmetic.id] = castPortrait(painted)
      continue
    }
    const skinned = skinnedDef(cosmetic)
    if (!skinned) continue
    players[cosmetic.id] = toTexture(chibiCanvas(skinned))
    portraits[cosmetic.id] = chibiCanvas(skinned, 6).toDataURL()
  }

  const enemies: Texture[] = []
  const enemiesWhite: Texture[] = []
  const enemyPortraits: string[] = []
  for (const def of ENEMIES) {
    const painted = bosses[def.key]
    if (painted) {
      const maxEdge = 1024
      const fit = Math.min(1, maxEdge / Math.max(painted.width, painted.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(painted.width * fit))
      canvas.height = Math.max(1, Math.round(painted.height * fit))
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = fit < 1
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(painted, 0, 0, canvas.width, canvas.height)
      const logicalH = def.boss ? Math.max(150, def.radius * 2.8) : Math.max(28, def.radius * 2.25)
      const resolution = canvas.height / logicalH
      enemies.push(toTexture(canvas, resolution))
      enemiesWhite.push(toTexture(silhouette(canvas, '#ffffff'), resolution))
      enemyPortraits.push(castPortrait(painted))
      continue
    }
    const size = Math.max(34, def.radius * 2.8)
    const detail = def.boss ? 6 : 5
    const base = paint(size, size, (ctx) => drawEnemy(ctx, def.key, size), detail)
    const body = def.key === 'wisp' ? base : outlined(base, def.boss ? 2.1 : 1.45, detail)
    const canvas = withGlow(body, hex(def.color, def.boss ? 0.95 : 0.72), def.boss ? 10 : 5, detail)
    enemies.push(toTexture(canvas, detail))
    enemiesWhite.push(toTexture(silhouette(canvas, '#ffffff'), detail))
    enemyPortraits.push(canvas.toDataURL())
  }

  const tex = (w: number, h: number, draw: (ctx: Ctx) => void): Texture => toTexture(paint(w, h, draw))

  const pets = {
    fox: toTexture(petCanvas('fox'), 4),
    wisp: toTexture(petCanvas('wisp'), 4),
    neko: toTexture(petCanvas('neko'), 4),
    lantern: toTexture(petCanvas('lantern'), 4),
    dragon: toTexture(petCanvas('dragon'), 4),
    owl: toTexture(petCanvas('owl'), 4),
    shikigami: petsArt.shikigami ? paintedFollower(petsArt.shikigami, 34) : toTexture(petCanvas('owl'), 4)
  } as const

  const ornaments = {
    halo: toTexture(ornamentCanvas('halo', '#ffe066'), 4),
    crown: toTexture(ornamentCanvas('crown', '#ffd166'), 4),
    lantern: toTexture(ornamentCanvas('lantern', '#ff8a3b'), 4),
    umbrella: toTexture(ornamentCanvas('umbrella', '#ff6fae'), 4),
    horns: toTexture(ornamentCanvas('horns', '#ff4060'), 4),
    wings: toTexture(ornamentCanvas('wings', '#ffc0e8'), 4),
    moon: toTexture(ornamentCanvas('moon', '#ffe8c8'), 4),
    mask: toTexture(ornamentCanvas('mask', '#fff4e0'), 4)
  } as const

  const chestCanvas = withGlow(
    outlined(
      paint(32, 26, (ctx) => {
        roundRect(ctx, 3, 10, 26, 13, 2, lin(ctx, 0, 10, 0, 23, [[0, '#d8243c'], [1, '#7a0a1c']]))
        roundRect(ctx, 3, 4, 26, 8, 4, lin(ctx, 0, 4, 0, 12, [[0, '#ff5a6a'], [1, '#b3122a']]))
        ctx.fillStyle = lin(ctx, 0, 0, 0, 26, [[0, '#fff3b0'], [1, '#c98a10']])
        ctx.fillRect(3, 11, 26, 2)
        ctx.fillRect(14, 4, 4, 19)
        roundRect(ctx, 13, 12, 6, 6, 1, '#fff6c8')
        ellipse(ctx, 9, 6.5, 4, 1.2, 'rgba(255,255,255,0.4)')
      })
    ),
    'rgba(255,209,102,1)',
    6
  )

  const weaponSkins: Record<string, Texture> = {}
  const previews: Record<string, string> = {}
  const trailTex = (kind: EffectKind): Texture => toTexture(paint(36, 36, (ctx) => {
    ctx.translate(18, 18)
    drawTrail(ctx, kind)
  }, 4), 4)
  const trails: Record<EffectKind, Texture> = {
    petals: trailTex('petals'),
    sparks: trailTex('sparks'),
    snow: trailTex('snow'),
    embers: trailTex('embers'),
    stars: trailTex('stars'),
    lightning: trailTex('lightning')
  }
  for (const def of Object.values(COSMETICS)) {
    if (def.kind === 'weapon_skin') weaponSkins[def.id] = toTexture(weaponSkinCanvas(def.id))
    const paintedPet = def.kind === 'pet' ? petsArt[def.pet ?? ''] : undefined
    previews[def.id] = paintedPet
      ? castPortrait(paintedPet)
      : def.kind === 'character_skin'
        ? portraits[def.id]
        : cosmeticPreview(def)
  }

  return {
    players,
    portraits,
    pets,
    ornaments,
    trails,
    weaponSkins,
    previews,
    enemies,
    enemiesWhite,
    enemyPortraits,
    projectiles: projectileCanvases().map(toTexture),
    gems: [0, 1, 2, 3, 4].map((tier) => toTexture(gemDiamondCanvas(tier))),
    heal: toTexture(
      withGlow(
        outlined(
          paint(24, 22, (ctx) => {
            ctx.fillStyle = lin(ctx, 0, 2, 0, 19, [[0, '#ffffff'], [1, '#e2def0']])
            ctx.beginPath()
            ctx.moveTo(12, 2)
            ctx.quadraticCurveTo(23, 18, 20, 19)
            ctx.lineTo(4, 19)
            ctx.quadraticCurveTo(1, 18, 12, 2)
            ctx.fill()
            roundRect(ctx, 7, 12, 10, 7, 1, lin(ctx, 0, 12, 0, 19, [[0, '#2f5a44'], [1, '#13291e']]))
            ellipse(ctx, 9, 8, 1.6, 1, 'rgba(255,170,190,0.9)')
            ellipse(ctx, 15, 8, 1.6, 1, 'rgba(255,170,190,0.9)')
          })
        ),
        'rgba(120,255,160,0.8)',
        4
      )
    ),
    gold: toTexture(
      withGlow(
        outlined(
          paint(18, 18, (ctx) => {
            ellipse(ctx, 9, 9, 7, 7, radial(ctx, 7, 7, 9, [[0, '#fff8c8'], [0.6, '#ffcc33'], [1, '#a86a00']]))
            ctx.fillStyle = '#7a4a00'
            ctx.fillRect(7.5, 7.5, 3, 3)
            ellipse(ctx, 6.5, 5.5, 2, 1, 'rgba(255,255,255,0.8)')
          }),
          1
        ),
        'rgba(255,209,102,0.9)',
        3
      )
    ),
    chest: toTexture(chestCanvas),
    chestIcon: chestCanvas.toDataURL(),
    magnet: toTexture(
      withGlow(
        outlined(
          paint(22, 22, (ctx) => {
            ctx.strokeStyle = lin(ctx, 0, 4, 0, 16, [[0, '#ff6b7a'], [1, '#a3121f']])
            ctx.lineWidth = 5
            ctx.lineCap = 'butt'
            ctx.beginPath()
            ctx.arc(11, 10, 6, Math.PI, 0)
            ctx.lineTo(17, 16)
            ctx.moveTo(5, 10)
            ctx.lineTo(5, 16)
            ctx.stroke()
            ctx.fillStyle = '#e6ecf8'
            ctx.fillRect(2.5, 15, 5, 4)
            ctx.fillRect(14.5, 15, 5, 4)
          })
        ),
        'rgba(160,220,255,0.9)',
        4
      )
    ),
    spark: tex(16, 16, (ctx) => {
      ctx.fillStyle = radial(ctx, 8, 8, 8, [
        [0, 'rgba(255,255,255,1)'],
        [0.35, 'rgba(255,255,255,0.8)'],
        [1, 'rgba(255,255,255,0)']
      ])
      ctx.fillRect(0, 0, 16, 16)
    }),
    glow: tex(64, 64, (ctx) => {
      ctx.fillStyle = radial(ctx, 32, 32, 32, [
        [0, 'rgba(255,255,255,0.85)'],
        [0.4, 'rgba(255,255,255,0.3)'],
        [1, 'rgba(255,255,255,0)']
      ])
      ctx.fillRect(0, 0, 64, 64)
    }),
    ring: tex(128, 128, (ctx) => {
      ctx.fillStyle = radial(ctx, 64, 64, 64, [
        [0, 'rgba(255,255,255,0)'],
        [0.72, 'rgba(255,255,255,0)'],
        [0.88, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,255,255,0)']
      ])
      ctx.fillRect(0, 0, 128, 128)
    }),
    slash: tex(128, 96, (ctx) => {
      ctx.fillStyle = lin(ctx, 20, 0, 128, 0, [
        [0, 'rgba(255,255,255,0)'],
        [0.6, 'rgba(255,255,255,0.75)'],
        [1, 'rgba(255,255,255,1)']
      ])
      ctx.beginPath()
      ctx.ellipse(64, 48, 62, 44, 0, -Math.PI / 2, Math.PI / 2)
      ctx.ellipse(52, 48, 52, 30, 0, Math.PI / 2, -Math.PI / 2, true)
      ctx.closePath()
      ctx.fill()
    }),
    bolts: [boltCanvas(7), boltCanvas(42), boltCanvas(1999)].map(toTexture),
    star: tex(24, 24, (ctx) => {
      ctx.fillStyle = '#ffffff'
      star(ctx, 12, 12, 4, 11, 2.5)
      ctx.fill()
    }),
    petal: tex(12, 8, (ctx) => {
      ctx.translate(6, 4)
      ctx.scale(0.42, 0.32)
      drawTrail(ctx, 'petals')
    }),
    shadow: tex(32, 14, (ctx) => {
      ctx.save()
      ctx.scale(1, 14 / 32)
      ctx.fillStyle = radial(ctx, 16, 16, 16, [
        [0, 'rgba(5,0,15,0.55)'],
        [1, 'rgba(5,0,15,0)']
      ])
      ctx.fillRect(0, 0, 32, 32)
      ctx.restore()
    }),
    aura: tex(128, 128, (ctx) => {
      ctx.fillStyle = radial(ctx, 64, 64, 64, [
        [0, 'rgba(255,255,255,0.05)'],
        [0.75, 'rgba(255,255,255,0.22)'],
        [0.93, 'rgba(255,255,255,0.7)'],
        [1, 'rgba(255,255,255,0)']
      ])
      ctx.fillRect(0, 0, 128, 128)
    }),
    vignette: tex(256, 256, (ctx) => {
      ctx.fillStyle = radial(ctx, 128, 128, 181, [
        [0, 'rgba(255,0,40,0)'],
        [0.55, 'rgba(255,0,40,0)'],
        [1, 'rgba(255,0,40,0.85)']
      ])
      ctx.fillRect(0, 0, 256, 256)
    }),
    moon: tex(256, 256, (ctx) => {
      ctx.fillStyle = radial(ctx, 128, 128, 128, [
        [0, 'rgba(255,240,220,0.5)'],
        [0.45, 'rgba(255,190,220,0.18)'],
        [1, 'rgba(255,150,200,0)']
      ])
      ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = radial(ctx, 116, 112, 60, [
        [0, '#fffaf0'],
        [0.8, '#ffe3ef'],
        [1, '#ffc2dc']
      ])
      ctx.beginPath()
      ctx.arc(128, 128, 56, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(230,170,200,0.35)'
      for (const [x, y, r] of [
        [108, 110, 10],
        [146, 138, 14],
        [124, 152, 7],
        [150, 104, 6]
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }),
    ground: Texture.from(groundCanvas()),
    groundAsh: Texture.from(ashGroundCanvas()),
    portal: toTexture(portalCanvas(), 4),
    props: propCanvases().map(toTexture)
  }
}
