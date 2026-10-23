// Định nghĩa ô bản đồ (dùng chung server + client)
export const T = {
  GRASS: 0,
  PATH: 1,
  STONE: 2,
  WATER: 3,
  TREE: 4,
  SAND: 5,
  SNOW: 6,
  ROCK: 7,
  FLOOR: 8,
  FLOWER: 9,
  ICE: 10,
  LAVA: 11,
  WALL: 12,
  BRIDGE: 13,
  BUSH: 14,
  PORTAL: 15,
  BAMBOO: 16,
  ROOF: 17,
  CRYSTAL: 18,
};

export const TILE = 32;

// Ô không thể đi qua
export const BLOCKED = new Set([T.TREE, T.ROCK, T.WALL, T.WATER, T.LAVA, T.BAMBOO, T.ROOF, T.CRYSTAL]);

export function isBlocked(t) {
  return BLOCKED.has(t);
}
