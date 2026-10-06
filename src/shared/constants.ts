import pkg from '../../package.json'

export const GAME_TITLE = 'Hanabi Survivors'
/** Same number as package.json, so the menu and the portable filename stay together. */
export const GAME_VERSION = pkg.version

/** Bumped whenever the network message format changes; mismatched peers are rejected. */
export const PROTOCOL_VERSION = 9

export const SIM_HZ = 60
export const SIM_DT = 1 / SIM_HZ
export const NET_SNAPSHOT_HZ = 20

export const MAX_PLAYERS = 4
export const LAN_DEFAULT_PORT = 27015
export const LAN_BROADCAST_ID = 0xffff
/** Prefix for PeerJS ids so invite codes don't collide with other apps on the public broker. */
export const PEER_ID_PREFIX = 'hanabi-survivors-v1-'

export const MAX_ENEMIES = 2500
export const MAX_PROJECTILES = 4000
export const MAX_PICKUPS = 3000
