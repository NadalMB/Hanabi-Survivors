export const EnemyType = {
  Wisp: 0,
  Imp: 1,
  Crow: 2,
  Kasa: 3,
  Yurei: 4,
  Brute: 5,
  Spider: 6,
  OniBoss: 7,
  KitsuneBoss: 8,
  Kodama: 9,
  Tengu: 10,
  Nurikabe: 11,
  Chochin: 12,
  Kappa: 13,
  Nue: 14,
  OrochiBoss: 15,
  RaijinBoss: 16,
  YukiBoss: 17,
  Onibi: 18,
  Gaki: 19,
  Hinotori: 20,
  Hyottoko: 21,
  Funayurei: 22,
  Gozu: 23,
  Mukade: 24,
  Jubokko: 25,
  Amanojaku: 26,
  Wanyudo: 27,
  Hozuki: 28,
  Isoonna: 29,
  Baku: 30,
  Gashadokuro: 31,
  Tamamo: 32,
  Umibozu: 33,
  Raiju: 34,
  Hannya: 35,
  Gate: 36
} as const

export interface EnemyDef {
  type: number
  key: string
  name: string
  hp: number
  speed: number
  damage: number
  radius: number
  xp: number
  knockbackResist: number
  boss: boolean
  /** 1 = Noche de Hanabi, 2 = Ceniza Carmesí. The gate guardian is world 0 and appears in every world. */
  world: 0 | 1 | 2
  /** The minute-10 guardian. Always the same, and the only one that opens a portal. */
  gate?: boolean
  /** Particle colour used for death bursts. */
  color: number
  /** Album blurb. */
  blurb: string
}

/** Collectible frame for the album. Fodder is common, elites epic, bosses legendary. */
export function enemyRarity(def: EnemyDef): 'common' | 'rare' | 'epic' | 'legendary' | 'exclusive' {
  if (def.gate) return 'exclusive'
  if (def.boss) return 'legendary'
  if (def.xp >= 8 || def.knockbackResist >= 0.7) return 'epic'
  if (def.xp >= 3) return 'rare'
  return 'common'
}

export const ENEMIES: readonly EnemyDef[] = [
  { type: 0, key: 'wisp', name: 'Hitodama', hp: 6, speed: 72, damage: 5, radius: 11, xp: 1, knockbackResist: 0, boss: false, world: 1,  color: 0x6fe8ff, blurb: 'Llama errante. Llena la noche desde el primer minuto y no aguanta casi nada.' },
  { type: 1, key: 'imp', name: 'Oni menor', hp: 15, speed: 62, damage: 7, radius: 13, xp: 2, knockbackResist: 0.1, boss: false, world: 1,  color: 0xff5a5a, blurb: 'Diablillo de cuernos cortos. Persigue en manada y empuja poco.' },
  { type: 2, key: 'crow', name: 'Karasu', hp: 9, speed: 120, damage: 5, radius: 11, xp: 1, knockbackResist: 0, boss: false, world: 1,  color: 0x9a7cff, blurb: 'Cuervo tengu. Cruza la pantalla en bandada, muy rápido y frágil.' },
  { type: 3, key: 'kasa', name: 'Kasa-obake', hp: 32, speed: 78, damage: 9, radius: 14, xp: 3, knockbackResist: 0.2, boss: false, world: 1,  color: 0xc77dff, blurb: 'Sombrilla de un ojo. Más vida que los espíritus pequeños y un salto constante hacia ti.' },
  { type: 4, key: 'yurei', name: 'Yūrei', hp: 50, speed: 58, damage: 11, radius: 15, xp: 4, knockbackResist: 0.3, boss: false, world: 1,  color: 0xe6f0ff, blurb: 'Fantasma de funeral. Lento, frío y más duro de lo que parece.' },
  { type: 5, key: 'brute', name: 'Oni guerrero', hp: 140, speed: 46, damage: 16, radius: 22, xp: 9, knockbackResist: 0.7, boss: false, world: 1,  color: 0x4f8bff, blurb: 'Ogro con armadura. Casi no retrocede y parte la vida de un golpe.' },
  { type: 6, key: 'spider', name: 'Jorōgumo', hp: 80, speed: 96, damage: 13, radius: 16, xp: 6, knockbackResist: 0.4, boss: false, world: 1,  color: 0xff6ad5, blurb: 'Araña de seda. Corre entre la horda y castiga si la dejas acercarse.' },
  { type: 7, key: 'oniBoss', name: 'Gran Oni', hp: 2500, speed: 58, damage: 25, radius: 46, xp: 120, knockbackResist: 1, boss: true, world: 1,  color: 0xff3b3b, blurb: 'Se planta, carga en línea recta y remata con un pisotón. El primer jefe de la noche.' },
  { type: 8, key: 'kitsuneBoss', name: 'Reina Kitsune', hp: 7000, speed: 72, damage: 32, radius: 44, xp: 250, knockbackResist: 1, boss: true, world: 1,  color: 0xffe08a, blurb: 'Baila en círculo, embiste y aparece a tu espalda cuando cierra el ciclo.' },
  { type: 9, key: 'kodama', name: 'Kodama', hp: 34, speed: 48, damage: 8, radius: 14, xp: 3, knockbackResist: 0.35, boss: false, world: 1,  color: 0x8dff7a, blurb: 'Espíritu del árbol. Camina despacio, aguanta más que un oni menor y no se aparta.' },
  { type: 10, key: 'tengu', name: 'Tengu', hp: 22, speed: 88, damage: 11, radius: 14, xp: 3, knockbackResist: 0.15, boss: false, world: 1,  color: 0xff6a4a, blurb: 'Se agacha y salta una distancia larga. El salto es más peligroso que su paso.' },
  { type: 11, key: 'nurikabe', name: 'Nurikabe', hp: 260, speed: 26, damage: 18, radius: 28, xp: 10, knockbackResist: 0.9, boss: false, world: 1,  color: 0xb9c4d4, blurb: 'Muro con ojos. Avanza como una piedra y bloquea el camino con el cuerpo.' },
  { type: 12, key: 'chochin', name: 'Chōchin-obake', hp: 44, speed: 74, damage: 10, radius: 15, xp: 4, knockbackResist: 0.2, boss: false, world: 1,  color: 0xffb347, blurb: 'Linterna que te orbita y, de vez en cuando, se lanza de boca.' },
  { type: 13, key: 'kappa', name: 'Kappa', hp: 40, speed: 82, damage: 12, radius: 14, xp: 4, knockbackResist: 0.25, boss: false, world: 1,  color: 0x3ddc97, blurb: 'Dashes cortos y seguidos, como un chapoteo que no te deja quieto.' },
  { type: 14, key: 'nue', name: 'Nue', hp: 64, speed: 108, damage: 13, radius: 16, xp: 6, knockbackResist: 0.2, boss: false, world: 1,  color: 0xc9a6ff, blurb: 'Quimera de nube. Zigzaguea al volar y es difícil de clavar en el sitio.' },
  { type: 15, key: 'orochiBoss', name: 'Yamata no Orochi', hp: 9800, speed: 50, damage: 30, radius: 54, xp: 320, knockbackResist: 1, boss: true, world: 1,  color: 0x7dff9a, blurb: 'Tres dentelladas seguidas y, al terminar, escupe un anillo de hitodama.' },
  { type: 16, key: 'raijinBoss', name: 'Raijin', hp: 6400, speed: 66, damage: 22, radius: 42, xp: 260, knockbackResist: 1, boss: true, world: 1,  color: 0xffe14a, blurb: 'Se queda a distancia y marca dos rayos. Si sigues en el círculo cuando caen, duelen.' },
  { type: 17, key: 'yukiBoss', name: 'Yuki-onna', hp: 6000, speed: 68, damage: 20, radius: 40, xp: 260, knockbackResist: 1, boss: true, world: 1,  color: 0xbfe9ff, blurb: 'Hiela a quien se le acerca y abre una rueda de filos de hielo. Luego cambia de lado.' },
  { type: 18, key: 'onibi', name: 'Onibi', hp: 10, speed: 80, damage: 7, radius: 11, xp: 2, knockbackResist: 0, boss: false, world: 2, color: 0xff5a2a, blurb: 'Fuego fatuo carmesí. Más vivo que un hitodama y quema al rozarte.' },
  { type: 19, key: 'gaki', name: 'Gaki', hp: 24, speed: 66, damage: 10, radius: 13, xp: 3, knockbackResist: 0.15, boss: false, world: 2, color: 0xc45a3a, blurb: 'Espíritu hambriento. Se arrastra en manada y no suelta la presa.' },
  { type: 20, key: 'hinotori', name: 'Hi-no-tori', hp: 14, speed: 132, damage: 7, radius: 12, xp: 2, knockbackResist: 0, boss: false, world: 2, color: 0xffb03b, blurb: 'Ave de ceniza. Cruza el campo en bandada, más rápida que el karasu.' },
  { type: 21, key: 'hyottoko', name: 'Hyottoko', hp: 48, speed: 80, damage: 12, radius: 15, xp: 4, knockbackResist: 0.25, boss: false, world: 2, color: 0xffe08a, blurb: 'Máscara de fuelle. Salta hacia ti con la boca abierta.' },
  { type: 22, key: 'funayurei', name: 'Funayūrei', hp: 78, speed: 56, damage: 15, radius: 16, xp: 5, knockbackResist: 0.4, boss: false, world: 2, color: 0x8eb4c8, blurb: 'Ahogado de la ceniza. Lento, empapado y mucho más duro que un yūrei.' },
  { type: 23, key: 'gozu', name: 'Gozu', hp: 220, speed: 48, damage: 22, radius: 26, xp: 12, knockbackResist: 0.8, boss: false, world: 2, color: 0x8a3030, blurb: 'Cabeza de buey. Casi no retrocede y parte más que un oni guerrero.' },
  { type: 24, key: 'mukade', name: 'Mukade', hp: 120, speed: 100, damage: 18, radius: 16, xp: 8, knockbackResist: 0.45, boss: false, world: 2, color: 0xff4a3a, blurb: 'Ciempiés de brasa. Corre entre las patas y el mordisco duele.' },
  { type: 25, key: 'jubokko', name: 'Jubokko', hp: 52, speed: 44, damage: 12, radius: 16, xp: 4, knockbackResist: 0.5, boss: false, world: 2, color: 0x9a2030, blurb: 'Árbol de sangre. Avanza despacio y no se aparta del camino.' },
  { type: 26, key: 'amanojaku', name: 'Amanojaku', hp: 34, speed: 96, damage: 15, radius: 14, xp: 4, knockbackResist: 0.2, boss: false, world: 2, color: 0xff7a4a, blurb: 'Duende contrario. El salto es largo y cae encima de ti.' },
  { type: 27, key: 'wanyudo', name: 'Wanyūdō', hp: 400, speed: 30, damage: 24, radius: 30, xp: 14, knockbackResist: 0.95, boss: false, world: 2, color: 0xff6a20, blurb: 'Rueda de fuego con cara. Avanza como un muro y no se puede empujar.' },
  { type: 28, key: 'hozuki', name: 'Hozuki', hp: 66, speed: 76, damage: 14, radius: 15, xp: 5, knockbackResist: 0.25, boss: false, world: 2, color: 0xff4040, blurb: 'Farol de fruto. Te orbita y se lanza cuando cierra el círculo.' },
  { type: 29, key: 'isoonna', name: 'Iso-onna', hp: 60, speed: 92, damage: 16, radius: 15, xp: 5, knockbackResist: 0.3, boss: false, world: 2, color: 0x5ac8c8, blurb: 'Mujer de la orilla. Encadena dashes cortos que no te dejan quieto.' },
  { type: 30, key: 'baku', name: 'Baku', hp: 96, speed: 114, damage: 18, radius: 17, xp: 8, knockbackResist: 0.25, boss: false, world: 2, color: 0xd7b48a, blurb: 'Devorador de sueños. Zigzaguea y es difícil de clavar.' },
  { type: 31, key: 'gashadokuro', name: 'Gashadokuro', hp: 4200, speed: 52, damage: 34, radius: 56, xp: 180, knockbackResist: 1, boss: true, world: 2, color: 0xf4efe2, blurb: 'Esqueleto enorme. Carga en línea recta y aplasta con el pisotón.' },
  { type: 32, key: 'tamamo', name: 'Tamamo-no-Mae', hp: 11000, speed: 70, damage: 42, radius: 48, xp: 340, knockbackResist: 1, boss: true, world: 2, color: 0xffd0a0, blurb: 'Zorra de nueve colas. Baila, embiste y aparece a tu espalda.' },
  { type: 33, key: 'umibozu', name: 'Umibōzu', hp: 15000, speed: 44, damage: 40, radius: 62, xp: 420, knockbackResist: 1, boss: true, world: 2, color: 0x3a6a88, blurb: 'Sombra del mar. Tres zarpazos y, al cerrar, un anillo de brasas.' },
  { type: 34, key: 'raiju', name: 'Raijū', hp: 10000, speed: 68, damage: 30, radius: 46, xp: 340, knockbackResist: 1, boss: true, world: 2, color: 0xffe14a, blurb: 'Bestia del rayo. Se queda lejos y marca dos impactos. Sal del círculo.' },
  { type: 35, key: 'hannya', name: 'Hannya', hp: 9500, speed: 66, damage: 28, radius: 44, xp: 340, knockbackResist: 1, boss: true, world: 2, color: 0xff4a6a, blurb: 'Máscara celosa. Hiela al acercarte, abre una rueda de filos y cambia de lado.' },
  { type: 36, key: 'shutendoji', name: 'Shuten-dōji', hp: 28000, speed: 46, damage: 55, radius: 74, xp: 600, knockbackResist: 1, boss: true, world: 0, gate: true, color: 0xff2a2a, blurb: 'Guardián del portal. Siempre es el mismo: enorme, y mucho más fuerte que cualquier otro jefe. Al caer, abre el camino al siguiente mundo.' }
]
