// Centralized poop slot coordinates used across the app

const SLOT_DRAWS = {
  A4: { x: 104, y: 9,   w: 102, h: 149 },
  A3: { x: 67,  y: 27,  w: 102, h: 149 },
  A2: { x: 30,  y: 46,  w: 102, h: 149 },
  A1: { x: -7,  y: 64,  w: 102, h: 149 },
  B4: { x: 140, y: 26,  w: 102, h: 149 },
  B3: { x: 103, y: 45,  w: 102, h: 149 },
  B2: { x: 66,  y: 64,  w: 102, h: 149 },
  B1: { x: 29,  y: 82,  w: 102, h: 149 },
  C4: { x: 176, y: 44,  w: 102, h: 149 },
  C3: { x: 139, y: 63,  w: 102, h: 149 },
  C2: { x: 102, y: 81,  w: 102, h: 149 },
  C1: { x: 65,  y: 99,  w: 102, h: 149 },
  D4: { x: 212, y: 62,  w: 102, h: 149 },
  D3: { x: 175, y: 80,  w: 102, h: 149 },
  D2: { x: 138, y: 98,  w: 102, h: 149 },
  D1: { x: 101, y: 116, w: 102, h: 149 },
};

const SLOT_ORDER = [
  'A4','A3','A2','A1',
  'B4','B3','B2','B1',
  'C4','C3','C2','C1',
  'D4','D3','D2','D1',
];

module.exports = { SLOT_DRAWS, SLOT_ORDER };


