/**
 * Vector icons painted with Canvas 2D: emblem frame + symbol, with gradients,
 * glow and drop shadows. Used by the DOM UI (as data URLs) and the HUD.
 */

type Ctx = CanvasRenderingContext2D

export type IconFrame = 'weapon' | 'common' | 'evolution' | 'passive' | 'passive-rare' | 'passive-epic' | 'passive-legendary' | 'meta' | 'rare' | 'epic' | 'legendary' | 'none'

type PrestigeFamily = 'katana' | 'talisman' | 'kunai' | 'foxfire' | 'thunder' | 'aura' | 'shuriken' | 'hanabi'
type PrestigeTier = 'common' | 'rare' | 'epic' | 'legendary'
export type PrestigeIconKey = `${PrestigeFamily}_${PrestigeTier}`

export type IconKey =
  | 'katana'
  | 'sakura'
  | 'talisman'
  | 'seal'
  | 'kunai'
  | 'kunai_storm'
  | 'foxfire'
  | 'nine_tails'
  | 'thunder'
  | 'storm'
  | 'barrier'
  | 'torii'
  | 'shuriken'
  | 'fuuma'
  | 'rocket'
  | 'firework'
  | 'crossed_swords'
  | 'hourglass'
  | 'leaf'
  | 'lantern'
  | 'omamori'
  | 'heart'
  | 'crystal'
  | 'feather'
  | 'mirror'
  | 'bell'
  | 'tea'
  | 'armor'
  | 'book'
  | 'coin'
  | 'phoenix'
  | 'skull'
  | 'onigiri'
  | 'clock'
  | 'lock'
  | PrestigeIconKey

const INK = '#1c0b26'

// ---------------------------------------------------------------- primitives

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function rad(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][], r0 = 0): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

function glowOn(ctx: Ctx, color: string, blur: number): void {
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function dropShadow(ctx: Ctx): void {
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2
}

function noShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function fillStroke(ctx: Ctx, fill: string | CanvasGradient, stroke = INK, width = 2): void {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

function starPath(ctx: Ctx, x: number, y: number, points: number, outer: number, inner: number, rot = 0): void {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

function flamePath(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - h)
  ctx.bezierCurveTo(x + w * 0.2, y - h * 0.55, x + w, y - h * 0.35, x + w * 0.75, y + h * 0.05)
  ctx.bezierCurveTo(x + w * 0.55, y + h * 0.42, x - w * 0.55, y + h * 0.42, x - w * 0.75, y + h * 0.05)
  ctx.bezierCurveTo(x - w, y - h * 0.3, x - w * 0.15, y - h * 0.5, x, y - h)
  ctx.closePath()
}

function hexPath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
}

// ---------------------------------------------------------------- frames

const FRAME_COLORS: Record<Exclude<IconFrame, 'none'>, [string, string, string, string]> = {
  // light, dark, rim, glow
  weapon: ['#7a4cc9', '#22104a', '#ff8fc8', 'rgba(255,95,162,0.75)'],
  common: ['#d7dce6', '#3e4552', '#f7f8fb', 'rgba(210,216,228,0.55)'],
  evolution: ['#ffcf5a', '#8a2d6b', '#fff3c4', 'rgba(255,209,102,0.95)'],
  passive: ['#c6f5d0', '#24563a', '#f3fff4', 'rgba(140,220,160,0.65)'],
  'passive-rare': ['#8dffb0', '#0e6a38', '#e7ffef', 'rgba(70,230,120,0.85)'],
  'passive-epic': ['#3dff78', '#08662c', '#f4fff6', 'rgba(30,255,110,0.95)'],
  'passive-legendary': ['#e4ff6a', '#3f7a0c', '#fbffd8', 'rgba(210,255,70,1)'],
  meta: ['#c8406f', '#3a0d2e', '#ffd166', 'rgba(255,140,90,0.7)'],
  rare: ['#3ec6ff', '#0c2c4a', '#e7f8ff', 'rgba(95,211,255,0.9)'],
  epic: ['#c084fc', '#2a0d4a', '#f3e4ff', 'rgba(192,132,252,0.95)'],
  legendary: ['#ffe08a', '#7a3a08', '#fff6d0', 'rgba(255,209,102,1)']
}

function isPassiveFrame(frame: IconFrame): boolean {
  return frame === 'passive' || frame.startsWith('passive-')
}

function drawFrame(ctx: Ctx, frame: Exclude<IconFrame, 'none'>): void {
  const [light, dark, rim, glow] = FRAME_COLORS[frame]
  ctx.save()
  if (frame === 'evolution' || frame === 'legendary') {
    glowOn(ctx, glow, 10)
    ctx.fillStyle = rad(ctx, 32, 32, 31, [
      [0, 'rgba(255,240,180,0.9)'],
      [1, 'rgba(255,120,180,0)']
    ])
    starPath(ctx, 32, 32, 12, 31, 22, 0.13)
    ctx.fill()
  }
  glowOn(ctx, glow, 8)
  if (isPassiveFrame(frame)) hexPath(ctx, 32, 32, 27)
  else {
    ctx.beginPath()
    ctx.arc(32, 32, 26, 0, Math.PI * 2)
  }
  ctx.fillStyle = rad(ctx, 26, 22, 34, [
    [0, light],
    [1, dark]
  ])
  ctx.fill()
  noShadow(ctx)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = rim
  ctx.stroke()
  // inner bevel
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  if (isPassiveFrame(frame)) hexPath(ctx, 32, 32, 23)
  else {
    ctx.beginPath()
    ctx.arc(32, 32, 22.5, 0, Math.PI * 2)
  }
  ctx.stroke()
  // glossy top
  ctx.beginPath()
  ctx.ellipse(32, 19, 16, 7, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------- symbols

const CORE_SYMBOLS: Record<Exclude<IconKey, PrestigeIconKey>, (ctx: Ctx) => void> = {
  katana(ctx) {
    ctx.save()
    ctx.translate(32, 32)
    ctx.rotate(-Math.PI / 4)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(-3, -6)
    ctx.lineTo(-3, -25)
    ctx.quadraticCurveTo(1, -29, 3, -26)
    ctx.lineTo(3, -6)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, -3, 0, 3, 0, [[0, '#ffffff'], [0.5, '#dfe8ff'], [1, '#8b98c4']]), INK, 1.5)
    noShadow(ctx)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-1.2, -8)
    ctx.lineTo(-1.2, -24)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, -5, 7, 2.5, 0, 0, Math.PI * 2)
    fillStroke(ctx, lin(ctx, -7, 0, 7, 0, [[0, '#ffe08a'], [1, '#b8860b']]), INK, 1.5)
    ctx.beginPath()
    ctx.roundRect(-2.6, -3, 5.2, 16, 1.5)
    fillStroke(ctx, '#3a1d5c', INK, 1.5)
    ctx.fillStyle = '#ff5fa2'
    for (let y = -1; y < 12; y += 4) {
      ctx.beginPath()
      ctx.moveTo(-2.6, y)
      ctx.lineTo(0, y + 2)
      ctx.lineTo(2.6, y)
      ctx.lineTo(0, y - 2)
      ctx.fill()
    }
    ctx.restore()
  },

  sakura(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,150,200,0.9)', 8)
    for (let k = 0; k < 5; k++) {
      ctx.save()
      ctx.translate(32, 32)
      ctx.rotate((k / 5) * Math.PI * 2)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.bezierCurveTo(-10, -6, -9, -18, -3, -20)
      ctx.lineTo(0, -17)
      ctx.lineTo(3, -20)
      ctx.bezierCurveTo(9, -18, 10, -6, 0, 0)
      ctx.fillStyle = lin(ctx, 0, 0, 0, -20, [[0, '#ff4f98'], [1, '#ffe0ef']])
      ctx.fill()
      ctx.restore()
    }
    noShadow(ctx)
    ctx.fillStyle = rad(ctx, 32, 32, 6, [[0, '#fff6a8'], [1, '#ff9f1c']])
    ctx.beginPath()
    ctx.arc(32, 32, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffe066'
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.6
      ctx.beginPath()
      ctx.arc(32 + Math.cos(a) * 7.5, 32 + Math.sin(a) * 7.5, 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },

  talisman(ctx) {
    ctx.save()
    ctx.translate(32, 32)
    ctx.rotate(0.18)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.roundRect(-9, -20, 18, 40, 2)
    fillStroke(ctx, lin(ctx, 0, -20, 0, 20, [[0, '#fffaf0'], [1, '#f1dfb6']]), INK, 1.5)
    noShadow(ctx)
    ctx.strokeStyle = '#d8243c'
    ctx.lineWidth = 1.2
    ctx.strokeRect(-6.5, -17.5, 13, 35)
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(-3, -12)
    ctx.lineTo(3, -12)
    ctx.moveTo(0, -14)
    ctx.lineTo(0, -4)
    ctx.moveTo(-4, -6)
    ctx.lineTo(4, -2)
    ctx.moveTo(-3, 2)
    ctx.quadraticCurveTo(4, 4, -1, 9)
    ctx.moveTo(-3, 13)
    ctx.lineTo(3, 13)
    ctx.stroke()
    ctx.fillStyle = '#d8243c'
    ctx.beginPath()
    ctx.arc(0, 6, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  seal(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,209,102,0.9)', 8)
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(32, 32, 19, 0, Math.PI * 2)
    ctx.stroke()
    starPath(ctx, 32, 32, 5, 19, 7.5)
    ctx.stroke()
    noShadow(ctx)
    ctx.translate(32, 32)
    ctx.rotate(-0.15)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.roundRect(-7, -15, 14, 30, 2)
    fillStroke(ctx, lin(ctx, 0, -15, 0, 15, [[0, '#fff3c4'], [1, '#e9b84a']]), INK, 1.5)
    noShadow(ctx)
    ctx.strokeStyle = '#8a2bff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-3, -9)
    ctx.lineTo(3, -9)
    ctx.moveTo(0, -11)
    ctx.lineTo(0, 9)
    ctx.moveTo(-4, 1)
    ctx.lineTo(4, 5)
    ctx.stroke()
    ctx.restore()
  },

  kunai(ctx) {
    drawKunai(ctx, 32, 32, -Math.PI / 4, 1)
  },

  kunai_storm(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(160,220,255,0.8)', 6)
    ctx.strokeStyle = 'rgba(180,230,255,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(32, 34, 20, Math.PI * 0.9, Math.PI * 1.9)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(32, 34, 14, Math.PI * 1.1, Math.PI * 2.1)
    ctx.stroke()
    ctx.restore()
    drawKunai(ctx, 22, 36, -Math.PI / 2.6, 0.75)
    drawKunai(ctx, 42, 36, -Math.PI / 6, 0.75)
    drawKunai(ctx, 32, 32, -Math.PI / 3.5, 0.9)
  },

  foxfire(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(90,200,255,1)', 12)
    flamePath(ctx, 32, 38, 14, 26)
    ctx.fillStyle = rad(ctx, 32, 40, 24, [[0, '#ffffff'], [0.4, '#7fe9ff'], [1, '#2a5cff']])
    ctx.fill()
    noShadow(ctx)
    flamePath(ctx, 32, 40, 7, 13)
    ctx.fillStyle = rad(ctx, 32, 40, 12, [[0, '#ffffff'], [1, 'rgba(200,250,255,0.6)']])
    ctx.fill()
    ctx.restore()
  },

  nine_tails(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,240,190,1)', 12)
    ctx.beginPath()
    ctx.arc(32, 32, 13, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 28, 28, 15, [[0, '#ffffff'], [1, '#ffd98a']])
    ctx.fill()
    noShadow(ctx)
    ctx.fillStyle = 'rgba(220,170,90,0.35)'
    ctx.beginPath()
    ctx.arc(36, 35, 3, 0, Math.PI * 2)
    ctx.arc(28, 37, 2, 0, Math.PI * 2)
    ctx.fill()
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 - Math.PI / 2
      const x = 32 + Math.cos(a) * 21
      const y = 32 + Math.sin(a) * 21
      glowOn(ctx, 'rgba(200,110,255,1)', 8)
      flamePath(ctx, x, y + 3, 5, 9)
      ctx.fillStyle = rad(ctx, x, y + 3, 9, [[0, '#ffffff'], [0.5, '#e7a8ff'], [1, '#8a2bff']])
      ctx.fill()
    }
    ctx.restore()
  },

  thunder(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,230,90,1)', 12)
    ctx.beginPath()
    ctx.moveTo(36, 8)
    ctx.lineTo(18, 35)
    ctx.lineTo(30, 35)
    ctx.lineTo(25, 56)
    ctx.lineTo(46, 26)
    ctx.lineTo(34, 26)
    ctx.closePath()
    ctx.fillStyle = lin(ctx, 0, 8, 0, 56, [[0, '#ffffff'], [0.5, '#ffe066'], [1, '#ff9f1c']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  },

  storm(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,230,90,1)', 10)
    ctx.beginPath()
    ctx.moveTo(34, 26)
    ctx.lineTo(24, 42)
    ctx.lineTo(31, 42)
    ctx.lineTo(27, 56)
    ctx.lineTo(41, 37)
    ctx.lineTo(34, 37)
    ctx.lineTo(39, 26)
    ctx.closePath()
    ctx.fillStyle = lin(ctx, 0, 26, 0, 56, [[0, '#ffffff'], [1, '#ffd166']])
    ctx.fill()
    noShadow(ctx)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.arc(22, 24, 8, Math.PI * 0.5, Math.PI * 1.5)
    ctx.arc(30, 16, 9, Math.PI, Math.PI * 1.9)
    ctx.arc(42, 20, 8, Math.PI * 1.3, Math.PI * 0.4)
    ctx.lineTo(22, 32)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 0, 8, 0, 32, [[0, '#b9a8ff'], [1, '#4a3a8f']]), INK, 1.5)
    ctx.restore()
  },

  barrier(ctx) {
    ctx.save()
    for (let k = 0; k < 3; k++) {
      glowOn(ctx, 'rgba(255,110,190,1)', 8)
      ctx.strokeStyle = `rgba(255,${160 + k * 30},${210 + k * 15},${0.95 - k * 0.2})`
      ctx.lineWidth = 3 - k * 0.6
      ctx.beginPath()
      ctx.arc(32, 32, 9 + k * 6.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    noShadow(ctx)
    ctx.fillStyle = rad(ctx, 32, 32, 9, [[0, '#ffffff'], [1, 'rgba(255,140,200,0.2)']])
    ctx.beginPath()
    ctx.arc(32, 32, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  torii(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,209,102,0.9)', 10)
    ctx.fillStyle = rad(ctx, 32, 36, 20, [[0, 'rgba(255,240,180,0.9)'], [1, 'rgba(255,200,100,0)']])
    ctx.fillRect(10, 14, 44, 40)
    noShadow(ctx)
    dropShadow(ctx)
    const red = lin(ctx, 0, 12, 0, 54, [[0, '#ff5a4a'], [1, '#b3122a']])
    ctx.beginPath()
    ctx.moveTo(8, 16)
    ctx.quadraticCurveTo(32, 20, 56, 16)
    ctx.lineTo(55, 22)
    ctx.quadraticCurveTo(32, 25, 9, 22)
    ctx.closePath()
    fillStroke(ctx, red, INK, 1.5)
    ctx.beginPath()
    ctx.rect(13, 27, 38, 4)
    fillStroke(ctx, red, INK, 1.5)
    ctx.beginPath()
    ctx.rect(17, 22, 5, 32)
    ctx.rect(42, 22, 5, 32)
    fillStroke(ctx, red, INK, 1.5)
    ctx.beginPath()
    ctx.rect(29, 22, 6, 5)
    fillStroke(ctx, '#2b1d33', INK, 1)
    ctx.restore()
  },

  shuriken(ctx) {
    drawShuriken(ctx, 32, 32, 20, '#f2f6ff', '#7d8bb0')
  },

  fuuma(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(190,140,255,0.9)', 10)
    ctx.translate(32, 32)
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(-4, -3)
      ctx.quadraticCurveTo(-2, -18, 12, -24)
      ctx.quadraticCurveTo(4, -12, 5, -2)
      ctx.closePath()
      ctx.fillStyle = lin(ctx, 0, 0, 10, -24, [[0, '#6a4cb0'], [1, '#eadcff']])
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.3
      ctx.stroke()
    }
    noShadow(ctx)
    ctx.beginPath()
    ctx.arc(0, 0, 6, 0, Math.PI * 2)
    fillStroke(ctx, '#3a2d5c', INK, 1.5)
    ctx.beginPath()
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = '#c9a8ff'
    ctx.fill()
    ctx.restore()
  },

  rocket(ctx) {
    ctx.save()
    const colors = ['#ff5fa2', '#5ff2ff', '#ffd166']
    for (let k = 0; k < 9; k++) {
      glowOn(ctx, colors[k % 3], 6)
      ctx.fillStyle = colors[k % 3]
      ctx.beginPath()
      ctx.arc(16 + Math.sin(k * 2.3) * 5 - k * 0.3, 48 - k * 0.2 + Math.cos(k * 1.7) * 5, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    noShadow(ctx)
    ctx.translate(34, 30)
    ctx.rotate(Math.PI / 4)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.roundRect(-5, -10, 10, 24, 2)
    fillStroke(ctx, lin(ctx, -5, 0, 5, 0, [[0, '#ff6b5b'], [1, '#a3121f']]), INK, 1.5)
    ctx.beginPath()
    ctx.moveTo(-5, -10)
    ctx.lineTo(0, -20)
    ctx.lineTo(5, -10)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 0, -20, 0, -10, [[0, '#fff3b0'], [1, '#e0a020']]), INK, 1.5)
    noShadow(ctx)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-5, -2, 10, 3)
    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.moveTo(-5, 10)
    ctx.lineTo(-9, 16)
    ctx.lineTo(-5, 14)
    ctx.moveTo(5, 10)
    ctx.lineTo(9, 16)
    ctx.lineTo(5, 14)
    ctx.fill()
    ctx.restore()
  },

  firework(ctx) {
    ctx.save()
    const colors = ['#ff5fa2', '#5ff2ff', '#ffd166', '#b38cff', '#7dff9a']
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      const c = colors[k % colors.length]
      glowOn(ctx, c, 8)
      ctx.strokeStyle = c
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6)
      ctx.lineTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(32 + Math.cos(a) * 23, 32 + Math.sin(a) * 23, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    glowOn(ctx, '#ffffff', 10)
    ctx.fillStyle = '#ffffff'
    starPath(ctx, 32, 32, 4, 7, 2.5)
    ctx.fill()
    ctx.restore()
  },

  crossed_swords(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,120,90,0.9)', 10)
    flamePath(ctx, 32, 40, 12, 22)
    ctx.fillStyle = rad(ctx, 32, 40, 22, [[0, 'rgba(255,240,180,0.9)'], [1, 'rgba(255,80,60,0)']])
    ctx.fill()
    noShadow(ctx)
    for (const s of [-1, 1]) {
      ctx.save()
      ctx.translate(32, 33)
      ctx.rotate((s * Math.PI) / 4)
      dropShadow(ctx)
      ctx.beginPath()
      ctx.moveTo(-2.2, 4)
      ctx.lineTo(-2.2, -20)
      ctx.lineTo(0, -23)
      ctx.lineTo(2.2, -20)
      ctx.lineTo(2.2, 4)
      ctx.closePath()
      fillStroke(ctx, lin(ctx, -2, 0, 2, 0, [[0, '#ffffff'], [1, '#93a0cc']]), INK, 1.3)
      ctx.beginPath()
      ctx.rect(-6, 4, 12, 3)
      fillStroke(ctx, '#ffd166', INK, 1.2)
      ctx.beginPath()
      ctx.rect(-2, 7, 4, 10)
      fillStroke(ctx, '#3a1d5c', INK, 1.2)
      ctx.restore()
    }
    ctx.restore()
  },

  hourglass(ctx) {
    ctx.save()
    dropShadow(ctx)
    const wood = lin(ctx, 0, 0, 0, 64, [[0, '#d9a066'], [1, '#7a4a22']])
    ctx.beginPath()
    ctx.roundRect(16, 10, 32, 6, 2)
    ctx.roundRect(16, 48, 32, 6, 2)
    fillStroke(ctx, wood, INK, 1.5)
    noShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(20, 16)
    ctx.lineTo(44, 16)
    ctx.quadraticCurveTo(44, 26, 34, 32)
    ctx.quadraticCurveTo(44, 38, 44, 48)
    ctx.lineTo(20, 48)
    ctx.quadraticCurveTo(20, 38, 30, 32)
    ctx.quadraticCurveTo(20, 26, 20, 16)
    ctx.closePath()
    ctx.fillStyle = 'rgba(200,240,255,0.35)'
    ctx.fill()
    ctx.strokeStyle = '#cfefff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    glowOn(ctx, 'rgba(95,242,255,0.9)', 6)
    ctx.fillStyle = lin(ctx, 0, 20, 0, 48, [[0, '#9ff8ff'], [1, '#2a8cff']])
    ctx.beginPath()
    ctx.moveTo(24, 22)
    ctx.lineTo(40, 22)
    ctx.quadraticCurveTo(38, 27, 32, 30)
    ctx.quadraticCurveTo(26, 27, 24, 22)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(32, 32)
    ctx.lineTo(41, 47)
    ctx.lineTo(23, 47)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  },

  leaf(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(130,255,170,0.8)', 6)
    ctx.strokeStyle = 'rgba(200,255,220,0.9)'
    ctx.lineWidth = 2
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(8, 24 + k * 9)
      ctx.quadraticCurveTo(18, 20 + k * 9, 24, 26 + k * 9)
      ctx.stroke()
    }
    noShadow(ctx)
    ctx.translate(36, 32)
    ctx.rotate(-0.6)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(0, -20)
    ctx.bezierCurveTo(14, -12, 14, 10, 0, 20)
    ctx.bezierCurveTo(-14, 10, -14, -12, 0, -20)
    fillStroke(ctx, lin(ctx, -10, -20, 10, 20, [[0, '#b6ffc4'], [1, '#1f9a5a']]), INK, 1.5)
    noShadow(ctx)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(0, -16)
    ctx.lineTo(0, 18)
    for (let y = -10; y < 14; y += 6) {
      ctx.moveTo(0, y)
      ctx.lineTo(-6, y - 4)
      ctx.moveTo(0, y)
      ctx.lineTo(6, y - 4)
    }
    ctx.stroke()
    ctx.restore()
  },

  lantern(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,170,80,1)', 14)
    ctx.beginPath()
    ctx.ellipse(32, 33, 14, 16, 0, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 32, 33, 17, [[0, '#fff3c4'], [0.5, '#ff8a3b'], [1, '#c8202f']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = 'rgba(120,20,30,0.6)'
    ctx.lineWidth = 1
    for (let y = 22; y <= 44; y += 5.5) {
      ctx.beginPath()
      ctx.ellipse(32, y, 14 * Math.sqrt(Math.max(0, 1 - ((y - 33) / 16) ** 2)), 1.5, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.roundRect(24, 15, 16, 4, 1)
    ctx.roundRect(24, 47, 16, 4, 1)
    fillStroke(ctx, '#2b1d33', INK, 1)
    ctx.strokeStyle = '#2b1d33'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(32, 15)
    ctx.lineTo(32, 9)
    ctx.stroke()
    ctx.restore()
  },

  omamori(ctx) {
    ctx.save()
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(20, 20)
    ctx.quadraticCurveTo(32, 12, 44, 20)
    ctx.lineTo(44, 50)
    ctx.quadraticCurveTo(32, 54, 20, 50)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 20, 0, 44, 0, [[0, '#ff4f6a'], [1, '#9b0f2a']]), INK, 1.5)
    noShadow(ctx)
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 1.5
    ctx.strokeRect(24, 25, 16, 21)
    glowOn(ctx, 'rgba(255,209,102,1)', 6)
    ctx.fillStyle = '#ffd166'
    starPath(ctx, 32, 35.5, 5, 6, 2.5)
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(32, 17)
    ctx.quadraticCurveTo(26, 8, 22, 12)
    ctx.moveTo(32, 17)
    ctx.quadraticCurveTo(38, 8, 42, 12)
    ctx.stroke()
    ctx.restore()
  },

  heart(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(110,255,160,0.9)', 10)
    ctx.beginPath()
    ctx.moveTo(32, 50)
    ctx.bezierCurveTo(10, 36, 12, 14, 24, 15)
    ctx.bezierCurveTo(29, 15, 31, 19, 32, 22)
    ctx.bezierCurveTo(33, 19, 35, 15, 40, 15)
    ctx.bezierCurveTo(52, 14, 54, 36, 32, 50)
    ctx.closePath()
    ctx.fillStyle = lin(ctx, 16, 14, 48, 50, [[0, '#c8ffd8'], [0.45, '#33c977'], [1, '#0d6b3d']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.beginPath()
    ctx.ellipse(24, 23, 4, 2.5, -0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  crystal(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(190,140,255,1)', 12)
    ctx.beginPath()
    ctx.moveTo(32, 10)
    ctx.lineTo(46, 26)
    ctx.lineTo(32, 54)
    ctx.lineTo(18, 26)
    ctx.closePath()
    ctx.fillStyle = lin(ctx, 18, 10, 46, 54, [[0, '#f3e8ff'], [0.5, '#a66bff'], [1, '#3a1680']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.moveTo(32, 10)
    ctx.lineTo(46, 26)
    ctx.lineTo(32, 30)
    ctx.lineTo(18, 26)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(32, 30)
    ctx.lineTo(32, 54)
    ctx.stroke()
    ctx.restore()
  },

  feather(ctx) {
    ctx.save()
    ctx.translate(32, 32)
    ctx.rotate(0.6)
    glowOn(ctx, 'rgba(160,230,255,0.9)', 8)
    ctx.beginPath()
    ctx.moveTo(0, -24)
    ctx.bezierCurveTo(12, -14, 10, 10, 0, 22)
    ctx.bezierCurveTo(-10, 10, -12, -14, 0, -24)
    ctx.fillStyle = lin(ctx, 0, -24, 0, 22, [[0, '#ffffff'], [1, '#7fd0ff']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.3
    ctx.stroke()
    ctx.strokeStyle = 'rgba(40,80,140,0.6)'
    ctx.lineWidth = 1
    for (let y = -16; y < 16; y += 5) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(-7, y - 4)
      ctx.moveTo(0, y)
      ctx.lineTo(7, y - 4)
      ctx.stroke()
    }
    ctx.strokeStyle = '#2b4a7a'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(0, -20)
    ctx.lineTo(0, 28)
    ctx.stroke()
    ctx.restore()
  },

  mirror(ctx) {
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.arc(26, 28, 15, 0, Math.PI * 2)
    ctx.fillStyle = '#8ff4ff'
    ctx.fill()
    ctx.globalAlpha = 1
    dropShadow(ctx)
    ctx.beginPath()
    ctx.roundRect(33, 40, 6, 16, 2)
    fillStroke(ctx, '#7a4a22', INK, 1.3)
    ctx.beginPath()
    ctx.arc(36, 30, 15, 0, Math.PI * 2)
    fillStroke(ctx, lin(ctx, 20, 14, 52, 46, [[0, '#ffe08a'], [1, '#a36b00']]), INK, 1.5)
    noShadow(ctx)
    glowOn(ctx, 'rgba(160,240,255,0.9)', 6)
    ctx.beginPath()
    ctx.arc(36, 30, 11, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 32, 26, 14, [[0, '#ffffff'], [1, '#6fc8ff']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(30, 28)
    ctx.lineTo(36, 22)
    ctx.moveTo(32, 34)
    ctx.lineTo(41, 25)
    ctx.stroke()
    ctx.restore()
  },

  bell(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,209,102,0.9)', 10)
    ctx.beginPath()
    ctx.arc(32, 34, 15, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 27, 28, 18, [[0, '#fff6c8'], [0.5, '#ffc93a'], [1, '#b8770b']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(18, 36)
    ctx.lineTo(46, 36)
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(32, 42, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(31, 42, 2, 6)
    ctx.strokeStyle = '#e0243c'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(32, 19)
    ctx.quadraticCurveTo(24, 10, 20, 14)
    ctx.moveTo(32, 19)
    ctx.quadraticCurveTo(40, 10, 44, 14)
    ctx.stroke()
    ctx.restore()
  },

  tea(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,255,255,0.7)', 4)
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 2
    for (const x of [26, 33, 40]) {
      ctx.beginPath()
      ctx.moveTo(x, 22)
      ctx.bezierCurveTo(x - 4, 17, x + 4, 14, x, 8)
      ctx.stroke()
    }
    noShadow(ctx)
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(16, 26)
    ctx.lineTo(48, 26)
    ctx.quadraticCurveTo(47, 50, 32, 52)
    ctx.quadraticCurveTo(17, 50, 16, 26)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 16, 0, 48, 0, [[0, '#8fd6a6'], [1, '#2e7a52']]), INK, 1.5)
    noShadow(ctx)
    ctx.beginPath()
    ctx.ellipse(32, 26, 16, 4, 0, 0, Math.PI * 2)
    fillStroke(ctx, '#a6e86a', INK, 1.3)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(20, 32)
    ctx.quadraticCurveTo(21, 42, 26, 47)
    ctx.stroke()
    ctx.restore()
  },

  armor(ctx) {
    ctx.save()
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(32, 12)
    ctx.lineTo(50, 18)
    ctx.lineTo(48, 36)
    ctx.quadraticCurveTo(44, 48, 32, 54)
    ctx.quadraticCurveTo(20, 48, 16, 36)
    ctx.lineTo(14, 18)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 14, 12, 50, 54, [[0, '#d9e2f5'], [0.5, '#7d8bb0'], [1, '#3a4266']]), INK, 1.8)
    noShadow(ctx)
    ctx.strokeStyle = '#ff5fa2'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(32, 16)
    ctx.lineTo(32, 50)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    for (const y of [26, 34, 42]) {
      ctx.beginPath()
      ctx.moveTo(20, y - 2)
      ctx.quadraticCurveTo(32, y + 3, 44, y - 2)
      ctx.stroke()
    }
    glowOn(ctx, 'rgba(255,209,102,0.9)', 6)
    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.arc(32, 22, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  book(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(95,242,255,0.8)', 10)
    ctx.fillStyle = rad(ctx, 32, 24, 18, [[0, 'rgba(200,250,255,0.9)'], [1, 'rgba(95,242,255,0)']])
    ctx.fillRect(12, 6, 40, 30)
    noShadow(ctx)
    dropShadow(ctx)
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(32, 26)
      ctx.quadraticCurveTo(32 + s * 10, 20, 32 + s * 20, 24)
      ctx.lineTo(32 + s * 20, 48)
      ctx.quadraticCurveTo(32 + s * 10, 44, 32, 50)
      ctx.closePath()
      fillStroke(ctx, lin(ctx, 32, 0, 32 + s * 20, 0, [[0, '#e8ddc4'], [1, '#fffaf0']]), INK, 1.5)
    }
    noShadow(ctx)
    ctx.strokeStyle = 'rgba(80,60,120,0.5)'
    ctx.lineWidth = 1
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(32 + s * 4, 31 + k * 4)
        ctx.lineTo(32 + s * 16, 30 + k * 4)
        ctx.stroke()
      }
    }
    ctx.restore()
  },

  coin(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,209,102,0.9)', 10)
    ctx.beginPath()
    ctx.arc(32, 32, 18, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 26, 25, 22, [[0, '#fff8c8'], [0.55, '#ffcc33'], [1, '#a86a00']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.strokeStyle = 'rgba(140,80,0,0.7)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(32, 32, 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.rect(28, 28, 8, 8)
    fillStroke(ctx, '#5a3800', INK, 1.3)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.ellipse(25, 23, 4, 2, -0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  phoenix(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(255,140,60,1)', 12)
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(32, 34)
      ctx.bezierCurveTo(32 + s * 8, 20, 32 + s * 18, 14, 32 + s * 26, 12)
      ctx.bezierCurveTo(32 + s * 20, 20, 32 + s * 22, 26, 32 + s * 16, 32)
      ctx.bezierCurveTo(32 + s * 20, 34, 32 + s * 18, 40, 32 + s * 10, 40)
      ctx.closePath()
      ctx.fillStyle = lin(ctx, 32, 40, 32 + s * 26, 12, [[0, '#ff4f2a'], [0.6, '#ffb03b'], [1, '#fff3b0']])
      ctx.fill()
    }
    flamePath(ctx, 32, 44, 7, 18)
    ctx.fillStyle = rad(ctx, 32, 44, 16, [[0, '#ffffff'], [0.5, '#ffd166'], [1, '#ff4f2a']])
    ctx.fill()
    ctx.restore()
  },

  skull(ctx) {
    ctx.save()
    dropShadow(ctx)
    ctx.beginPath()
    ctx.arc(32, 28, 17, Math.PI * 0.8, Math.PI * 2.2)
    ctx.lineTo(42, 48)
    ctx.lineTo(22, 48)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 0, 10, 0, 50, [[0, '#ffffff'], [1, '#c9c2e6']]), INK, 2)
    noShadow(ctx)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.ellipse(25, 30, 5, 6, 0, 0, Math.PI * 2)
    ctx.ellipse(39, 30, 5, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(32, 36)
    ctx.lineTo(29, 41)
    ctx.lineTo(35, 41)
    ctx.fill()
    ctx.fillStyle = '#ff5fa2'
    ctx.beginPath()
    ctx.arc(26, 29, 1.5, 0, Math.PI * 2)
    ctx.arc(40, 29, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  onigiri(ctx) {
    ctx.save()
    dropShadow(ctx)
    ctx.beginPath()
    ctx.moveTo(32, 12)
    ctx.quadraticCurveTo(54, 46, 48, 50)
    ctx.lineTo(16, 50)
    ctx.quadraticCurveTo(10, 46, 32, 12)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, 0, 12, 0, 50, [[0, '#ffffff'], [1, '#e6e2f0']]), INK, 2)
    noShadow(ctx)
    ctx.beginPath()
    ctx.roundRect(22, 36, 20, 14, 2)
    ctx.fillStyle = lin(ctx, 0, 36, 0, 50, [[0, '#2f5a44'], [1, '#13291e']])
    ctx.fill()
    ctx.fillStyle = 'rgba(255,140,170,0.8)'
    ctx.beginPath()
    ctx.ellipse(27, 30, 3, 1.6, 0, 0, Math.PI * 2)
    ctx.ellipse(37, 30, 3, 1.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  clock(ctx) {
    ctx.save()
    glowOn(ctx, 'rgba(95,242,255,0.8)', 8)
    ctx.beginPath()
    ctx.arc(32, 32, 18, 0, Math.PI * 2)
    ctx.fillStyle = rad(ctx, 28, 26, 22, [[0, '#ffffff'], [1, '#bfe8ff']])
    ctx.fill()
    noShadow(ctx)
    ctx.strokeStyle = INK
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(32, 32)
    ctx.lineTo(32, 20)
    ctx.moveTo(32, 32)
    ctx.lineTo(41, 36)
    ctx.stroke()
    ctx.restore()
  },

  lock(ctx) {
    ctx.save()
    dropShadow(ctx)
    ctx.strokeStyle = '#c9c2e6'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(32, 26, 9, Math.PI, 0)
    ctx.lineTo(41, 32)
    ctx.moveTo(23, 26)
    ctx.lineTo(23, 32)
    ctx.stroke()
    ctx.beginPath()
    ctx.roundRect(18, 30, 28, 22, 4)
    fillStroke(ctx, lin(ctx, 0, 30, 0, 52, [[0, '#ffd166'], [1, '#a36b00']]), INK, 1.8)
    noShadow(ctx)
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(32, 39, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(31, 40, 2, 6)
    ctx.restore()
  }
}

function drawKunai(ctx: Ctx, x: number, y: number, angle: number, s: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(s, s)
  dropShadow(ctx)
  ctx.beginPath()
  ctx.moveTo(0, -24)
  ctx.lineTo(6, -6)
  ctx.lineTo(0, -2)
  ctx.lineTo(-6, -6)
  ctx.closePath()
  fillStroke(ctx, lin(ctx, -6, 0, 6, 0, [[0, '#ffffff'], [0.5, '#d4dcf5'], [1, '#6c78a3']]), INK, 1.5)
  noShadow(ctx)
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -21)
  ctx.lineTo(0, -5)
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(-2, -2, 4, 14, 1)
  fillStroke(ctx, '#3a2d5c', INK, 1.3)
  ctx.strokeStyle = '#3a2d5c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 15, 3.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#ff4f6a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 18)
  ctx.quadraticCurveTo(-5, 24, -2, 28)
  ctx.stroke()
  ctx.restore()
}

function drawShuriken(ctx: Ctx, x: number, y: number, r: number, light: string, dark: string): void {
  ctx.save()
  dropShadow(ctx)
  starPath(ctx, x, y, 4, r, r * 0.3, Math.PI / 4)
  fillStroke(ctx, lin(ctx, x - r, y - r, x + r, y + r, [[0, light], [1, dark]]), INK, 1.6)
  noShadow(ctx)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 1
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2 - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y, r * 0.17, 0, Math.PI * 2)
  ctx.fillStyle = INK
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------- public API

const PRESTIGE_FAMILIES = ['katana', 'talisman', 'kunai', 'foxfire', 'thunder', 'aura', 'shuriken', 'hanabi'] as const

function isPrestigeIcon(key: IconKey): key is PrestigeIconKey {
  const cut = key.lastIndexOf('_')
  if (cut < 0) return false
  const family = key.slice(0, cut)
  const tier = key.slice(cut + 1)
  return (PRESTIGE_FAMILIES as readonly string[]).includes(family) && (tier === 'common' || tier === 'rare' || tier === 'epic' || tier === 'legendary')
}

function drawPrestigeSymbol(ctx: Ctx, key: PrestigeIconKey): void {
  const cut = key.lastIndexOf('_')
  const family = key.slice(0, cut) as PrestigeFamily
  const tier = key.slice(cut + 1) as PrestigeTier
  const accent = tier === 'legendary' ? '#ffe08a' : tier === 'epic' ? '#e2c6ff' : tier === 'rare' ? '#9eebff' : '#f4f0ff'
  const metal = tier === 'legendary' ? '#fff1c2' : '#f4f7ff'
  ctx.save()
  ctx.translate(32, 32)
  const plate = tier === 'legendary' ? 'rgba(255,209,102,0.55)' : tier === 'epic' ? 'rgba(192,132,252,0.5)' : tier === 'rare' ? 'rgba(95,211,255,0.5)' : 'rgba(255,255,255,0.28)'
  ctx.beginPath()
  ctx.arc(0, 0, 21, 0, Math.PI * 2)
  ctx.fillStyle = rad(ctx, -6, -8, 24, [
    [0, 'rgba(255,255,255,0.7)'],
    [0.42, plate],
    [1, 'rgba(20,0,40,0)']
  ])
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, 18.2, 0, Math.PI * 2)
  ctx.strokeStyle = accent
  ctx.globalAlpha = tier === 'common' ? 0.45 : 0.8
  ctx.lineWidth = tier === 'epic' || tier === 'legendary' ? 1.6 : 1.15
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 15.2, -0.15, Math.PI * 0.72)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1.15
  ctx.stroke()
  ctx.globalAlpha = 1
  if (tier === 'legendary') {
    glowOn(ctx, 'rgba(255,209,102,0.95)', 8)
    starPath(ctx, 0, 0, 8, 18, 8, 0.2)
    ctx.fillStyle = 'rgba(255,209,102,0.35)'
    ctx.fill()
    noShadow(ctx)
  } else if (tier === 'epic') {
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
  const blade = (rot: number, len = 16): void => {
    ctx.save()
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(-1.6, 4)
    ctx.lineTo(-1.6, -len)
    ctx.quadraticCurveTo(0, -len - 3, 1.6, -len)
    ctx.lineTo(1.6, 4)
    ctx.closePath()
    fillStroke(ctx, lin(ctx, -2, 0, 2, 0, [[0, '#fff'], [1, metal]]), INK, 1.2)
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(-0.3, 2)
    ctx.lineTo(-0.3, -len + 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 4.2, 4.6, 1.6, 0, 0, Math.PI * 2)
    fillStroke(ctx, lin(ctx, -4, 3, 4, 5, [[0, '#ffe08a'], [1, '#a87410']]), INK, 1)
    ctx.beginPath()
    ctx.roundRect(-1.3, 5.2, 2.6, 6.5, 0.6)
    fillStroke(ctx, '#3a1d5c', INK, 0.8)
    ctx.fillStyle = accent
    ctx.fillRect(-1.3, 6.6, 2.6, 1.1)
    ctx.restore()
  }
  const petal = (rot: number, reach = 14): void => {
    ctx.save()
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-5, -reach * 0.4, -4, -reach, 0, -reach - 2)
    ctx.bezierCurveTo(4, -reach, 5, -reach * 0.4, 0, 0)
    fillStroke(ctx, lin(ctx, 0, 0, 0, -reach, [[0, '#ffd0e4'], [1, accent]]), INK, 1)
    ctx.restore()
  }
  const paper = (x: number, y: number, rot: number): void => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.roundRect(-4, -7, 8, 14, 1)
    fillStroke(ctx, lin(ctx, 0, -7, 0, 7, [[0, '#fffaf0'], [1, accent]]), INK, 1)
    ctx.fillStyle = INK
    ctx.fillRect(-2.2, -4, 4.4, 0.7)
    ctx.fillRect(-2.2, -2, 4.4, 0.7)
    ctx.fillStyle = '#d8243c'
    ctx.beginPath()
    ctx.arc(0, 2.2, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.restore()
  }
  const kunai = (rot: number, reach = 14): void => {
    ctx.save()
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0, -reach)
    ctx.lineTo(3.2, -reach + 8)
    ctx.lineTo(1.1, -reach + 8)
    ctx.lineTo(1.1, 2)
    ctx.lineTo(-1.1, 2)
    ctx.lineTo(-1.1, -reach + 8)
    ctx.lineTo(-3.2, -reach + 8)
    ctx.closePath()
    fillStroke(ctx, metal, INK, 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(0, -reach + 2)
    ctx.lineTo(0, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 3.2, 1.7, 0, Math.PI * 2)
    fillStroke(ctx, accent, INK, 0.8)
    ctx.restore()
  }
  const flame = (rot: number, reach = 12): void => {
    ctx.save()
    ctx.rotate(rot)
    ctx.translate(0, -reach)
    flamePath(ctx, 0, 4, 5, 10)
    fillStroke(ctx, lin(ctx, 0, -8, 0, 8, [[0, '#fff6d0'], [1, accent]]), INK, 1)
    flamePath(ctx, 0, 3, 2.4, 5)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.restore()
  }
  if (tier === 'common') {
    if (family === 'katana') blade(-0.7, 13)
    else if (family === 'talisman') paper(0, 0, -0.2)
    else if (family === 'kunai') kunai(-Math.PI / 2, 13)
    else if (family === 'foxfire') flame(-Math.PI / 2, 4)
    else if (family === 'shuriken') {
      starPath(ctx, 0, 0, 4, 9, 3.5, 0.4)
      fillStroke(ctx, metal, INK, 1.2)
    } else if (family === 'hanabi') {
      starPath(ctx, 0, 0, 5, 8, 3.5, 0.2)
      fillStroke(ctx, accent, INK, 1.1)
    } else if (family === 'aura') {
      ctx.beginPath()
      ctx.arc(0, 0, 8, 0, Math.PI * 2)
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(1, -12)
      ctx.lineTo(-3, 0)
      ctx.lineTo(1, 0)
      ctx.lineTo(-1, 12)
      ctx.lineTo(4, -1)
      ctx.lineTo(0, -1)
      ctx.closePath()
      fillStroke(ctx, accent, INK, 1.1)
    }
  } else if (family === 'katana' && tier === 'rare') {
    blade(-Math.PI / 4, 15)
    blade(Math.PI / 4, 15)
  } else if (family === 'katana' && tier === 'epic') {
    for (let i = 0; i < 6; i++) petal((i / 6) * Math.PI * 2, 13)
    blade(-Math.PI / 2, 12)
  } else if (family === 'katana') {
    for (let i = 0; i < 8; i++) petal((i / 8) * Math.PI * 2, 15)
    blade(-Math.PI / 2, 14)
  } else if (family === 'talisman' && tier === 'rare') {
    paper(-7, 2, -0.5)
    paper(0, -2, -0.05)
    paper(7, 2, 0.5)
  } else if (family === 'talisman' && tier === 'epic') {
    paper(-8, -6, -0.4)
    paper(0, 0, 0.1)
    paper(8, 7, 0.5)
  } else if (family === 'talisman') {
    paper(-10, 3, -0.7)
    paper(-4, -4, -0.25)
    paper(2, -6, 0.05)
    paper(8, -2, 0.35)
    paper(12, 4, 0.7)
  } else if (family === 'kunai' && tier === 'rare') {
    kunai(-Math.PI / 2, 8)
    kunai(-Math.PI / 2 + 0.45, 14)
    kunai(-Math.PI / 2 - 0.45, 14)
  } else if (family === 'kunai' && tier === 'epic') {
    for (let i = 0; i < 6; i++) kunai((i / 6) * Math.PI * 2, 14)
  } else if (family === 'kunai') {
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()
    for (let i = 0; i < 4; i++) kunai((i / 4) * Math.PI * 2 + 0.4, 16)
  } else if (family === 'foxfire' && tier === 'rare') {
    for (let i = 0; i < 4; i++) flame((i / 4) * Math.PI * 2, 8)
  } else if (family === 'foxfire' && tier === 'epic') {
    for (let i = 0; i < 8; i++) flame((i / 8) * Math.PI * 2, 12)
  } else if (family === 'foxfire') {
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    fillStroke(ctx, rad(ctx, -2, -2, 8, [[0, '#fff'], [1, accent]]), INK, 1.2)
    for (let i = 0; i < 9; i++) flame((i / 9) * Math.PI * 2, 13)
  } else if (family === 'thunder') {
    const bolt = (x: number, scale: number): void => {
      ctx.save()
      ctx.translate(x, 0)
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.moveTo(2, -16)
      ctx.lineTo(-4, 0)
      ctx.lineTo(1, 0)
      ctx.lineTo(-2, 16)
      ctx.lineTo(6, -2)
      ctx.lineTo(1, -2)
      ctx.closePath()
      fillStroke(ctx, lin(ctx, 0, -16, 0, 16, [[0, '#fff'], [1, accent]]), INK, 1.2)
      ctx.restore()
    }
    if (tier === 'rare') {
      bolt(-5, 0.7)
      bolt(6, 0.85)
    } else if (tier === 'epic') {
      ctx.beginPath()
      ctx.arc(0, 0, 15, 0, Math.PI * 2)
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.stroke()
      bolt(0, 0.9)
    } else {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6)
        ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16)
        ctx.strokeStyle = accent
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
      bolt(0, 1)
    }
  } else if (family === 'aura') {
    ctx.beginPath()
    ctx.arc(0, 0, tier === 'legendary' ? 8 : 11, 0, Math.PI * 2)
    ctx.strokeStyle = accent
    ctx.lineWidth = tier === 'legendary' ? 3 : 2
    ctx.stroke()
    if (tier !== 'rare') {
      ctx.beginPath()
      ctx.arc(0, 0, 15, 0, Math.PI * 2)
      ctx.lineWidth = 1.3
      ctx.stroke()
    }
    const n = tier === 'legendary' ? 8 : tier === 'epic' ? 6 : 4
    for (let i = 0; i < n; i++) petal((i / n) * Math.PI * 2, tier === 'rare' ? 8 : 12)
  } else if (family === 'shuriken') {
    const points = tier === 'legendary' ? 8 : tier === 'epic' ? 4 : 4
    const count = tier === 'rare' ? 3 : 1
    for (let k = 0; k < count; k++) {
      const ox = count === 1 ? 0 : (k - 1) * 9
      starPath(ctx, ox, count === 1 ? 0 : k === 1 ? 2 : -2, points, tier === 'rare' ? 7 : 14, tier === 'rare' ? 3 : 5, k)
      fillStroke(ctx, lin(ctx, ox - 8, -8, ox + 8, 8, [[0, metal], [1, accent]]), INK, 1.2)
    }
  } else {
    const burst = (r: number): void => {
      starPath(ctx, 0, 0, tier === 'legendary' ? 10 : 6, r, r * 0.45, 0.15)
      fillStroke(ctx, lin(ctx, 0, -r, 0, r, [[0, '#fff'], [1, accent]]), INK, 1.2)
    }
    if (tier === 'rare') {
      burst(6)
      ctx.fillStyle = accent
      ctx.fillRect(-1, -14, 2, 8)
      ctx.fillRect(-6, -6, 2, 8)
      ctx.fillRect(4, -4, 2, 8)
    } else if (tier === 'epic') burst(13)
    else burst(16)
  }
  if (tier !== 'legendary') {
    const n = tier === 'epic' ? 7 : tier === 'rare' ? 5 : 3
    const reach = tier === 'common' ? 17 : 19
    glowOn(ctx, accent, tier === 'epic' ? 7 : 4)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * reach, Math.sin(a) * reach, tier === 'epic' ? 1.8 : 1.25, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
    noShadow(ctx)
    if (tier !== 'common') {
      ctx.beginPath()
      ctx.arc(0, 0, tier === 'epic' ? 20 : 18, 0, Math.PI * 2)
      ctx.strokeStyle = accent
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  ctx.fillStyle = '#ffffff'
  starPath(ctx, -13, -12, 4, 2.3, 0.85, 0.25)
  ctx.fill()
  ctx.restore()
}

export function paintIcon(ctx: Ctx, key: IconKey, frame: IconFrame, size: number): void {
  ctx.save()
  ctx.scale(size / 64, size / 64)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (frame !== 'none') {
    drawFrame(ctx, frame)
    ctx.translate(32, 32)
    ctx.scale(0.78, 0.78)
    ctx.translate(-32, -32)
  }
  if (isPrestigeIcon(key)) drawPrestigeSymbol(ctx, key)
  else CORE_SYMBOLS[key](ctx)
  ctx.restore()
}

const cache = new Map<string, string>()

/** Data URL of an icon, rendered once at high resolution and cached. */
export function iconUrl(key: IconKey, frame: IconFrame = 'none', size = 128): string {
  const id = `${key}:${frame}:${size}`
  let url = cache.get(id)
  if (!url) {
    const c = document.createElement('canvas')
    c.width = c.height = size
    paintIcon(c.getContext('2d')!, key, frame, size)
    url = c.toDataURL()
    cache.set(id, url)
  }
  return url
}

export function iconImg(key: IconKey, frame: IconFrame = 'none', className = 'icon'): HTMLImageElement {
  const img = document.createElement('img')
  img.className = className
  img.src = iconUrl(key, frame)
  img.alt = ''
  img.draggable = false
  return img
}
