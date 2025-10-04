function pushIf(layers, condition, type, key, draw, extra = {}) {
  if (!condition) return;
  layers.push({ type, key, draw, ...extra });
}

function buildHouseLayers(home) {
  const layers = [];
  const W = 300, H = 300;

  // room background image (default)
  // ใช้ภาพพื้นหลังห้องเริ่มต้นถ้ามีในโปรเจกต์
  pushIf(layers, true, 'room-bg', 'default', { x: 0, y: 0, w: W, h: H }); // ใช้ CDN background

  // floor
  if (home?.FLOOR_DATA?.FLOOR && home.FLOOR_DATA.FLOORI) {
    pushIf(layers, true, 'floor', home.FLOOR_DATA.FLOORI, { x: 0, y: 0, w: W, h: H });
  }

  // Walls - Left
  pushIf(layers, !!home?.WALL_DATA?.L1I, 'wallpaper-left', home.WALL_DATA.L1I, { x: 6, y: 88, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.L2I, 'wallpaper-left', home.WALL_DATA.L2I, { x: 43, y: 71, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.L3I, 'wallpaper-left', home.WALL_DATA.L3I, { x: 79, y: 51, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.L4I, 'wallpaper-left', home.WALL_DATA.L4I, { x: 114, y: 32, w: 37, h: 57 });

  // Walls - Right
  pushIf(layers, !!home?.WALL_DATA?.R1I, 'wallpaper-right', home.WALL_DATA.R1I, { x: 150, y: 34, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.R2I, 'wallpaper-right', home.WALL_DATA.R2I, { x: 187, y: 51, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.R3I, 'wallpaper-right', home.WALL_DATA.R3I, { x: 222, y: 72, w: 37, h: 57 });
  pushIf(layers, !!home?.WALL_DATA?.R4I, 'wallpaper-right', home.WALL_DATA.R4I, { x: 258, y: 98, w: 37, h: 57 });

  // Furniture - ลำดับจากไกลไปใกล้ (A4..A1, B4..B1, C4..C1, D4..D1)
  pushIf(layers, !!home?.A_DATA?.A4I, 'furniture', home.A_DATA.A4I, { x: 119, y: 24, w: 102, h: 149 }, { slot: 'A4' });
  pushIf(layers, !!home?.A_DATA?.A3I, 'furniture', home.A_DATA.A3I, { x: 82, y: 42, w: 102, h: 149 }, { slot: 'A3' });
  pushIf(layers, !!home?.A_DATA?.A2I, 'furniture', home.A_DATA.A2I, { x: 45, y: 61, w: 102, h: 149 }, { slot: 'A2' });
  pushIf(layers, !!home?.A_DATA?.A1I, 'furniture', home.A_DATA.A1I, { x: 8, y: 79, w: 102, h: 149 }, { slot: 'A1' });

  pushIf(layers, !!home?.B_DATA?.B4I, 'furniture', home.B_DATA.B4I, { x: 155, y: 41, w: 102, h: 149 }, { slot: 'B4' });
  pushIf(layers, !!home?.B_DATA?.B3I, 'furniture', home.B_DATA.B3I, { x: 118, y: 60, w: 102, h: 149 }, { slot: 'B3' });
  pushIf(layers, !!home?.B_DATA?.B2I, 'furniture', home.B_DATA.B2I, { x: 81, y: 79, w: 102, h: 149 }, { slot: 'B2' });
  pushIf(layers, !!home?.B_DATA?.B1I, 'furniture', home.B_DATA.B1I, { x: 44, y: 97, w: 102, h: 149 }, { slot: 'B1' });

  pushIf(layers, !!home?.C_DATA?.C4I, 'furniture', home.C_DATA.C4I, { x: 191, y: 59, w: 102, h: 149 }, { slot: 'C4' });
  pushIf(layers, !!home?.C_DATA?.C3I, 'furniture', home.C_DATA.C3I, { x: 154, y: 78, w: 102, h: 149 }, { slot: 'C3' });
  pushIf(layers, !!home?.C_DATA?.C2I, 'furniture', home.C_DATA.C2I, { x: 117, y: 96, w: 102, h: 149 }, { slot: 'C2' });
  pushIf(layers, !!home?.C_DATA?.C1I, 'furniture', home.C_DATA.C1I, { x: 80, y: 114, w: 102, h: 149 }, { slot: 'C1' });

  pushIf(layers, !!home?.D_DATA?.D4I, 'furniture', home.D_DATA.D4I, { x: 227, y: 77, w: 102, h: 149 }, { slot: 'D4' });
  pushIf(layers, !!home?.D_DATA?.D3I, 'furniture', home.D_DATA.D3I, { x: 190, y: 95, w: 102, h: 149 }, { slot: 'D3' });
  pushIf(layers, !!home?.D_DATA?.D2I, 'furniture', home.D_DATA.D2I, { x: 153, y: 113, w: 102, h: 149 }, { slot: 'D2' });
  pushIf(layers, !!home?.D_DATA?.D1I, 'furniture', home.D_DATA.D1I, { x: 116, y: 131, w: 102, h: 149 }, { slot: 'D1' });

  return layers;
}

module.exports = { buildHouseLayers }; 