import type { IconKey } from '@/render/icons'
import type { StatMods } from './stats'

export interface PassiveDef {
  id: string
  name: string
  icon: IconKey
  description: string
  maxLevel: number
  perLevel: StatMods
}

const passive = (id: string, name: string, icon: IconKey, description: string, perLevel: StatMods, maxLevel = 8): PassiveDef => ({
  id,
  name,
  icon,
  description,
  perLevel,
  maxLevel
})

export const PASSIVES: Record<string, PassiveDef> = {
  bushido: passive('bushido', 'Espíritu Bushidō', 'crossed_swords', 'Aumenta el daño de todas las armas.', { might: 0.1 }),
  grimoire: passive('grimoire', 'Pergamino del Tiempo', 'hourglass', 'Reduce el enfriamiento de las armas.', { cooldown: -0.08 }),
  wind_sandals: passive('wind_sandals', 'Sandalias del Viento', 'leaf', 'Te mueves más rápido.', { moveSpeed: 0.1 }),
  spirit_lantern: passive('spirit_lantern', 'Farol Espiritual', 'lantern', 'Los efectos de las armas duran más.', { duration: 0.1 }),
  omamori: passive('omamori', 'Omamori', 'omamori', 'Más suerte: críticos, botín y mejores cofres.', { luck: 0.1 }),
  jade_heart: passive('jade_heart', 'Corazón de Jade', 'heart', 'Aumenta la vida máxima.', { maxHp: 20 }),
  crystal_lens: passive('crystal_lens', 'Lente de Cristal', 'crystal', 'Aumenta el área de las armas.', { area: 0.1 }),
  swift_scroll: passive('swift_scroll', 'Pergamino Veloz', 'feather', 'Los proyectiles vuelan más rápido.', { speed: 0.1 }),
  twin_mirror: passive('twin_mirror', 'Espejo Gemelo', 'mirror', 'Todas las armas disparan un proyectil extra.', { amount: 1 }, 2),
  magnet_bell: passive('magnet_bell', 'Campana Suzu', 'bell', 'Atrae objetos desde más lejos.', { magnet: 0.3 }),
  green_tea: passive('green_tea', 'Té Verde', 'tea', 'Regeneras vida con el tiempo.', { recovery: 0.25 }),
  iron_haori: passive('iron_haori', 'Haori de Hierro', 'armor', 'Reduce el daño recibido.', { armor: 1 })
}
