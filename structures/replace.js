const Canvas = require("@napi-rs/canvas");
const { imageCache } = require("./utils/imageCache.js");

async function drawHouseBase(ctx, home) {
  // Floor
  if (home.FLOOR_DATA?.FLOORI) {
    const floor = await imageCache.getImage(`./assests/floor/${home.FLOOR_DATA.FLOORI}.png`);
    if (floor) ctx.drawImage(floor, 0, 0, 300, 300);
  }

  // Walls (Left/Right)
  const wallTasks = [];
  if (home.WALL_DATA?.L1I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.L1I}.png`).then(img => img && ctx.drawImage(img, 6, 88, 37, 57)));
  if (home.WALL_DATA?.L2I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.L2I}.png`).then(img => img && ctx.drawImage(img, 43, 71, 37, 57)));
  if (home.WALL_DATA?.L3I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.L3I}.png`).then(img => img && ctx.drawImage(img, 79, 51, 37, 57)));
  if (home.WALL_DATA?.L4I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.L4I}.png`).then(img => img && ctx.drawImage(img, 114, 32, 37, 57)));

  if (home.WALL_DATA?.R1I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.R1I}.png`).then(img => img && ctx.drawImage(img, 150, 34, 37, 57)));
  if (home.WALL_DATA?.R2I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.R2I}.png`).then(img => img && ctx.drawImage(img, 187, 51, 37, 57)));
  if (home.WALL_DATA?.R3I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.R3I}.png`).then(img => img && ctx.drawImage(img, 222, 72, 37, 57)));
  if (home.WALL_DATA?.R4I) wallTasks.push(imageCache.getImage(`./assests/wallpaper/${home.WALL_DATA.R4I}.png`).then(img => img && ctx.drawImage(img, 258, 98, 37, 57)));

  await Promise.all(wallTasks);
}

async function drawFurniture(ctx, home) {
  const tasks = [];
  // Group A (ไกล → ใกล้)
  if (home.A_DATA?.A4I) tasks.push(imageCache.getImage(`./assests/furniture/${home.A_DATA.A4I}.png`).then(img => img && ctx.drawImage(img, 119, 24, 102, 149)));
  if (home.A_DATA?.A3I) tasks.push(imageCache.getImage(`./assests/furniture/${home.A_DATA.A3I}.png`).then(img => img && ctx.drawImage(img, 82, 42, 102, 149)));
  if (home.A_DATA?.A2I) tasks.push(imageCache.getImage(`./assests/furniture/${home.A_DATA.A2I}.png`).then(img => img && ctx.drawImage(img, 45, 61, 102, 149)));
  if (home.A_DATA?.A1I) tasks.push(imageCache.getImage(`./assests/furniture/${home.A_DATA.A1I}.png`).then(img => img && ctx.drawImage(img, 8, 79, 102, 149)));

  // Group B
  if (home.B_DATA?.B4I) tasks.push(imageCache.getImage(`./assests/furniture/${home.B_DATA.B4I}.png`).then(img => img && ctx.drawImage(img, 155, 41, 102, 149)));
  if (home.B_DATA?.B3I) tasks.push(imageCache.getImage(`./assests/furniture/${home.B_DATA.B3I}.png`).then(img => img && ctx.drawImage(img, 118, 60, 102, 149)));
  if (home.B_DATA?.B2I) tasks.push(imageCache.getImage(`./assests/furniture/${home.B_DATA.B2I}.png`).then(img => img && ctx.drawImage(img, 81, 79, 102, 149)));
  if (home.B_DATA?.B1I) tasks.push(imageCache.getImage(`./assests/furniture/${home.B_DATA.B1I}.png`).then(img => img && ctx.drawImage(img, 44, 97, 102, 149)));

  // Group C
  if (home.C_DATA?.C4I) tasks.push(imageCache.getImage(`./assests/furniture/${home.C_DATA.C4I}.png`).then(img => img && ctx.drawImage(img, 191, 59, 102, 149)));
  if (home.C_DATA?.C3I) tasks.push(imageCache.getImage(`./assests/furniture/${home.C_DATA.C3I}.png`).then(img => img && ctx.drawImage(img, 154, 78, 102, 149)));
  if (home.C_DATA?.C2I) tasks.push(imageCache.getImage(`./assests/furniture/${home.C_DATA.C2I}.png`).then(img => img && ctx.drawImage(img, 117, 96, 102, 149)));
  if (home.C_DATA?.C1I) tasks.push(imageCache.getImage(`./assests/furniture/${home.C_DATA.C1I}.png`).then(img => img && ctx.drawImage(img, 80, 114, 102, 149)));

  // Group D
  if (home.D_DATA?.D4I) tasks.push(imageCache.getImage(`./assests/furniture/${home.D_DATA.D4I}.png`).then(img => img && ctx.drawImage(img, 227, 77, 102, 149)));
  if (home.D_DATA?.D3I) tasks.push(imageCache.getImage(`./assests/furniture/${home.D_DATA.D3I}.png`).then(img => img && ctx.drawImage(img, 190, 95, 102, 149)));
  if (home.D_DATA?.D2I) tasks.push(imageCache.getImage(`./assests/furniture/${home.D_DATA.D2I}.png`).then(img => img && ctx.drawImage(img, 153, 113, 102, 149)));
  if (home.D_DATA?.D1I) tasks.push(imageCache.getImage(`./assests/furniture/${home.D_DATA.D1I}.png`).then(img => img && ctx.drawImage(img, 116, 131, 102, 149)));

  await Promise.all(tasks);
}

const replaceHouse = async function (client, interaction, ctx, home) {
  try {
    await drawHouseBase(ctx, home);
    await drawFurniture(ctx, home);
  } catch (error) {
    console.error('Error in replaceHouse:', error);
  }
}

module.exports = { replaceHouse, drawHouseBase, drawFurniture };