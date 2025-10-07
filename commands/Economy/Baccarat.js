const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const https = require("https");
const vm = require("vm");
const GProfile = require("../../settings/models/profile.js");

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
    tie: 0.05, // tie means round result = tie
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

// Engine version and integrity check
const ENGINE_VERSION = "1.1.5";
const EXPECTED_SHA256 = {
    "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.min.js": "expected_hash_here",
    "https://cdn.jsdelivr.net/npm/baccarat-engine@1.1.5/dist/index.umd.js": "expected_hash_here"
};

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

        // Check if user is already playing
        if (isLocked(user.id)) {
            return interaction.reply({ 
                content: "⏳ คุณกำลังเล่นบาคาร่าอยู่ กรุณารอให้รอบปัจจุบันเสร็จสิ้น", 
                ephemeral: true 
            });
        }

        // Acquire lock
        if (!acquireLock(user.id)) {
            return interaction.reply({ 
                content: "⏳ คุณกำลังเล่นบาคาร่าอยู่ กรุณารอให้รอบปัจจุบันเสร็จสิ้น", 
                ephemeral: true 
            });
        }

        try {
            // Check interaction age before deferring
            const interactionAge = Date.now() - interaction.createdTimestamp;
            if (interactionAge > 3000) { // 3 seconds
                console.warn(`[BACCARAT] Interaction too old: ${interactionAge}ms, skipping`);
                return;
            }

            await interaction.deferReply();

            // Get bet amount and side from command options
            const bet = interaction.options.getInteger("จำนวนเงิน");
            const side = interaction.options.getString("เดิมพัน");

            if (bet < MIN_BET || bet > MAX_BET) {
                return interaction.editReply({ content: `เดิมพันต้องอยู่ระหว่าง **${MIN_BET}** ถึง **${MAX_BET}** เท่านั้น` });
            }

            // Atomic balance decrement
            const decRes = await GProfile.updateOne(
                { guild: guildId, user: user.id, money: { $gte: bet } },
                { $inc: { money: -bet } }
            );
            if (!decRes || decRes.modifiedCount === 0) {
                return interaction.editReply({ content: `ยอดเงินไม่เพียงพอสำหรับเดิมพันนี้` });
            }

            try {
            const engineFactory = await loadBaccaratEngine();
            const engine = engineFactory();

            // Play one round using engine API from sample usage
            // Expect engine.playRound() to return { player: [cards], banker: [cards], winner: 'player'|'banker'|'tie', points: { player, banker } }
            const rawPlay = engine.playRound ? () => engine.playRound() : () => engine();
            const existingProfile = await GProfile.findOne({ guild: guildId, user: user.id }, { baccarat: 1 }).lean();
            const userOutcomeWeights = deriveUserOutcomeWeights(existingProfile);
            const result = playRoundBiasedByOutcome(rawPlay, side, userOutcomeWeights);

            const playerHand = result.player || result.playerHand || [];
            const bankerHand = result.banker || result.bankerHand || [];
            const winner = (result.winner || "").toLowerCase();
            const points = result.points || { player: undefined, banker: undefined };

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
                .setColor(0x5865f2)
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
                .setColor(0x5865f2)
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
                .setColor(winner === "player" ? 0x5865f2 : winner === "banker" ? 0xd83c3e : 0x3ba55c)
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
            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (err) {
            // Refund on failure
            try {
                await GProfile.updateOne(
                    { guild: guildId, user: user.id },
                    { $inc: { money: bet } }
                );
            } catch (_) { }
            await interaction.editReply({ content: `เกิดข้อผิดพลาดในการเล่นบาคาร่า: ${err.message || err}` });
        } finally {
            // Always release the lock
            releaseLock(user.id);
        }
        } catch (outerErr) {
            console.error("Outer error in baccarat:", outerErr);
            releaseLock(user.id);
        }
    }
};


