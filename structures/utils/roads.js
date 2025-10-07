// Utilities for Baccarat roads (Big Road and derived roads)

const MAX_ROWS = 6;
const MAX_COLS = 12;

function buildBigRoadColumns(outcomes, maxRows = MAX_ROWS) {
    const columns = [];
    const getLastSymbol = (col) => {
        for (let i = col.length - 1; i >= 0; i--) {
            if (col[i]) return col[i];
        }
        return undefined;
    };
    for (const outcome of outcomes) {
        if (columns.length === 0) {
            columns.push([outcome]);
            continue;
        }
        const currentCol = columns[columns.length - 1];
        const lastInCol = getLastSymbol(currentCol);
        if (lastInCol === outcome) {
            const filled = currentCol.filter(Boolean).length;
            const hasEmpties = currentCol.some((v) => v === null);
            if (hasEmpties) {
                // Already overflowed: continue to the right on bottom row
                const newCol = new Array(maxRows - 1).fill(null);
                newCol[maxRows - 1] = outcome;
                columns.push(newCol);
            } else if (filled < maxRows) {
                // Normal downward streak within the column
                currentCol.push(outcome);
            } else {
                // First overflow: move right and keep bottom row
                const newCol = new Array(maxRows - 1).fill(null);
                newCol[maxRows - 1] = outcome;
                columns.push(newCol);
            }
            continue;
        }
        // color cut: start new column at the first empty row from top if previous created empties
        columns.push([outcome]);
    }
    return columns;
}

// Derived roads (Big Eye Boy / Small / Cockroach) based on column-pattern comparison.
// skipBack: 1 (Big Eye), 2 (Small), 3 (Cockroach)
// Build derived roads using per-move simulation to reduce duplicates/misalignment
function buildDerivedRoadColumns(bigRoadColumns, skipBack, maxRows = MAX_ROWS) {
    // Reconstruct a flat outcome sequence from big road columns
    const outcomes = [];
    for (const col of bigRoadColumns) {
        for (const sym of col) { if (sym) outcomes.push(sym); }
    }
    // Helper to place a symbol into big road columns
    function placeBig(cols, sym) {
        if (cols.length === 0) { cols.push([sym]); return; }
        const cur = cols[cols.length - 1];
        // get last non-null in current column
        let last = undefined;
        for (let i = cur.length - 1; i >= 0; i--) { if (cur[i]) { last = cur[i]; break; } }
        const filled = cur.filter(Boolean).length;
        const hasEmpties = cur.some((v) => v === null);
        if (last === sym) {
            if (hasEmpties) {
                const newCol = new Array(maxRows - 1).fill(null);
                newCol[maxRows - 1] = sym;
                cols.push(newCol);
            } else if (filled < maxRows) {
                cur.push(sym);
            } else {
                const newCol = new Array(maxRows - 1).fill(null);
                newCol[maxRows - 1] = sym;
                cols.push(newCol);
            }
        } else {
            cols.push([sym]);
        }
    }
    // Helper to place a symbol into derived columns (R/B)
    function placeDer(cols, color) {
        if (color == null) return;
        if (cols.length === 0) { cols.push([color]); return; }
        const cur = cols[cols.length - 1];
        const last = cur[cur.length - 1];
        const filled = cur.filter(Boolean).length;
        if (last === color) {
            if (filled < maxRows) {
                cur.push(color);
            } else {
                const newCol = new Array(maxRows - 1).fill(null);
                newCol[maxRows - 1] = color;
                cols.push(newCol);
            }
        } else {
            cols.push([color]);
        }
    }
    const simBig = [];
    const simDer = [];
    function filledCount(col) { return Array.isArray(col) ? col.filter(Boolean).length : 0; }
    for (const sym of outcomes) {
        placeBig(simBig, sym);
        // Only derive after we have enough columns built
        if (simBig.length > skipBack) {
            const curLen = filledCount(simBig[simBig.length - 1]);
            const refLen = filledCount(simBig[simBig.length - 1 - skipBack]);
            const color = curLen === refLen ? "R" : "B";
            placeDer(simDer, color);
        }
    }
    return simDer;
}

function renderBigRoadGrid(outcomes, maxRows = MAX_ROWS, maxCols = MAX_COLS) {
    const cols = buildBigRoadColumns(outcomes, maxRows);
    const view = cols.slice(Math.max(0, cols.length - maxCols));
    const toEmoji = (s) => (s === "B" ? "🔴" : s === "P" ? "🔵" : "");
    const empty = "▫️";
    const rows = [];
    for (let r = 0; r < maxRows; r++) {
        const parts = [];
        for (let c = 0; c < view.length; c++) {
            const sym = view[c][r];
            parts.push(sym ? toEmoji(sym) : empty);
        }
        rows.push(parts.join(" "));
    }
    return rows.join("\n");
}

function renderDerivedGrid(bigRoadColumns, skipBack, maxRows = MAX_ROWS, maxCols = MAX_COLS) {
    const cols = buildDerivedRoadColumns(bigRoadColumns, skipBack, maxRows);
    const view = cols.slice(Math.max(0, cols.length - maxCols));
    const toEmoji = (s) => (s === "R" ? "🔴" : s === "B" ? "🔵" : "");
    const empty = "▫️";
    const rows = [];
    for (let r = 0; r < maxRows; r++) {
        const parts = [];
        for (let c = 0; c < view.length; c++) {
            const sym = view[c][r];
            parts.push(sym ? toEmoji(sym) : empty);
        }
        rows.push(parts.join(" "));
    }
    return rows.join("\n");
}

module.exports = {
    buildBigRoadColumns,
    buildDerivedRoadColumns,
    renderBigRoadGrid,
    renderDerivedGrid,
};

// Predict next derived color if next outcome is appended to Big Road
// roads.js — แทนที่ predictDerivedColor เดิม
function predictDerivedColor(bigCols, nextSymbol, skipBack, maxRows = MAX_ROWS) {
    // 1) ดึงลำดับผลลัพธ์ตามเวลา: ซ้าย→ขวา และบน→ล่าง ของแต่ละคอลัมน์
    const outcomes = [];
    for (const col of bigCols) {
        for (const sym of col) {
            if (sym) outcomes.push(sym);
        }
    }
    // 2) ต่อผลลัพธ์ใหม่ (B หรือ P) ที่ต้องการลอง
    outcomes.push(nextSymbol);

    // 3) สร้าง Big Road ใหม่ทั้งกระดานด้วยกติกาเดียวกับของจริง
    const rebuiltBig = buildBigRoadColumns(outcomes, maxRows);

    // 4) สร้างถนน Derived ตาม skipBack ที่ระบุ แล้วอ่านสีสุดท้าย
    const derived = buildDerivedRoadColumns(rebuiltBig, skipBack, maxRows);
    const lastCol = derived[derived.length - 1] || [];
    return lastCol[lastCol.length - 1] || null; // 'R' | 'B' | null
}


module.exports.predictDerivedColor = predictDerivedColor;

// =============================
// Pattern detection utilities
// =============================

function getCleanOutcomes(outcomes) {
    const arr = [];
    for (const s of outcomes || []) {
        if (s === 'B' || s === 'P') arr.push(s);
    }
    return arr;
}

function detectPingPong(outcomes, minLength = 4) {
    const seq = getCleanOutcomes(outcomes);
    if (seq.length < minLength) return false;
    let count = 1;
    for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] !== seq[i + 1]) count++; else break;
        if (count >= minLength) return true;
    }
    return false;
}

function detectDragon(outcomes, minStreak = 4) {
    const seq = getCleanOutcomes(outcomes);
    if (seq.length < minStreak) return false;
    const last = seq[seq.length - 1];
    let count = 1;
    for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] === last) count++; else break;
        if (count >= minStreak) return true;
    }
    return false;
}

function lastColumnHeights(outcomes, take = 3, maxRows = MAX_ROWS) {
    const cols = buildBigRoadColumns(getCleanOutcomes(outcomes), maxRows);
    const heights = cols.map(c => (Array.isArray(c) ? c.filter(Boolean).length : 0));
    return heights.slice(Math.max(0, heights.length - take));
}

function detectSequence123(outcomes) {
    const h = lastColumnHeights(outcomes, 3);
    if (h.length < 3) return false;
    return h[0] === 1 && h[1] === 2 && h[2] === 3;
}

function detectSequence321(outcomes) {
    const h = lastColumnHeights(outcomes, 3);
    if (h.length < 3) return false;
    return h[0] === 3 && h[1] === 2 && h[2] === 1;
}

function analyzePatterns(outcomes) {
    return {
        pingPong: detectPingPong(outcomes, 4),
        dragon: detectDragon(outcomes, 4),
        seq123: detectSequence123(outcomes),
        seq321: detectSequence321(outcomes),
    };
}

module.exports.detectPingPong = detectPingPong;
module.exports.detectDragon = detectDragon;
module.exports.detectSequence123 = detectSequence123;
module.exports.detectSequence321 = detectSequence321;
module.exports.analyzePatterns = analyzePatterns;

// ---------------------------------
// Additional pattern detections
// ---------------------------------

function runsFromOutcomes(outcomes) {
    const seq = getCleanOutcomes(outcomes);
    const runs = [];
    for (const s of seq) {
        const last = runs[runs.length - 1];
        if (!last || last.color !== s) runs.push({ color: s, len: 1 });
        else last.len++;
    }
    return runs;
}

function detectDoubleRoad(outcomes, minBlocks = 3) {
    // Expect repeating blocks of exactly length 2 alternating colors, e.g., PP BB PP BB ...
    const runs = runsFromOutcomes(outcomes);
    const last = runs.slice(-minBlocks * 2); // e.g., need at least PP BB PP
    if (last.length < minBlocks * 2) return false;
    for (let i = 0; i < last.length; i++) {
        if (last[i].len !== 2) return false;
        if (i > 0 && last[i].color === last[i - 1].color) return false;
    }
    return true;
}

function detectMirror(outcomes, blockSize = 2, minPairs = 2) {
    // Mirror-like: [AA][BB][BB][AA] or repeating two-by-two alternation
    const seq = getCleanOutcomes(outcomes);
    const need = blockSize * minPairs * 2;
    if (seq.length < need) return false;
    const tail = seq.slice(-need);
    // Check pairs: A,A,B,B,B,B,A,A (mirror around center)
    const A = tail.slice(0, blockSize).every(c => c === tail[0]);
    const B = tail.slice(blockSize, blockSize * 2).every(c => c !== tail[0]);
    const C = tail.slice(blockSize * 2, blockSize * 3).every(c => c !== tail[0]);
    const D = tail.slice(blockSize * 3).every(c => c === tail[0]);
    return A && B && C && D;
}

function detectFakeDragon(outcomes) {
    // Recent run of 4-5 then a cut and again 4-5 of the new color within last ~10
    const runs = runsFromOutcomes(outcomes);
    const last = runs.slice(-3); // X (4-5), Y (1), Z (>=4) typical
    if (last.length < 3) return false;
    const [a, b, c] = last;
    if (a.len >= 4 && a.len <= 5 && b.color !== a.color && c.color === a.color && c.len >= 4) return true;
    if (a.len >= 4 && a.len <= 5 && b.color !== a.color && c.color !== a.color && c.len >= 4) return true;
    return false;
}

function detectEcho(outcomes, window = 6) {
    const seq = getCleanOutcomes(outcomes);
    if (seq.length < window * 2) return false;
    const a = seq.slice(-window * 2, -window);
    const b = seq.slice(-window);
    for (let i = 0; i < window; i++) if (a[i] !== b[i]) return false;
    return true;
}

function detectStepLadder(outcomes) {
    const h = lastColumnHeights(outcomes, 6);
    if (h.length < 5) return false;
    // Look for strictly increasing then strictly decreasing around a peak
    let peak = -1;
    for (let i = 1; i < h.length - 1; i++) {
        const leftInc = h[0] < h[1] && (i < 2 || h[1] < h[2] || true);
        if (leftInc && h[i - 1] < h[i] && h[i] > h[i + 1]) { peak = i; break; }
    }
    if (peak === -1) return false;
    for (let i = 1; i <= peak; i++) if (!(h[i - 1] < h[i])) return false;
    for (let i = peak + 1; i < h.length; i++) if (!(h[i - 1] > h[i])) return false;
    return true;
}

function detectFalseStability(outcomes) {
    // Looks like repeating triplet (A,A,B) with small noise
    const seq = getCleanOutcomes(outcomes);
    if (seq.length < 9) return false;
    const tail = seq.slice(-9);
    const patterns = [ ['P','P','B'], ['B','B','P'] ];
    let mismatches = 0;
    for (let i = 0; i < 9; i++) {
        const pat = patterns[0];
        const expect = pat[i % 3];
        if (tail[i] !== expect) mismatches++;
    }
    if (mismatches <= 2) return true;
    mismatches = 0;
    for (let i = 0; i < 9; i++) {
        const pat = patterns[1];
        const expect = pat[i % 3];
        if (tail[i] !== expect) mismatches++;
    }
    return mismatches <= 2;
}

function detectBurstBreak(outcomes) {
    const runs = runsFromOutcomes(outcomes);
    const last = runs.slice(-2);
    if (last.length < 2) return false;
    const prev = runs[runs.length - 2];
    const cur = runs[runs.length - 1];
    return prev && cur && prev.color !== cur.color && prev.len >= 7 && cur.len >= 3;
}

function detectClusterChaos(outcomes, windowRuns = 6) {
    const runs = runsFromOutcomes(outcomes).slice(-windowRuns);
    if (runs.length < 4) return false;
    // At least three runs in {2,3} and colors not strictly alternating
    const small = runs.filter(r => r.len === 2 || r.len === 3).length;
    let strictlyAlt = true;
    for (let i = 1; i < runs.length; i++) if (runs[i].color === runs[i - 1].color) { strictlyAlt = false; break; }
    return small >= 3 && !strictlyAlt;
}

module.exports.detectDoubleRoad = detectDoubleRoad;
module.exports.detectMirror = detectMirror;
module.exports.detectFakeDragon = detectFakeDragon;
module.exports.detectEcho = detectEcho;
module.exports.detectStepLadder = detectStepLadder;
module.exports.detectFalseStability = detectFalseStability;
module.exports.detectBurstBreak = detectBurstBreak;
module.exports.detectClusterChaos = detectClusterChaos;

// ======================================
// Derived roads (R/B) pattern detection
// ======================================

function getCleanOutcomesRB(outcomesRB) {
    const arr = [];
    for (const s of outcomesRB || []) {
        if (s === 'R' || s === 'B') arr.push(s);
    }
    return arr;
}

function runsFromOutcomesRB(outcomesRB) {
    const seq = getCleanOutcomesRB(outcomesRB);
    const runs = [];
    for (const s of seq) {
        const last = runs[runs.length - 1];
        if (!last || last.color !== s) runs.push({ color: s, len: 1 });
        else last.len++;
    }
    return runs;
}

function detectPingPongRB(outcomesRB, minLength = 4) {
    const seq = getCleanOutcomesRB(outcomesRB);
    if (seq.length < minLength) return false;
    let count = 1;
    for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] !== seq[i + 1]) count++; else break;
        if (count >= minLength) return true;
    }
    return false;
}

function detectDragonRB(outcomesRB, minStreak = 4) {
    const seq = getCleanOutcomesRB(outcomesRB);
    if (seq.length < minStreak) return false;
    const last = seq[seq.length - 1];
    let count = 1;
    for (let i = seq.length - 2; i >= 0; i--) {
        if (seq[i] === last) count++; else break;
        if (count >= minStreak) return true;
    }
    return false;
}

function detectDoubleRoadRB(outcomesRB, minBlocks = 3) {
    const runs = runsFromOutcomesRB(outcomesRB);
    const last = runs.slice(-minBlocks * 2);
    if (last.length < minBlocks * 2) return false;
    for (let i = 0; i < last.length; i++) {
        if (last[i].len !== 2) return false;
        if (i > 0 && last[i].color === last[i - 1].color) return false;
    }
    return true;
}

function detectEchoRB(outcomesRB, window = 6) {
    const seq = getCleanOutcomesRB(outcomesRB);
    if (seq.length < window * 2) return false;
    const a = seq.slice(-window * 2, -window);
    const b = seq.slice(-window);
    for (let i = 0; i < window; i++) if (a[i] !== b[i]) return false;
    return true;
}

function detectClusterChaosRB(outcomesRB, windowRuns = 6) {
    const runs = runsFromOutcomesRB(outcomesRB).slice(-windowRuns);
    if (runs.length < 4) return false;
    const small = runs.filter(r => r.len === 2 || r.len === 3).length;
    let strictlyAlt = true;
    for (let i = 1; i < runs.length; i++) if (runs[i].color === runs[i - 1].color) { strictlyAlt = false; break; }
    return small >= 3 && !strictlyAlt;
}

function lastColumnHeightsFromColumns(columns, take = 3) {
    const heights = columns.map(c => (Array.isArray(c) ? c.filter(Boolean).length : 0));
    return heights.slice(Math.max(0, heights.length - take));
}

function analyzePatternsDerivedFromColumns(columns) {
    const outcomesRB = [];
    for (const col of columns) for (const s of col) if (s) outcomesRB.push(s);
    return {
        pingPong: detectPingPongRB(outcomesRB, 4),
        dragon: detectDragonRB(outcomesRB, 4),
        doubleRoad: detectDoubleRoadRB(outcomesRB, 3),
        echo: detectEchoRB(outcomesRB, 6),
        cluster: detectClusterChaosRB(outcomesRB, 6),
        seq123: (() => { const h = lastColumnHeightsFromColumns(columns, 3); return h.length === 3 && h[0] === 1 && h[1] === 2 && h[2] === 3; })(),
        seq321: (() => { const h = lastColumnHeightsFromColumns(columns, 3); return h.length === 3 && h[0] === 3 && h[1] === 2 && h[2] === 1; })(),
    };
}

function buildAllRoadColumnsFromBigOutcomes(outcomes, maxRows = MAX_ROWS) {
    const bigCols = buildBigRoadColumns(outcomes, maxRows);
    const bigEye = buildDerivedRoadColumns(bigCols, 1, maxRows);
    const small = buildDerivedRoadColumns(bigCols, 2, maxRows);
    const cock = buildDerivedRoadColumns(bigCols, 3, maxRows);
    return { bigCols, bigEye, small, cock };
}

function analyzeRandomRoad(outcomes, maxRows = MAX_ROWS) {
    const roads = buildAllRoadColumnsFromBigOutcomes(outcomes, maxRows);
    const keys = ['big', 'bigEye', 'small', 'cockroach'];
    const pick = keys[Math.floor(Math.random() * keys.length)];
    if (pick === 'big') {
        return { road: 'big', patterns: analyzePatterns(outcomes) };
    } else if (pick === 'bigEye') {
        return { road: 'bigEye', patterns: analyzePatternsDerivedFromColumns(roads.bigEye) };
    } else if (pick === 'small') {
        return { road: 'small', patterns: analyzePatternsDerivedFromColumns(roads.small) };
    }
    return { road: 'cockroach', patterns: analyzePatternsDerivedFromColumns(roads.cock) };
}

module.exports.getCleanOutcomesRB = getCleanOutcomesRB;
module.exports.detectPingPongRB = detectPingPongRB;
module.exports.detectDragonRB = detectDragonRB;
module.exports.detectDoubleRoadRB = detectDoubleRoadRB;
module.exports.detectEchoRB = detectEchoRB;
module.exports.detectClusterChaosRB = detectClusterChaosRB;
module.exports.analyzePatternsDerivedFromColumns = analyzePatternsDerivedFromColumns;
module.exports.buildAllRoadColumnsFromBigOutcomes = buildAllRoadColumnsFromBigOutcomes;
module.exports.analyzeRandomRoad = analyzeRandomRoad;


