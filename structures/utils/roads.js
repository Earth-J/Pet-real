// Utilities for Baccarat roads (Big Road and derived roads)

const MAX_ROWS = 6;
const MAX_COLS = 12;

function buildBigRoadColumns(outcomes, maxRows = MAX_ROWS) {
    const columns = [];
    for (const outcome of outcomes) {
        if (columns.length === 0) {
            columns.push([outcome]);
            continue;
        }
        const currentCol = columns[columns.length - 1];
        const lastInCol = currentCol[currentCol.length - 1];
        if (lastInCol === outcome && currentCol.length < maxRows) {
            currentCol.push(outcome);
            continue;
        }
        columns.push([outcome]);
    }
    return columns;
}

// Derived roads (Big Eye Boy / Small / Cockroach) based on column-pattern comparison.
// skipBack: 1 (Big Eye), 2 (Small), 3 (Cockroach)
function buildDerivedRoadColumns(bigRoadColumns, skipBack, maxRows = MAX_ROWS) {
    const derivedSequence = [];
    for (let i = skipBack; i < bigRoadColumns.length; i++) {
        const cur = bigRoadColumns[i];
        const ref = bigRoadColumns[i - skipBack];
        const isPattern = (cur?.length || 0) === (ref?.length || 0);
        derivedSequence.push(isPattern ? "R" : "B");
    }
    // Now place into columns similar to Big Road stacking rule
    const columns = [];
    for (const color of derivedSequence) {
        if (columns.length === 0) {
            columns.push([color]);
            continue;
        }
        const currentCol = columns[columns.length - 1];
        const lastInCol = currentCol[currentCol.length - 1];
        if (lastInCol === color && currentCol.length < maxRows) {
            currentCol.push(color);
            continue;
        }
        columns.push([color]);
    }
    return columns;
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
function predictDerivedColor(bigCols, nextSymbol, skipBack, maxRows = MAX_ROWS) {
    const cols = bigCols.map(c => c.slice());
    // Place nextSymbol to columns per Big Road stacking rule
    if (cols.length === 0) cols.push([nextSymbol]);
    else {
        const lastCol = cols[cols.length - 1];
        const last = lastCol[lastCol.length - 1];
        if (last === nextSymbol && lastCol.length < maxRows) lastCol.push(nextSymbol);
        else cols.push([nextSymbol]);
    }
    const derived = buildDerivedRoadColumns(cols, skipBack, maxRows);
    const lastColumn = derived[derived.length - 1] || [];
    return lastColumn[lastColumn.length - 1] || null; // 'R' or 'B' or null
}

module.exports.predictDerivedColor = predictDerivedColor;


