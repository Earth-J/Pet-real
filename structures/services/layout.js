function pushIf(layers, condition, type, key, draw, extra = {}) {
  if (!condition) return;
  layers.push({ type, key, draw, ...extra });
}

// CDN base for assets (match render-service default)
const ASSET_BASE_URL = (process.env.ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main').replace(/\/$/, '');

// Helper function to find secondary slot for 2x2 furniture
function findSecondarySlot(home, section, number) {
  // เช็คแนวนอน (ขวา)
  const nextNumber = number + 1;
  if (nextNumber <= 4 && home?.[`${section}_DATA`]?.[`${section}${nextNumber}I`] === "OCCUPIED") {
    return `${section}${nextNumber}`;
  }
  
  // เช็คแนวตั้ง (ล่าง)
  const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
  if (nextSection <= 'D' && home?.[`${nextSection}_DATA`]?.[`${nextSection}${number}I`] === "OCCUPIED") {
    return `${nextSection}${number}`;
  }
  
  return null;
}

// Helper function to push furniture layer with secondary slot info
function pushFurniture(layers, home, section, number, x, y, w = 102, h = 149) {
  const slotKey = `${section}${number}`;
  const furnitureName = home?.[`${section}_DATA`]?.[`${slotKey}I`];
  
  if (!furnitureName || furnitureName === "OCCUPIED") return;
  
  const secondarySlot = findSecondarySlot(home, section, number);
  // Use direct encoded URL to support names with spaces/special chars
  const encodedName = encodeURIComponent(String(furnitureName));
  const furnitureUrl = `${ASSET_BASE_URL}/furniture/${encodedName}.png`;
  pushIf(layers, true, 'furniture', furnitureName, { x, y, w, h }, { slot: slotKey, secondarySlot, url: furnitureUrl });
}

function buildHouseLayers(home, options = {}) {
  const { selectionOverlay = false } = options;
  const layers = [];
  const W = 300, H = 300;
  
  // Normalize missing sections to prevent undefined during previews
  const safeHome = home || {};
  if (!safeHome.FLOOR_DATA) safeHome.FLOOR_DATA = { FLOOR: false, FLOORI: '' };
  if (!safeHome.TILE_DATA) safeHome.TILE_DATA = { TILE: false, TILEI: '' };
  
  console.log('buildHouseLayers called with home:', {
    WALL_DATA: safeHome?.WALL_DATA,
    FLOOR_DATA: safeHome?.FLOOR_DATA,
    TILE_DATA: safeHome?.TILE_DATA
  });

  // room background image (default)
  // ใช้ภาพพื้นหลังห้องเริ่มต้นถ้ามีในโปรเจกต์
  pushIf(layers, true, 'room-bg', 'default', { x: 0, y: 0, w: W, h: H }); // ใช้ CDN background

  // floor (use direct URL to avoid slug mismatch)
  // Render if FLOORI exists, regardless of boolean flag, to match live preview behavior
  if (safeHome?.FLOOR_DATA?.FLOORI) {
    const floorKey = String(safeHome.FLOOR_DATA.FLOORI);
    const floorUrl = `${ASSET_BASE_URL}/floor/${encodeURIComponent(floorKey)}.png`;
    pushIf(layers, true, 'floor', floorKey, { x: 0, y: 0, w: W, h: H }, { url: floorUrl });
    console.log('Added floor layer:', floorKey, floorUrl);
  }

  // tile (use direct URL to avoid slug mismatch)
  // Render if TILEI exists, regardless of boolean flag, to match live preview behavior
  if (safeHome?.TILE_DATA?.TILEI) {
    const tileKey = String(safeHome.TILE_DATA.TILEI);
    const tileUrl = `${ASSET_BASE_URL}/tile/${encodeURIComponent(tileKey)}.png`;
    pushIf(layers, true, 'tile', tileKey, { x: 0, y: 0, w: W, h: H }, { url: tileUrl });
    console.log('Added tile layer:', tileKey, tileUrl);
  }

  // selection grid overlay (for position selection UI) - must be above floor/tile and below furniture
  if (selectionOverlay) {
    pushIf(layers, true, 'selection-overlay', 'select_Furnitureedit', { x: 0, y: 0, w: W, h: H }, {
      url: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/select_Furnitureedit.png',
      blendMode: 'multiply',
      opacity: 0.6
    });
  }

  // A slots
  pushFurniture(layers, safeHome, 'A', 4, 119, 24 + 24);
  pushFurniture(layers, safeHome, 'A', 3, 82, 42 + 24);
  pushFurniture(layers, safeHome, 'A', 2, 45, 61 + 24);
  pushFurniture(layers, safeHome, 'A', 1, 8, 79 + 24);

  // B slots
  pushFurniture(layers, safeHome, 'B', 4, 155, 41 + 24);
  pushFurniture(layers, safeHome, 'B', 3, 118, 60 + 24);
  pushFurniture(layers, safeHome, 'B', 2, 81, 79 + 24);
  pushFurniture(layers, safeHome, 'B', 1, 44, 97 + 24);

  // C slots
  pushFurniture(layers, safeHome, 'C', 4, 191, 59 + 24);
  pushFurniture(layers, safeHome, 'C', 3, 154, 78 + 24);
  pushFurniture(layers, safeHome, 'C', 2, 117, 96 + 24);
  pushFurniture(layers, safeHome, 'C', 1, 80, 114 + 24);

  // D slots
  pushFurniture(layers, safeHome, 'D', 4, 227, 77 + 24);
  pushFurniture(layers, safeHome, 'D', 3, 190, 95 + 24);
  pushFurniture(layers, safeHome, 'D', 2, 153, 113 + 24);
  pushFurniture(layers, safeHome, 'D', 1, 116, 131 + 24);

  // window overlay should be on top of furniture
  const thailandTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
  const hour = thailandTime.getHours();
  const isNightTime = hour >= 18 || hour < 6;
  if (isNightTime) {
    pushIf(layers, true, 'window-overlay', 'windows_night_full', { x: 0, y: 0, w: W, h: H }, { 
      url: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/windows_night_full.png' 
    });
  } else {
    pushIf(layers, true, 'window-overlay', 'windows', { x: 0, y: 0, w: W, h: H }, { 
      url: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/windows.png' 
    });
  }

  console.log('buildHouseLayers completed. Total layers:', layers.length);
  console.log('Window overlay layers:', layers.filter(l => l.type === 'window-overlay'));
  
  return layers;
}

module.exports = { buildHouseLayers }; 