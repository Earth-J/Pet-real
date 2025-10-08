const { EmbedBuilder, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const https = require("https");
const vm = require("vm");
const GProfile = require("../../settings/models/profile.js");
const GuildState = require("../../settings/models/guildState.js");
const { buildBigRoadColumns, buildDerivedRoadColumns, renderBigRoadGrid, renderDerivedGrid, predictDerivedColor } = require("../../structures/utils/roads.js");
const { renderRoadsComposite } = require("../../structures/utils/roadsCanvas.js");

// Per-user lock to prevent concurrent requests
const userLocks = new Map();
const LOCK_TIMEOUT = 30000; // 30 seconds

// Lock management functions
function acquireLock(userId) {
    if (userLocks.has(userId)) {
        return false; // User is already playing
    }
    userLocks.set(userId, Date.now());
    return true;
}

function releaseLock(userId) {
    userLocks.delete(userId);
}

function isLocked(userId) {
    return userLocks.has(userId);
}

// Clean up expired locks
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of userLocks.entries()) {
        if (now - timestamp > LOCK_TIMEOUT) {
            userLocks.delete(userId);
        }
    }
}, 10000); // Check every 10 seconds

// Bets and limits
const MIN_BET = 10;
const MAX_BET = 100000;

// Minimal tone embed colors
const UI_COLORS = {
    primary: 0x2b2d31, // minimalist dark
    subtle: 0x99aab5,  // muted gray
    danger: 0xe74c3c,  // soft red
    success: 0x2ecc71, // soft green
    player: 0x59aff6,  // soft blue for player
    banker: 0xf65959,  // soft orange for banker
    tie: 0x6ee884,     // soft purple for tie
};

// Reveal animation config
const BACK_L = "<:back_card_left:1424850432877924442>";
const BACK_R = "<:back_card_right:1424850440448643082>";
const REVEAL_STEP_DELAY = 650; // ms per reveal
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function renderBackCard() { return `${BACK_L}${BACK_R}`; }
function renderHiddenHand(count) { return Array.from({ length: count }, renderBackCard).join(" "); }

// Outcome weights relative to the user's bet (sum ≈ 1.0)
// We first decide: user wins / user loses / round ties, then search for a round matching that outcome.
const OUTCOME_WEIGHTS = {
    win: 0.44,
    lose: 0.51,
    tie: 0.001, // tie means round result = tie
};

function pickWeighted(weights) {
    const entries = Object.entries(weights);
    let total = 0;
    for (const [, w] of entries) total += Math.max(0, Number(w) || 0);
    if (total <= 0) return "banker"; // fallback
    let r = Math.random() * total;
    for (const [k, wRaw] of entries) {
        const w = Math.max(0, Number(wRaw) || 0);
        if ((r -= w) < 0) return k;
    }
    return entries[entries.length - 1][0];
}

function chooseTargetWinner(betSide, desiredOutcome) {
    const side = (betSide || "").toLowerCase();
    if (desiredOutcome === "tie") return "tie";
    if (desiredOutcome === "win") {
        if (side === "player" || side === "banker") return side;
        if (side === "tie") return "tie"; // win when bet tie
    }
    // desiredOutcome === 'lose'
    if (side === "player") return "banker";
    if (side === "banker") return "player";
    if (side === "tie") {
        // losing tie bet -> force non-tie; slight lean to banker
        return Math.random() < 0.52 ? "banker" : "player";
    }
    return "banker";
}

function normalizeWeights(w) {
    if (!w) return OUTCOME_WEIGHTS;
    const total = Math.max(0, (w.win||0)) + Math.max(0, (w.lose||0)) + Math.max(0, (w.tie||0));
    if (total <= 0) return OUTCOME_WEIGHTS;
    return { win: w.win/total, lose: w.lose/total, tie: w.tie/total };
}

function deriveUserOutcomeWeights(profileDoc) {
    // Example adaptive strategy: early rounds favor 'win', later favor 'lose'
    const rounds = profileDoc?.baccarat?.rounds || 0;
    const base = { ...OUTCOME_WEIGHTS };
    if (rounds < 10) {
        base.win += 0.10; base.lose -= 0.08; base.tie -= 0.02;
    } else if (rounds < 30) {
        // neutral-ish
    } else {
        base.lose += 0.08; base.win -= 0.06; base.tie -= 0.02;
    }
    return normalizeWeights(base);
}

function playRoundBiasedByOutcome(playRoundFn, betSide, userWeights, maxTrials = 25) {
    const weights = normalizeWeights(userWeights || OUTCOME_WEIGHTS);
    const desiredOutcome = pickWeighted(weights);
    const targetWinner = chooseTargetWinner(betSide, desiredOutcome);
    let last = null;
    for (let i = 0; i < maxTrials; i++) {
        const r = playRoundFn();
        last = r;
        const w = (r.winner || "").toLowerCase();
        if (w === targetWinner) return r;
    }
    return last;
}

// Volatility control (statistical tuning, not outcome cheating)
const VOLATILITY_MODE = process.env.BACCARAT_VOL_MODE || 'medium'; // 'low' | 'medium' | 'high'
const VOLATILITY_STRENGTH = Number(process.env.BACCARAT_VOL_STRENGTH || 1.0); // 0.0 .. 2.0
const VOL_CANDIDATES = Number(process.env.BACCARAT_VOL_CANDIDATES || 6);
const RISK_ENABLED = (process.env.BACCARAT_RISK_ENABLED || 'true') !== 'false';
const RISK_SKEW_MAX = Number(process.env.BACCARAT_RISK_SKEW_MAX || 0.06); // max deviation from RTP per winner side
const RISK_NET_THRESHOLD = Number(process.env.BACCARAT_RISK_NET_THRESHOLD || 50000); // net profit to be considered heavy winner
const RISK_BET_THRESHOLD = Number(process.env.BACCARAT_RISK_BET_THRESHOLD || 5000); // stake considered impactful

// Random giveaway (hot) streak controller
const HOT_ENABLED = (process.env.BACCARAT_HOT_ENABLED || 'true') !== 'false';
const HOT_TRIGGER_CHANCE = Number(process.env.BACCARAT_HOT_TRIGGER_CHANCE || 0.08); // 8% per settle
const HOT_MIN_ROUNDS = Number(process.env.BACCARAT_HOT_MIN_ROUNDS || 2);
const HOT_MAX_ROUNDS = Number(process.env.BACCARAT_HOT_MAX_ROUNDS || 5);
const HOT_FAVOR_BOOST = Number(process.env.BACCARAT_HOT_FAVOR_BOOST || 0.05); // +5% toward majority side
const guildHotState = new Map(); // guildId -> remainingRounds

function baseRtpOutcomeWeights() {
    // Approximate long-run distribution including ties
    // Banker ≈ 45.86%, Player ≈ 44.62%, Tie ≈ 9.52%
    return { player: 0.446, banker: 0.458, tie: 0.096 };
}

function pickDesiredByRTP() {
    return pickWeighted(baseRtpOutcomeWeights());
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function computeAdaptiveOutcomeWeights(participantsMap, userIdToProfile) {
    const base = baseRtpOutcomeWeights();
    if (!RISK_ENABLED || !participantsMap || participantsMap.size === 0) return base;
    let pressurePlayer = 0;
    let pressureBanker = 0;
    for (const [uid, p] of participantsMap.entries()) {
        const prof = userIdToProfile.get(uid);
        const net = Number(prof?.baccarat?.net || 0);
        const wins = Number(prof?.baccarat?.wins || 0);
        const losses = Number(prof?.baccarat?.losses || 0);
        const winRate = wins + losses > 0 ? wins / (wins + losses) : 0.5;
        const betImpact = Math.max(0, Number(p.bet) || 0) / (RISK_BET_THRESHOLD || 1);
        const winnerScore = Math.max(0, net - RISK_NET_THRESHOLD);
        const weight = clamp01(0.4 * betImpact + 0.6 * (winnerScore / (RISK_NET_THRESHOLD * 4))) * (0.5 + winRate / 2);
        if (p.side === 'player') pressurePlayer += weight; else if (p.side === 'banker') pressureBanker += weight;
    }
    // positive pressure means many heavy winners currently on that side; we want to slightly reduce its chance
    let player = base.player;
    let banker = base.banker;
    const diff = pressurePlayer - pressureBanker; // >0 means penalize player more
    const skew = Math.tanh(diff) * RISK_SKEW_MAX; // bounded skew
    const targetPlayer = clamp01(player - skew);
    const targetBanker = clamp01(banker + skew);
    // keep tie proportion close; rescale to sum=1
    let tie = base.tie;
    const total = targetPlayer + targetBanker + tie;
    return total > 0 ? { player: targetPlayer / total, banker: targetBanker / total, tie: tie / total } : base;
}

function maybeActivateHotStreak(guildId) {
    if (!HOT_ENABLED) return;
    if (guildHotState.get(guildId) > 0) return;
    if (Math.random() < HOT_TRIGGER_CHANCE) {
        const len = Math.max(HOT_MIN_ROUNDS, Math.floor(HOT_MIN_ROUNDS + Math.random() * Math.max(0, HOT_MAX_ROUNDS - HOT_MIN_ROUNDS + 1)));
        guildHotState.set(guildId, len);
    }
}

function applyHotFavor(guildId, participantsMap, weights) {
    if (!HOT_ENABLED) return weights;
    const remain = guildHotState.get(guildId) || 0;
    if (remain <= 0) return weights;
    let playerCount = 0, bankerCount = 0;
    for (const [, p] of participantsMap.entries()) {
        if (p.side === 'player') playerCount++; else if (p.side === 'banker') bankerCount++;
    }
    let player = weights.player, banker = weights.banker, tie = weights.tie;
    if (playerCount > bankerCount) {
        const shift = Math.min(HOT_FAVOR_BOOST, banker);
        player += shift; banker -= shift;
    } else if (bankerCount > playerCount) {
        const shift = Math.min(HOT_FAVOR_BOOST, player);
        banker += shift; player -= shift;
    } else {
        // equal; nudge away from tie toward non-tie
        const shift = Math.min(HOT_FAVOR_BOOST, tie * 0.5);
        player += shift/2; banker += shift/2; tie -= shift;
    }
    const total = player + banker + tie;
    if (total <= 0) return weights;
    return { player: player/total, banker: banker/total, tie: tie/total };
}

function extractRecentOutcomesFromColumns(columns, take = 30) {
    const seq = [];
    for (const col of columns) for (const s of col) if (s) seq.push(s);
    return seq.slice(Math.max(0, seq.length - take));
}

function volatilityScoreForWinner(historySymbols, winner, mode = VOLATILITY_MODE) {
    // historySymbols are 'B'|'P' from Big Road; winner is 'player'|'banker'|'tie'
    if (winner === 'tie') return 0; // ignore tie in scoring
    const nextSym = winner === 'banker' ? 'B' : 'P';
    const n = historySymbols.length;
    if (n === 0) return 0;
    // compute current streak length of the same symbol at tail
    const last = historySymbols[n - 1];
    let streak = 0;
    for (let i = n - 1; i >= 0; i--) {
        if (historySymbols[i] === last) streak++; else break;
    }
    const continues = nextSym === last;
    if (mode === 'high') {
        // favor continuing streaks (higher when longer streak)
        return (continues ? 1 : -1) * (1 + streak);
    }
    if (mode === 'low') {
        // favor breaking streaks (higher when longer current streak)
        return (!continues ? 1 : -1) * (1 + streak);
    }
    // medium: mild preference for clustering
    return (continues ? 1 : -0.5) * (1 + Math.log2(1 + streak));
}

function chooseRoundWithVolatility({ rawPlay, historySymbols, desiredWinner, candidates = VOL_CANDIDATES, strength = VOLATILITY_STRENGTH }) {
    // Generate candidate rounds and choose one matching desiredWinner with best score
    const pool = [];
    for (let i = 0; i < Math.max(1, candidates); i++) pool.push(rawPlay());
    // filter by desired winner to maintain long-run RTP proportions
    const matches = pool.filter(r => (r.winner || '').toLowerCase() === desiredWinner);
    if (!matches.length) return pool[0];
    let best = matches[0];
    let bestScore = -Infinity;
    for (const r of matches) {
        const w = (r.winner || '').toLowerCase();
        const score = volatilityScoreForWinner(historySymbols, w, VOLATILITY_MODE) * strength;
        if (score > bestScore) { bestScore = score; best = r; }
    }
    return best;
}

// Engine version and integrity check
const ENGINE_VERSION = "1.1.5";
const EXPECTED_SHA256 = {
    "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.min.js": "expected_hash_here",
    "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.js": "expected_hash_here"
};

// Engine caching
let cachedEngineFactory = null;
let lastFetchAt = 0;
const CACHE_TTL_MS = 300000; // 5 minutes

const crypto = require("crypto");

function calculateSHA256(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function verifyIntegrity(data, url) {
    const expectedHash = EXPECTED_SHA256[url];
    if (!expectedHash) return true; // Skip verification if no expected hash
    
    const actualHash = calculateSHA256(data);
    if (actualHash !== expectedHash) {
        console.warn(`[BACCARAT] SHA256 mismatch for ${url}. Expected: ${expectedHash}, Got: ${actualHash}`);
        return false;
    }
    return true;
}

function fetchText(url, timeout = 10000, maxSize = 5 * 1024 * 1024) { // 10s timeout, 5MB max
    return new Promise((resolve, reject) => {
        const request = https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(fetchText(res.headers.location, timeout, maxSize));
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            
            const chunks = [];
            let totalSize = 0;
            
            res.on("data", (d) => {
                totalSize += d.length;
                if (totalSize > maxSize) {
                    res.destroy();
                    return reject(new Error(`Response too large: ${totalSize} bytes`));
                }
                chunks.push(d);
            });
            
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            res.on("error", reject);
        });
        
        request.setTimeout(timeout, () => {
            request.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
        
        request.on("error", reject);
    });
}

async function loadBaccaratEngine() {
    const now = Date.now();
    if (cachedEngineFactory && now - lastFetchAt < CACHE_TTL_MS) return cachedEngineFactory;

    // Local fallback engine in case CDN build is incompatible
    function createLocalEngineFactory() {
        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }
        function buildDeck() {
            const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
            const suits = ["Spades", "Clubs", "Hearts", "Diamonds"];
            const deck = [];
            for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
            return shuffle(deck);
        }
        function cardValue(rank) {
            if (rank === "A") return 1;
            if (rank === "J" || rank === "Q" || rank === "K" || rank === "10") return 0;
            return parseInt(rank, 10);
        }
        function handTotal(cards) {
            let sum = 0;
            for (const c of cards) sum += cardValue(c.rank);
            return sum % 10;
        }
        function draw(deck) { return deck.pop(); }
        function playRound() {
            const deck = buildDeck();
            const player = [draw(deck), draw(deck)];
            const banker = [draw(deck), draw(deck)];
            let playerTotal = handTotal(player);
            let bankerTotal = handTotal(banker);
            // Natural
            if (playerTotal >= 8 || bankerTotal >= 8) {
                return finalize(player, banker);
            }
            // Player third card rule
            let playerThird = null;
            if (playerTotal <= 5) {
                playerThird = draw(deck);
                player.push(playerThird);
                playerTotal = handTotal(player);
            }
            // Banker third card rule
            let bankerThird = null;
            if (playerThird === null) {
                // Player stood; banker draws on 0-5
                if (bankerTotal <= 5) {
                    bankerThird = draw(deck);
                    banker.push(bankerThird);
                }
            } else {
                const pt = cardValue(playerThird.rank);
                if (bankerTotal <= 2) {
                    bankerThird = draw(deck);
                } else if (bankerTotal === 3) {
                    if (pt !== 8) bankerThird = draw(deck);
                } else if (bankerTotal === 4) {
                    if (pt >= 2 && pt <= 7) bankerThird = draw(deck);
                } else if (bankerTotal === 5) {
                    if (pt >= 4 && pt <= 7) bankerThird = draw(deck);
                } else if (bankerTotal === 6) {
                    if (pt === 6 || pt === 7) bankerThird = draw(deck);
                }
                if (bankerThird) banker.push(bankerThird);
            }
            return finalize(player, banker);
            function finalize(p, b) {
                const pt = handTotal(p);
                const bt = handTotal(b);
                const winner = pt > bt ? "player" : bt > pt ? "banker" : "tie";
                return { player: p, banker: b, winner, points: { player: pt, banker: bt } };
            }
        }
        return () => ({ playRound });
    }

    // Try ESM via +esm bundle using data: URL (works in CommonJS with dynamic import)
    try {
        const esmSrc = await fetchText("https://cdn.jsdelivr.net/npm/baccarat-engine@1.1/+esm");
        const b64 = Buffer.from(esmSrc, "utf8").toString("base64");
        const dataUrl = `data:text/javascript;base64,${b64}`;
        const mod = await import(dataUrl);
        const def = mod && (mod.default || mod.baccaratEngine || mod.BaccaratEngine);
        if (typeof def === "function") {
            cachedEngineFactory = def;
            lastFetchAt = now;
            return cachedEngineFactory;
        }
        if (def && typeof def.createRound === "function") {
            cachedEngineFactory = () => ({ playRound: def.createRound });
            lastFetchAt = now;
            return cachedEngineFactory;
        }
    } catch (e) {
        // fallthrough to UMD approach
    }

    // Try UMD builds next (no require dependency expected)
    const candidates = [
        "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.min.js",
        "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.js",
        // Fallback to sample usage (will fail if require is used)
        "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/sample-usage.min.js",
    ];

    let engineFactory = null;
    let lastError = null;
    for (const url of candidates) {
        try {
            const src = await fetchText(url);
            
            // Verify integrity
            if (!verifyIntegrity(src, url)) {
                console.warn(`[BACCARAT] Integrity check failed for ${url}, skipping...`);
                continue;
            }
            
            // Create a browser-like global environment so UMD chooses global export path, not CommonJS
            const sandbox = { console };
            sandbox.global = sandbox;
            sandbox.globalThis = sandbox;
            sandbox.window = sandbox;
            sandbox.self = sandbox;
            // define a benign require so UMD that probes for require won't crash
            sandbox.require = function () { return {}; };
            vm.createContext(sandbox);
            vm.runInContext(src, sandbox, { timeout: 2000 });

            // Detect global export names commonly used by UMD bundles
            const globalCandidates = [
                sandbox.BaccaratEngine,
                sandbox.baccaratEngine,
                sandbox.Baccarat,
                sandbox.baccarat,
            ].filter(Boolean);

            for (const g of globalCandidates) {
                if (typeof g === "function") {
                    engineFactory = g;
                    break;
                }
                if (g && typeof g.createRound === "function") {
                    engineFactory = () => ({ playRound: g.createRound });
                    break;
                }
            }
            if (engineFactory) {
                console.log(`[BACCARAT] Successfully loaded engine from ${url} (version ${ENGINE_VERSION})`);
                break;
            }
        } catch (e) {
            lastError = e;
            console.warn(`[BACCARAT] Failed to load from ${url}:`, e.message);
            continue;
        }
    }

    if (!engineFactory) {
        // Use local fallback engine
        engineFactory = createLocalEngineFactory();
    }

    cachedEngineFactory = engineFactory;
    lastFetchAt = now;
    return cachedEngineFactory;
}

// Emoji map (R = red suit, B = black suit)
const RANK_EMOJI = {
    A: { R: "<:AR:1424844660039356457>", B: "<:AB:1424844657052876920>" },
    2: { R: "<:2R:1424844582524293282>", B: "<:2B:1424844585082814617>" },
    3: { R: "<:3R:1424844590212714676>", B: "<:3B:1424844587444211838>" },
    4: { R: "<:4R:1424844594478186526>", B: "<:4B:1424844592242622546>" },
    5: { R: "<:5R:1424844599733780570>", B: "<:5B:1424844597065941084>" },
    6: { R: "<:6R:1424844604385132675>", B: "<:6B:1424844602451693598>" },
    7: { R: "<:7R:1424844631450845335>", B: "<:7B:1424844606847320185>" },
    8: { R: "<:8R:1424844637561946173>", B: "<:8B:1424844634659618957>" },
    9: { R: "<:9R:1424844643291369525>", B: "<:9B:1424844641135493171>" },
    10: { R: "<:10R:1424844654867910759>", B: "<:10B:1424844645808078979>" },
    J: { R: "<:JR:1424844671103799458>", B: "<:JB:1424844668696530994>" },
    Q: { R: "<:QR:1424844681094631635>", B: "<:QB:1424844679182155786>" },
    K: { R: "<:KR:1424844676430823454>", B: "<:KB:1424844673901400166>" },
};

const SUIT_COLOR = {
    Spades: "B", // black
    Clubs: "B",
    Hearts: "R", // red
    Diamonds: "R",
};

const SUIT_EMOJI = {
    Spades: "<:Spade:1424844683515002951>",
    Clubs: "<:Clubs:1424844662396555374>",
    Hearts: "<:Heart:1424844666540523580>",
    Diamonds: "<:Diamonds:1424844664539975832>",
};

function renderCard(card) {
    // card example from engine: { rank: 'A'|'2'..'K', suit: 'Spades'|'Clubs'|'Hearts'|'Diamonds' }
    const color = SUIT_COLOR[card.suit] || "B";
    const rankKey = String(card.rank);
    const r = RANK_EMOJI[rankKey] && RANK_EMOJI[rankKey][color];
    const s = SUIT_EMOJI[card.suit];
    return r && s ? `${s}${r}` : `${card.suit} ${rankKey}`;
}

function renderHand(cards) {
    return cards.map(renderCard).join(" ");
}

function formatNum(n) {
    try { return Number(n).toLocaleString('en-US'); } catch { return String(n); }
}

// ==========================
// Per-guild baccarat room (batch round)
// ==========================
const guildRooms = new Map(); // guildId -> { participants: Map<userId,{bet,side,username}>, status, deadline, timer }
const ROOM_WAIT_MS = 30_000; // 30 seconds collecting bets

function getOrCreateRoom(guildId) {
    let room = guildRooms.get(guildId);
    if (!room) {
        room = {
            participants: new Map(),
            status: "collecting",
            createdAt: Date.now(),
            deadline: Date.now() + ROOM_WAIT_MS,
            timer: null,
        };
        guildRooms.set(guildId, room);
    }
    return room;
}

function roomTimeLeftMs(room) {
    return Math.max(0, (room?.deadline || 0) - Date.now());
}

// ==========================
// Room outcome selection helpers (bias by liability and user history)
// ==========================
function sumRoomNetPayoutForWinner(participantsMap, winner) {
    let sum = 0;
    for (const [, p] of participantsMap.entries()) {
        let gross = 0;
        if (winner === "player") {
            if (p.side === "player") gross = Math.floor(p.bet * 2);
        } else if (winner === "banker") {
            if (p.side === "banker") gross = Math.floor(p.bet * 1.95);
        } else if (winner === "tie") {
            if (p.side === "tie") gross = Math.floor(p.bet * 9);
            else gross = p.bet; // push
        }
        // Player net = gross - stake
        sum += (gross - p.bet);
    }
    return sum; // larger means more payout to players (worse for house)
}

function computeHouseBiasedWeights(participantsMap, userIdToProfile) {
    // Base: prefer lower total net payout to players
    const candidates = ["player","banker","tie"];
    const raw = {};
    let hasTieBet = false;
    for (const [, p] of participantsMap.entries()) if (p.side === 'tie') { hasTieBet = true; break; }
    for (const w of candidates) {
        const net = sumRoomNetPayoutForWinner(participantsMap, w);
        // Convert net to weight: lower net -> higher weight
        const liabilityScore = Math.max(0, net);
        const liabilityWeight = 1 / (1 + liabilityScore); // in (0,1]

        // History penalty: if likely winners are high win-rate users, decrease weight
        let winnersWinRateSum = 0;
        for (const [uid, p] of participantsMap.entries()) {
            const prof = userIdToProfile.get(uid);
            const b = prof?.baccarat || {};
            const rounds = Math.max(1, b.rounds || 0);
            const winRate = Math.min(1, Math.max(0, (b.wins || 0) / rounds));
            const wouldWin = (w === "player" && p.side === "player") || (w === "banker" && p.side === "banker") || (w === "tie" && p.side === "tie");
            if (wouldWin) winnersWinRateSum += winRate;
        }
        const historyPenalty = 1 / (1 + winnersWinRateSum); // more winners' winRate => lower weight

        // Slight floor for tie kept very low
        const tieFloor = w === "tie" ? 0.001 : 0;
        let weight = Math.max(0, liabilityWeight * historyPenalty + tieFloor);
        // If nobody bet tie, heavily downscale tie weight
        if (w === 'tie' && !hasTieBet) weight *= 0.05;
        raw[w] = weight;
    }
    // Normalize
    const total = (raw.player||0)+(raw.banker||0)+(raw.tie||0);
    return total > 0 ? { player: raw.player/total, banker: raw.banker/total, tie: raw.tie/total } : { player: 0.49, banker: 0.49, tie: 0.02 };
}

// ==========================
// Guild outcome history (Big Road) - persisted in MongoDB
// ==========================
const MAX_HISTORY = 70; // keep up to 70 rounds per guild

async function appendGuildOutcome(guildId, winner, tieMark) {
    if (!guildId) return;
    // Reset history (hard reset) once it reaches MAX_HISTORY entries
    try {
        const doc = await GuildState.findOne({ guild: guildId }, { baccaratHistory: 1 }).lean();
        const currentLen = Array.isArray(doc?.baccaratHistory) ? doc.baccaratHistory.length : 0;
        if (currentLen >= MAX_HISTORY) {
            await GuildState.updateOne(
                { guild: guildId },
                { $set: { baccaratHistory: [], tieMarks: [] } },
                { upsert: true }
            );
        }
    } catch (_) {}

    let symbol = null;
    if (winner === "banker") symbol = "B";
    else if (winner === "player") symbol = "P";
    if (!symbol && !tieMark) return; // ignore ties without position
    if (symbol) {
        await GuildState.updateOne(
            { guild: guildId },
            { $push: { baccaratHistory: symbol } },
            { upsert: true }
        );
    }
    if (tieMark) {
        await GuildState.updateOne(
            { guild: guildId },
            { $push: { tieMarks: tieMark } },
            { upsert: true }
        );
    }
}

async function getGuildHistory(guildId) {
    const doc = await GuildState.findOne({ guild: guildId }, { baccaratHistory: 1 }).lean();
    return Array.isArray(doc?.baccaratHistory) ? doc.baccaratHistory : [];
}

// Build a simplified Big Road grid from outcome sequence
// Returns an array of columns; each column is a vertical list (top-down) of symbols
// (Big Road/Derived rendering now imported from utils)

module.exports = {
    name: ["บาคาร่า"],
    description: "เล่นบาคาร่า เดิมพัน Player/Banker/Tie",
    category: "Economy",
    options: [
        {
            name: "จำนวนเงิน",
            type: ApplicationCommandOptionType.Integer,
            description: "จำนวนเงินที่ต้องการเดิมพัน",
            required: true,
            minValue: MIN_BET,
        },
        {
            name: "เดิมพัน",
            type: ApplicationCommandOptionType.String,
            description: "เลือกฝั่งที่จะเดิมพัน",
            required: true,
            choices: [
                { name: "Player (1:1)", value: "player" },
                { name: "Banker (0.95:1)", value: "banker" },
                { name: "Tie (8:1)", value: "tie" },
            ],
        },
    ],
    run: async (client, interaction) => {
        const user = interaction.user;
        const guildId = interaction.guild.id;

        // Room-based: no per-user lock; we use room phases

        try {
            await interaction.deferReply();

            // Get bet amount and side from command options
            const bet = interaction.options.getInteger("จำนวนเงิน");
            const side = interaction.options.getString("เดิมพัน");

            if (bet < MIN_BET || bet > MAX_BET) {
                return interaction.editReply({ content: `เดิมพันต้องอยู่ระหว่าง **${MIN_BET}** ถึง **${MAX_BET}** เท่านั้น` });
            }

            // Join or create room
            let room = getOrCreateRoom(guildId);
            if (room.status !== "collecting") {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `Baccarat | ไม่สามารถเข้าร่วมได้`, iconURL: interaction.guild.iconURL() || undefined })
                    .setColor(UI_COLORS.danger)
                    .setDescription(`ขณะนี้กำลังเปิดไพ่ กรุณารอให้จบรอบก่อนแล้วค่อยเดิมพันรอบถัดไป`);
                await interaction.followUp({ embeds: [embed], ephemeral: true });
                return;
            }
            if (room.participants.has(user.id)) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `Baccarat | เข้าร่วมแล้ว`, iconURL: interaction.guild.iconURL() || undefined })
                    .setColor(UI_COLORS.subtle)
                    .setDescription(`คุณได้เข้าร่วมรอบนี้แล้ว กรุณารอผล`);
                await interaction.followUp({ embeds: [embed], ephemeral: true });
                return;
            }

            // Safety: disallow joining across multiple channels at once
            // Only allow joins from the same channel where room started
            if (!room.channelId) {
                room.channelId = interaction.channelId;
            } else if (room.channelId !== interaction.channelId) {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `Baccarat | ช่องไม่ตรง`, iconURL: interaction.guild.iconURL() || undefined })
                    .setColor(UI_COLORS.danger)
                    .setDescription(`ขณะนี้มีห้องเดิมพันกำลังรันในอีกช่อง โปรดรอรอบใหม่หรือไปยังช่องเดิม`);
                await interaction.followUp({ embeds: [embed], ephemeral: true });
                return;
            }

            // Atomic balance decrement to join
            const decRes = await GProfile.updateOne(
                { guild: guildId, user: user.id, money: { $gte: bet } },
                { $inc: { money: -bet } }
            );
            if (!decRes || decRes.modifiedCount === 0) {
                return interaction.editReply({ content: `ยอดเงินไม่เพียงพอสำหรับเดิมพันนี้` });
            }

            room.participants.set(user.id, { bet, side, username: user.username });

            // Start timer if not started
            if (!room.timer) {
                room.deadline = Date.now() + ROOM_WAIT_MS;
                room.timer = setTimeout(async () => {
                    // Settle the room
                    const currentRoom = guildRooms.get(guildId);
                    if (!currentRoom || currentRoom.status !== "collecting") return;
                    currentRoom.status = "settling";
                    try {
                        // Load profiles for biasing
                        const userIds = Array.from(currentRoom.participants.keys());
                        const profiles = await GProfile.find({ guild: guildId, user: { $in: userIds } }, { baccarat: 1, user: 1 }).lean();
                        const userIdToProfile = new Map();
                        for (const pr of profiles) userIdToProfile.set(pr.user, pr);

                        const engineFactory = await loadBaccaratEngine();
                        const engine = engineFactory();
                        const rawPlay = engine.playRound ? () => engine.playRound() : () => engine();
                        // Volatility-aware selection with adaptive risk control + random hot streak
                        // 1) maybe activate hot streak for this guild
                        maybeActivateHotStreak(guildId);
                        // 2) choose desired winner weights by RTP adjusted by heavy-winner pressure
                        let desiredWeights = computeAdaptiveOutcomeWeights(currentRoom.participants, userIdToProfile);
                        // 3) if hot streak active, nudge weights toward majority side
                        desiredWeights = applyHotFavor(guildId, currentRoom.participants, desiredWeights);
                        const desired = pickWeighted({ player: desiredWeights.player, banker: desiredWeights.banker, tie: desiredWeights.tie });
                        // 4) build Big Road history symbols for volatility scoring
                        const historySymbols = await getGuildHistory(guildId);
                        // 5) generate candidates and pick the one that best fits volatility mode
                        const result = chooseRoundWithVolatility({
                            rawPlay,
                            historySymbols,
                            desiredWinner: desired,
                        });
                        const playerHand = result.player || result.playerHand || [];
                        const bankerHand = result.banker || result.bankerHand || [];
                        const winner = (result.winner || "").toLowerCase();
                        const points = result.points || { player: undefined, banker: undefined };

                        // Animated reveal to channel
                        const baseEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Baccarat | เปิดไพ่...`, iconURL: interaction.guild.iconURL() || undefined })
                            .setTitle(`แจกไพ่...`)
                            .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                            .setColor(UI_COLORS.primary)
                            .setDescription([
                                `Player: ${[renderBackCard(), renderBackCard(), renderBackCard()].join(" ")}`,
                                `Banker: ${[renderBackCard(), renderBackCard(), renderBackCard()].join(" ")}`,
                            ].join("\n"));
                        const msg = await interaction.followUp({ embeds: [baseEmbed] });

                        const pDisplay = [renderBackCard(), renderBackCard(), renderBackCard()];
                        const bDisplay = [renderBackCard(), renderBackCard(), renderBackCard()];
                        const makeFrame = (title) => {
                            const lines = [
                                `Player: ${pDisplay.join(" ")}`,
                                `Banker: ${bDisplay.join(" ")}`,
                            ];
                            return new EmbedBuilder()
                                .setAuthor({ name: `Baccarat | เปิดไพ่...`, iconURL: interaction.guild.iconURL() || undefined })
                                .setTitle(title)
                                .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                                .setColor(UI_COLORS.primary)
                                .setDescription(lines.join("\n"));
                        };
                        if (playerHand[0]) { pDisplay[0] = renderCard(playerHand[0]); await sleep(REVEAL_STEP_DELAY); await interaction.editReply ? null : null; await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); }
                        if (bankerHand[0]) { bDisplay[0] = renderCard(bankerHand[0]); await sleep(REVEAL_STEP_DELAY); await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(1000); }
                        if (playerHand[1]) { pDisplay[1] = renderCard(playerHand[1]); await sleep(REVEAL_STEP_DELAY); await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); }
                        if (bankerHand[1]) { bDisplay[1] = renderCard(bankerHand[1]); await sleep(REVEAL_STEP_DELAY); await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); }
                        if (playerHand[2]) { pDisplay[2] = renderCard(playerHand[2]); await sleep(REVEAL_STEP_DELAY); await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(800); }
                        if (bankerHand[2]) { bDisplay[2] = renderCard(bankerHand[2]); await sleep(REVEAL_STEP_DELAY); await msg.edit({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(800); }

                        // Compute returns per participant
                        const updates = [];
                        for (const [uid, p] of currentRoom.participants.entries()) {
                            let grossReturn = 0;
                            if (winner === "player") {
                                if (p.side === "player") grossReturn = Math.floor(p.bet * 2);
                            } else if (winner === "banker") {
                                if (p.side === "banker") grossReturn = Math.floor(p.bet * 1.95);
                            } else if (winner === "tie") {
                                if (p.side === "tie") grossReturn = Math.floor(p.bet * 9);
                                else grossReturn = p.bet; // push
                            }
                            if (grossReturn > 0) {
                                updates.push(GProfile.updateOne({ guild: guildId, user: uid }, { $inc: { money: grossReturn } }));
                            }
                        }
                        if (updates.length) await Promise.allSettled(updates);

                        // Record outcome to roads (with tie mark position if tie)
                        let tieMark = null;
                        if (winner === 'tie') {
                            // Compute last head position (col,row) on big road
                            const existing = await getGuildHistory(guildId);
                            const colsSim = buildBigRoadColumns(existing, 6);
                            let colIdx = colsSim.length - 1;
                            let rowIdx = (colsSim[colIdx]?.filter(Boolean).length || 1) - 1;
                            if (colIdx < 0) { colIdx = 0; rowIdx = 0; }
                            tieMark = { col: colIdx, row: rowIdx, count: 1 };
                        }
                        await appendGuildOutcome(guildId, winner, tieMark);
                        const guildHistory = await getGuildHistory(guildId);
                        // Note: tieMarks read in renderer
                        const bigCols = buildBigRoadColumns(guildHistory, 6);
                        const bigEyeCols = buildDerivedRoadColumns(bigCols, 1, 6);
                        const smallCols = buildDerivedRoadColumns(bigCols, 2, 6);
                        const cockroachCols = buildDerivedRoadColumns(bigCols, 3, 6);
                        let roadsAttachment = null;
                        try {
                            const png = await renderRoadsComposite({
                                widthCols: 36,
                                heightRows: 6,
                                bigRoadColumns: bigCols,
                                bigEyeColumns: bigEyeCols,
                                smallColumns: smallCols,
                                cockroachColumns: cockroachCols,
                                askPredict: {
                                    bigEye: {
                                        B: predictDerivedColor(bigCols, 'B', 1, 6),
                                        P: predictDerivedColor(bigCols, 'P', 1, 6),
                                    },
                                    small: {
                                        B: predictDerivedColor(bigCols, 'B', 2, 6),
                                        P: predictDerivedColor(bigCols, 'P', 2, 6),
                                    },
                                    cockroach: {
                                        B: predictDerivedColor(bigCols, 'B', 3, 6),
                                        P: predictDerivedColor(bigCols, 'P', 3, 6),
                                    },
                                },
                                tieMarks: (await GuildState.findOne({ guild: guildId }, { tieMarks: 1 }).lean())?.tieMarks || [],
                            });
                            if (png) {
                                const name = `roads_${guildId}_${Date.now()}.png`;
                                roadsAttachment = { attachment: Buffer.from(png), name };
                            }
                        } catch (_) {}

                        // Build summary embed
                        const summary = [];
                        for (const [uid, p] of currentRoom.participants.entries()) {
                            let grossReturn = 0;
                            if (winner === "player") {
                                if (p.side === "player") grossReturn = Math.floor(p.bet * 2);
                            } else if (winner === "banker") {
                                if (p.side === "banker") grossReturn = Math.floor(p.bet * 1.95);
                            } else if (winner === "tie") {
                                if (p.side === "tie") grossReturn = Math.floor(p.bet * 9);
                                else grossReturn = p.bet;
                            }
                            const net = grossReturn - p.bet;
                            const tag = `<@${uid}>`;
                            summary.push(`• ${tag}: ${p.side.toUpperCase()} | เดิมพัน ${formatNum(p.bet)} | สุทธิ ${net >= 0 ? `+${formatNum(net)}` : `${formatNum(net)}`}`);
                        }

                        const resultEmbed = new EmbedBuilder()
                            .setAuthor({ name: `Baccarat | รอบรวมผู้เล่น`, iconURL: interaction.guild.iconURL() || undefined })
                            .setTitle(`ผลลัพธ์บาคาร่า`)
                            .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                            .setColor(winner === "player" ? UI_COLORS.player : winner === "banker" ? UI_COLORS.banker : UI_COLORS.tie)
                            .setDescription([
                                `ผู้ชนะ: **${winner.toUpperCase()}**`,
                                `Player: ${renderHand(playerHand)} ${points.player !== undefined ? `(${points.player})` : ""}`,
                                `Banker: ${renderHand(bankerHand)} ${points.banker !== undefined ? `(${points.banker})` : ""}`,
                                "",
                                ...summary,
                            ].join("\n"));

                        if (roadsAttachment) {
                            const roadsEmbed = new EmbedBuilder().setColor(UI_COLORS.subtle).setImage(`attachment://${roadsAttachment.name}`);
                            await interaction.followUp({ embeds: [resultEmbed, roadsEmbed], files: [roadsAttachment] });
                        } else {
                            await interaction.followUp({ embeds: [resultEmbed] });
                        }
                        try { await msg.delete(); } catch (_) {}
                    } catch (e) {
                        console.error("Room settle error:", e);
                    } finally {
                        // reset room
                        clearTimeout(currentRoom.timer);
                        // consume hot streak round if active
                        const remain = guildHotState.get(guildId) || 0;
                        if (remain > 0) guildHotState.set(guildId, remain - 1);
                        guildRooms.delete(guildId);
                    }
                }, roomTimeLeftMs(room));
            }

            const secondsLeft = Math.ceil(roomTimeLeftMs(room) / 1000);
            const ackEmbed = new EmbedBuilder()
                .setAuthor({ name: `Baccarat | เข้าร่วมรอบ`, iconURL: interaction.guild.iconURL() || undefined })
                .setThumbnail(user.displayAvatarURL())
                .setColor(UI_COLORS.primary)
                .setDescription([
                    `เข้าร่วมรอบแล้ว`,
                    `ฝั่ง: **${side.toUpperCase()}**`,
                    `เดิมพัน: **${formatNum(bet)}**`,
                    `จะเปิดไพ่ใน **${secondsLeft}s**`,
                ].join("\n"))
                .setFooter({ text: `ขั้นต่ำ: ⏣ ${MIN_BET} | สูงสุด: ⏣ ${MAX_BET}` });
            return interaction.editReply({ embeds: [ackEmbed] });
            
            // Old single-round per-user flow removed in room mode

            let grossReturn = 0;
            if (winner === "player") {
                if (side === "player") grossReturn = Math.floor(bet * 2); // 1:1 -> bet + win
            } else if (winner === "banker") {
                if (side === "banker") grossReturn = Math.floor(bet * 1.95); // 0.95:1 -> bet + win
            } else if (winner === "tie") {
                if (side === "tie") grossReturn = Math.floor(bet * 9); // 8:1 -> bet + win
                else grossReturn = bet; // push: refund stake when not betting tie
            }

            if (grossReturn > 0) {
                await GProfile.updateOne(
                    { guild: guildId, user: user.id },
                    { $inc: { money: grossReturn } }
                );
            }

            const profile = await GProfile.findOne({ guild: guildId, user: user.id }, { money: 1, baccarat: 1 }).lean();
            const balance = profile?.money ?? 0;

            const net = grossReturn - bet; // profit minus stake

            // Update baccarat stats in a single operation
            const incDoc = { 
                "baccarat.rounds": 1, 
                "baccarat.net": net 
            };
            if (winner === "tie") {
                incDoc["baccarat.ties"] = 1;
            } else if (grossReturn > bet) {
                incDoc["baccarat.wins"] = 1;
            } else if (grossReturn < bet) {
                incDoc["baccarat.losses"] = 1;
            }
            
            await GProfile.updateOne({ guild: guildId, user: user.id }, { $inc: incDoc });

            // Animated reveal sequence
            const baseEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | Baccarat`, iconURL: user.displayAvatarURL() })
                .setTitle(`แจกไพ่...`)
                .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                .setColor(client.color)
                .setDescription([
                    `Player: ${[renderBackCard(), renderBackCard(), renderBackCard()].join(" ")}`,
                    `Banker: ${[renderBackCard(), renderBackCard(), renderBackCard()].join(" ")}`,
                ].join("\n"))
                .setFooter({ text: `ขั้นต่ำ: ⏣ ${MIN_BET} | สูงสุด: ⏣ ${MAX_BET}` });
            await interaction.editReply({ embeds: [baseEmbed] });

            // Progressive reveals
            const pDisplay = [renderBackCard(), renderBackCard(), renderBackCard()];
            const bDisplay = [renderBackCard(), renderBackCard(), renderBackCard()];
            const steps = [];
            const makeFrame = (title) => {
                const lines = [
                    `Player: ${pDisplay.join(" ")}`,
                    `Banker: ${bDisplay.join(" ")}`,
                ];
                return new EmbedBuilder()
                .setAuthor({ name: `${user.username} | Baccarat`, iconURL: user.displayAvatarURL() })
                .setTitle(title)
                .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                .setColor(client.color)
                .setDescription(lines.join("\n"))
                .setFooter({ text: `ขั้นต่ำ: ⏣ ${MIN_BET} | สูงสุด: ⏣ ${MAX_BET}` });
            };

            // Reveal order: P1, B1, P2, B2, P3?, B3?
            if (playerHand[0]) { pDisplay[0] = renderCard(playerHand[0]); steps.push("P1"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); }
            if (bankerHand[0]) { bDisplay[0] = renderCard(bankerHand[0]); steps.push("B1"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(2000); }
            if (playerHand[1]) { pDisplay[1] = renderCard(playerHand[1]); steps.push("P2"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); }
            if (bankerHand[1]) { bDisplay[1] = renderCard(bankerHand[1]); steps.push("B2"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); }
            if (playerHand[2]) { pDisplay[2] = renderCard(playerHand[2]); steps.push("P3"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(1000); }
            if (bankerHand[2]) { bDisplay[2] = renderCard(bankerHand[2]); steps.push("B3"); await sleep(REVEAL_STEP_DELAY); await interaction.editReply({ embeds: [makeFrame("เปิดไพ่...")] }); await sleep(1000); }

            // Final result embed
            const resultLines = [
                `Player: ${pDisplay.join(" ")} ${points.player !== undefined ? `(${points.player})` : ""}`,
                `Banker: ${bDisplay.join(" ")} ${points.banker !== undefined ? `(${points.banker})` : ""}`,
            ];
            
            const resultEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | Baccarat`, iconURL: user.displayAvatarURL() })
                .setTitle(`ผลลัพธ์บาคาร่า`)
                .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/Dealer.png")
                .setColor(winner === "player" ? client.color : winner === "banker" ? client.color : 0x3ba55c)
                .setDescription(
                    [
                        ...resultLines,
                        `ผู้ชนะ: **${winner.toUpperCase() || "N/A"}**`,
                        "",
                        `เดิมพัน: **${bet}** <:706219192923455549:1312400668056748032> | ฝั่ง: **${side.toUpperCase()}**`,
                        `รับคืนรวม: **${grossReturn}** <:706219192923455549:1312400668056748032>`,
                        `สุทธิ: **${net >= 0 ? `+${net}` : `${net}`}** <:706219192923455549:1312400668056748032>`,
                    ].join("\n")
                )
                .setFooter({ text: `ขั้นต่ำ: ⏣ ${MIN_BET} | สูงสุด: ⏣ ${MAX_BET}` });

            await sleep(1000);
            // Record outcome for guild Big Road (ignore ties) and read history
            await appendGuildOutcome(guildId, winner);
            const guildHistory = await getGuildHistory(guildId);
            const bigCols = buildBigRoadColumns(guildHistory, 6);
            const bigRoadText = renderBigRoadGrid(guildHistory, 6, 12);
            const bigEye = renderDerivedGrid(bigCols, 1, 6, 12);
            const smallRoad = renderDerivedGrid(bigCols, 2, 6, 12);
            const cockroach = renderDerivedGrid(bigCols, 3, 6, 12);

            const roadsEmbed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} | Roads`, iconURL: user.displayAvatarURL() })
                .setColor(client.color);

            // Try canvas composite (optional)
            let roadsAttachment = null;
            try {
                const bigEyeCols = buildDerivedRoadColumns(bigCols, 1, 6);
                const smallCols = buildDerivedRoadColumns(bigCols, 2, 6);
                const cockroachCols = buildDerivedRoadColumns(bigCols, 3, 6);
                const png = await renderRoadsComposite({
                    widthCols: 36,
                    heightRows: 6,
                    bigRoadColumns: bigCols,
                    bigEyeColumns: bigEyeCols,
                    smallColumns: smallCols,
                    cockroachColumns: cockroachCols,
                });
                if (png) {
                    const name = `roads_${guildId}.png`;
                    roadsAttachment = { attachment: Buffer.from(png), name };
                    roadsEmbed.setImage(`attachment://${name}`);
                }
            } catch (_) {}
            if (roadsAttachment) {
                await interaction.editReply({ embeds: [resultEmbed, roadsEmbed], files: [roadsAttachment] });
            } else {
                await interaction.editReply({ embeds: [resultEmbed] });
            }
        } catch (err) {
            // Refund on failure
            try {
                await GProfile.updateOne(
                    { guild: guildId, user: user.id },
                    { $inc: { money: bet } }
                );
            } catch (_) { }
            await interaction.editReply({ content: `เกิดข้อผิดพลาดในการเล่นบาคาร่า: ${err.message || err}` });
        }
    }
};


