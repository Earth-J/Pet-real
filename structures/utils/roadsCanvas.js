// Canvas renderer for Baccarat roads using @napi-rs/canvas
let CanvasLib = null;
try {
    // Lazy require to allow fallback when not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    CanvasLib = require("@napi-rs/canvas");
} catch (_) {
    CanvasLib = null;
}

const CELL = 18; // Big Road cell size (smaller)
const DERIVED_CELL = 12; // Derived roads very compact
const GAP = 1; // tighter gap
const PADDING = 10; // compact padding
const TITLE_H = 16; // compact title bar

function getViewStart(totalCols, viewCols) {
    return Math.max(0, totalCols - viewCols);
}

function compressColumns(columns, rows = 6, mode = 'none') {
    if (mode === 'top') {
        return columns.map(col => Array.isArray(col) ? col.filter(Boolean) : []);
    }
    if (mode === 'bottom') {
        return columns.map(col => {
            const compact = (Array.isArray(col) ? col.filter(Boolean) : []);
            const out = Array(rows).fill(null);
            let r = rows - 1, i = compact.length - 1;
            while (r >= 0 && i >= 0) { out[r] = compact[i]; r--; i--; }
            return out;
        });
    }
    if (mode === 'mixed') {
        return columns.map(col => {
            if (!Array.isArray(col)) return [];
            const compact = col.filter(Boolean);
            const hadNulls = col.length > compact.length; // overflow-generated columns contain leading nulls
            if (!hadNulls) {
                return compact; // top-anchored
            }
            const out = Array(rows).fill(null);
            let r = rows - 1, i = compact.length - 1;
            while (r >= 0 && i >= 0) { out[r] = compact[i]; r--; i--; }
            return out;
        });
    }
    return columns;
}

function remapTieForTopCompression(mark, columns) {
    const col = columns[mark.col] || [];
    let countNonNullUpToRow = 0;
    for (let r = 0; r <= mark.row && r < col.length; r++) {
        if (col[r]) countNonNullUpToRow++;
    }
    return { ...mark, row: Math.max(0, countNonNullUpToRow - 1) };
}

function remapTieForBottomCompression(mark, columns, rows = 6) {
    const col = columns[mark.col] || [];
    let countNonNullUpToRow = 0;
    let totalNonNull = 0;
    for (let r = 0; r < col.length; r++) {
        if (col[r]) {
            totalNonNull++;
            if (r <= mark.row) countNonNullUpToRow++;
        }
    }
    const k = Math.max(0, countNonNullUpToRow - 1); // rank within compacted
    const L = totalNonNull;
    const newRow = Math.max(0, Math.min(rows - 1, (rows - L) + k));
    return { ...mark, row: newRow };
}

function remapTieForMixedCompression(mark, columns, rows = 6) {
    const col = columns[mark.col] || [];
    const compactLen = Array.isArray(col) ? col.filter(Boolean).length : 0;
    const hadNulls = Array.isArray(col) ? (col.length > compactLen) : false;
    if (!hadNulls) {
        // top-anchored mapping
        return remapTieForTopCompression(mark, columns);
    }
    // bottom-anchored mapping
    return remapTieForBottomCompression(mark, columns, rows);
}

function drawGrid(ctx, startX, startY, rows, cols, cellSize = CELL) {
    ctx.strokeStyle = "#dcdcdc"; // light gray grid
    ctx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) {
        const y = startY + r * (cellSize + GAP);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + cols * (cellSize + GAP) - GAP, y);
        ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
        const x = startX + c * (cellSize + GAP);
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + rows * (cellSize + GAP) - GAP);
        ctx.stroke();
    }
}

function drawCircleCell(ctx, x, y, color, { strokeOnly = false, scale = 1, cellSize = CELL } = {}) {
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    const radius = Math.floor((cellSize / 2 - 2) * scale);
    ctx.beginPath();
    if (strokeOnly) {
        ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.fillStyle = color;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawSlashCell(ctx, x, y, color, cellSize = CELL) {
    const margin = 4;
    const x1 = x + margin;
    const y1 = y + cellSize - margin;
    const x2 = x + cellSize - margin;
    const y2 = y + margin;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function renderPanel(ctx, title, matrix, startX, startY, rows = 6, cols = 12, legend, symbol, cellSize = CELL) {
    // Title
    ctx.fillStyle = "#111111";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(title, startX, startY + 14);
    if (legend) {
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#444444";
        ctx.fillText(legend, startX + 110, startY + 14);
    }
    const gridY = startY + TITLE_H;
    const gridX = startX;
    drawGrid(ctx, gridX, gridY, rows, cols, cellSize);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const v = matrix[r][c];
            if (!v) continue;
            const x = gridX + c * (cellSize + GAP);
            const y = gridY + r * (cellSize + GAP);
            // v is a color string; symbol decides drawing style
            if (symbol === "hollow") {
                drawCircleCell(ctx, x, y, v, { strokeOnly: true, scale: 1.0, cellSize });
            } else if (symbol === "small") {
                drawCircleCell(ctx, x, y, v, { strokeOnly: false, scale: 0.8, cellSize });
            } else if (symbol === "slash") {
                drawSlashCell(ctx, x, y, v, cellSize);
            } else {
                drawCircleCell(ctx, x, y, v, { strokeOnly: false, scale: 1.0, cellSize });
            }
        }
    }
}

function toMatrixFromColumns(columns, rows = 6, cols = 12, colorMap) {
    const sliced = columns.slice(getViewStart(columns.length, cols));
    const view = sliced.filter(col => Array.isArray(col) && col.some(Boolean));
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let c = 0; c < view.length; c++) {
        const col = view[c];
        for (let r = 0; r < Math.min(col.length, rows); r++) {
            const sym = col[r];
            const color = colorMap[sym];
            matrix[r][c] = color || null;
        }
    }
    return matrix;
}

// Build a composite image containing Big Road and three derived roads, stacked vertically
// - bigRoadColumns: columns of symbols 'B'|'P'
// - derived: object with { bigEyeColumns, smallColumns, cockroachColumns } where entries are 'R'|'B' (pattern vs change)
async function renderRoadsComposite({ widthCols = 12, heightRows = 6, bigRoadColumns, bigEyeColumns, smallColumns, cockroachColumns, askPredict, tieMarks } ) {
    if (!CanvasLib) {
        console.warn('[roadsCanvas] Canvas lib not available, skip image render');
        return null;
    }
    const cols = widthCols;
    const rows = heightRows;
    // Layout: Big Road on top full width; bottom row has three derived panels side-by-side
    const panelHeight = TITLE_H + rows * (CELL + GAP) - GAP + PADDING;
    const bigWidth = PADDING + cols * (CELL + GAP) - GAP + PADDING;
    const width = bigWidth;
    const smallWidth = Math.floor((width - PADDING * 2) / 3);
    const height = PADDING + panelHeight /* top */ + panelHeight /* bottom row height */ + PADDING;
    const canvas = CanvasLib.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff"; // white theme
    ctx.fillRect(0, 0, width, height);

    const bigColorMap = { B: "#d32d2d", P: "#1976d2" }; // red banker, blue player
    const derivedColorMap = { R: "#d32d2d", B: "#1976d2" }; // red pattern/continue, blue change

    // Top: Big Road full width
    let offsetY = PADDING;
    const displayBigColumns = compressColumns(bigRoadColumns, rows, 'mixed'); // per-column: top if no overflow, bottom if overflow
    const bigMatrix = toMatrixFromColumns(displayBigColumns, rows, cols, bigColorMap);
    renderPanel(ctx, "Big Road", bigMatrix, PADDING, offsetY, rows, cols, "🔴 Banker 🔵 Player", "solid", CELL);
    // Overlay tie marks as green ring with number
    if (Array.isArray(tieMarks)) {
        for (const m of tieMarks) {
            const viewStart = getViewStart(displayBigColumns.length, cols);
            const mm = remapTieForMixedCompression(m, bigRoadColumns, rows);
            const c = mm.col - viewStart;
            const r = mm.row;
            if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
            const gridX = PADDING;
            const gridY = offsetY + TITLE_H;
            const x = gridX + c * (CELL + GAP);
            const y = gridY + r * (CELL + GAP);
            const cx = x + CELL / 2;
            const cy = y + CELL / 2;
            // green ring
            ctx.beginPath();
            ctx.strokeStyle = '#2e7d32';
            ctx.lineWidth = 3;
            ctx.arc(cx, cy, Math.floor(CELL/2) - 3, 0, Math.PI*2);
            ctx.stroke();
            // number
            ctx.fillStyle = '#2e7d32';
            ctx.font = 'bold 12px sans-serif';
            const label = String(m.count || 1);
            const mW = ctx.measureText(label).width;
            ctx.fillText(label, cx - mW/2, cy + 4);
        }
    }
    offsetY += panelHeight;

    // Bottom: three derived panels in one row + Ask badges (optional)
    const derivedCols = Math.floor((smallWidth - PADDING) / (DERIVED_CELL + GAP));
    const derivedMatrixEye = toMatrixFromColumns(bigEyeColumns, rows, derivedCols, derivedColorMap);
    const derivedMatrixSmall = toMatrixFromColumns(smallColumns, rows, derivedCols, derivedColorMap);
    const derivedMatrixCock = toMatrixFromColumns(cockroachColumns, rows, derivedCols, derivedColorMap);

    let offsetX = PADDING;
    renderPanel(ctx, "Big Eye Boy", derivedMatrixEye, offsetX, offsetY, rows, derivedCols, "🔴 pattern 🔵 change", "hollow", DERIVED_CELL);
    offsetX += smallWidth;
    renderPanel(ctx, "Small Road", derivedMatrixSmall, offsetX, offsetY, rows, derivedCols, "🔴 pattern 🔵 change", "small", DERIVED_CELL);
    offsetX += smallWidth;
    renderPanel(ctx, "Cockroach", derivedMatrixCock, offsetX, offsetY, rows, derivedCols, "🔴 continue 🔵 change", "slash", DERIVED_CELL);

    // Bottom-right Ask overlay (single row B Ask / P Ask with all three indicators)
    if (askPredict?.bigEye || askPredict?.small || askPredict?.cockroach) {
        const overlayW = 200;
        const overlayH = 28;
        const ox = width - overlayW - PADDING;
        const oy = height - overlayH - PADDING;

        // shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        // rounded rect
        const r = 6;
        ctx.beginPath();
        ctx.moveTo(ox + r, oy);
        ctx.lineTo(ox + overlayW - r, oy);
        ctx.quadraticCurveTo(ox + overlayW, oy, ox + overlayW, oy + r);
        ctx.lineTo(ox + overlayW, oy + overlayH - r);
        ctx.quadraticCurveTo(ox + overlayW, oy + overlayH, ox + overlayW - r, oy + overlayH);
        ctx.lineTo(ox + r, oy + overlayH);
        ctx.quadraticCurveTo(ox, oy + overlayH, ox, oy + overlayH - r);
        ctx.lineTo(ox, oy + r);
        ctx.quadraticCurveTo(ox, oy, ox + r, oy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // segments single row
        const segH = overlayH - 8;
        const segY = oy + 4;
        const gap = 10;
        // B Ask (red segment)
        ctx.fillStyle = '#d32d2d';
        const bW = 90;
        const bX = ox + 6;
        ctx.fillRect(bX, segY, bW, segH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('B Ask', bX + 6, segY + segH - 4);
        // icon capsule with three indicators (hollow, small solid, slash)
        ctx.fillStyle = '#ffffff';
        const capBX = bX + bW - 44;
        const capBY = segY + 3;
        ctx.fillRect(capBX, capBY, 38, segH - 6);
        const colBE = askPredict?.bigEye?.B === 'R' ? '#d32d2d' : '#1976d2';
        const colSM = askPredict?.small?.B === 'R' ? '#d32d2d' : '#1976d2';
        const colCK = askPredict?.cockroach?.B === 'R' ? '#d32d2d' : '#1976d2';
        drawCircleCell(ctx, capBX + 8, capBY, colBE, { strokeOnly: true, cellSize: 12 });
        drawCircleCell(ctx, capBX + 20, capBY, colSM, { strokeOnly: false, scale: 0.8, cellSize: 12 });
        drawSlashCell(ctx, capBX + 30, capBY, colCK, 12);

        // P Ask (blue segment)
        ctx.fillStyle = '#1976d2';
        const pW = 90;
        const pX = bX + bW + gap;
        ctx.fillRect(pX, segY, pW, segH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('P Ask', pX + 6, segY + segH - 4);
        ctx.fillStyle = '#ffffff';
        const capPX = pX + pW - 44;
        const capPY = segY + 3;
        ctx.fillRect(capPX, capPY, 38, segH - 6);
        const colBEp = askPredict?.bigEye?.P === 'R' ? '#d32d2d' : '#1976d2';
        const colSMp = askPredict?.small?.P === 'R' ? '#d32d2d' : '#1976d2';
        const colCKp = askPredict?.cockroach?.P === 'R' ? '#d32d2d' : '#1976d2';
        drawCircleCell(ctx, capPX + 8, capPY, colBEp, { strokeOnly: true, cellSize: 12 });
        drawCircleCell(ctx, capPX + 20, capPY, colSMp, { strokeOnly: false, scale: 0.8, cellSize: 12 });
        drawSlashCell(ctx, capPX + 30, capPY, colCKp, 12);
    }

    return await canvas.encode("png");
}

module.exports = {
    renderRoadsComposite,
};


