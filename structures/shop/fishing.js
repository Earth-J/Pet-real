module.exports = {
  rarities: {
    Common: { multiplier: 1.0, emoji: "⚪" },
    Rare: { multiplier: 1.6, emoji: "🟦" },
    Epic: { multiplier: 2.4, emoji: "🟪" },
    Legendary: { multiplier: 4.0, emoji: "🟨" },
    Mythic: { multiplier: 6.0, emoji: "🔮" },
    Divine: { multiplier: 10.0, emoji: "🌟" },
  },
  repairCostPerPoint: 20,
  rods: [
    { id: "hand", name: "Bare Hand", price: 0, qualityPercent: 0, maxDurability: 999, emoji: "<a:hand:1405879604392103998>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/rod/hand.gif", description: "การตกปลาด้วยมือเปล่า", effects: {
      // Buffs: +5% chance to catch unique variants
      variantChanceBonus: 0.05,
      // Debuffs: Cannot catch bosses (และอยู่ในโค้ดห้ามใส่เหยื่ออยู่แล้ว)
      canCatchBosses: false,
      cooldownMsMultiplier: 1.0,
      durabilityWearMultiplier: 1.0,
      bombDamageTakenMultiplier: 1.0,
      allowHQVariants: true,
      allowChromaVariants: true,
      priceMultiplier: 1.0,
      sizeLbsMultiplier: 1.0,
      sizeInMultiplier: 1.0
    } },
    { id: "fishing_rod", name: "Fishing Rod", price: 500, qualityPercent: 35, maxDurability: 20, emoji: "<:fishing_rod:1405879589322096793>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/rod/fishing_rod.webp", effects: {
      // Buffs: +5% chance for high quality variants
      hqVariantChanceBonus: 0.05,
      variantWeightMultiplierHQ: 1.5,
      // Debuffs: Cannot catch bosses
      canCatchBosses: false,
      cooldownMsMultiplier: 1.0,
      onSpotSuccessBonusPercent: 0,
      offSpotSuccessBonusPercent: 0,
      durabilityWearMultiplier: 1.0,
      bombDamageTakenMultiplier: 1.0,
      baitPreserveChance: 0.0,
      allowHQVariants: true,
      allowChromaVariants: true,
      priceMultiplier: 1.0,
      sizeLbsMultiplier: 1.0,
      onSpotSuccessBonusPercent: 5,
      offSpotSuccessBonusPercent: 7,
      durabilityWearMultiplier: 1.25,
      bombDamageTakenMultiplier: 1.25,
      baitPreserveChance: 0.0,
      priceMultiplier: 1.05,
      sizeLbsMultiplier: 1.05,
      sizeInMultiplier: 1.0
    } },
    { id: "magnetfishingrope", name: "Magnet Fishing Rope", price: 5000, qualityPercent: 75, maxDurability: 60, emoji: "<:magnetfishingrope:1405879611237335051>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/rod/magnetfishingrope.webp", effects: {
      cooldownMsMultiplier: 0.85,
      onSpotSuccessBonusPercent: -5,
      offSpotSuccessBonusPercent: 12,
      durabilityWearMultiplier: 1.1,
      bombDamageTakenMultiplier: 1.1,
      baitPreserveChance: 0.15,
      priceMultiplier: 0.95,
      sizeLbsMultiplier: 1.0,
      sizeInMultiplier: 1.0
    } },
  ],
  baits: [
    { id: "golden_bait", name: "Golden Bait", price: 50, bonusPercent: 10, emoji: "<:golden_bait:1405879756704059463>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/golden_bait.webp", effects: {
      priceMultiplier: 1.25,
      variantChanceBonus: 0.03,
      hqVariantChanceBonus: 0.02,
      rarityWeightMultipliers: { Rare: 1.1, Epic: 1.15, Legendary: 1.2 }
    } },
    { id: "timely_bait", name: "Timely Bait", price: 100, bonusPercent: 20, emoji: "<:timely_bait:1405879785162539038>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/timely_bait.webp", effects: {
      onSpotSuccessBonusPercent: 2,
      offSpotSuccessBonusPercent: 3,
      phaseSuccessBonus: { day: 3, night: 3 },
      phaseWeightMultiplier: { day: 1.2, night: 1.2 }
    } },
    { id: "lucky_bait", name: "Lucky Bait", price: 300, bonusPercent: 35, emoji: "<:lucky_bait:1405879762672423024>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/lucky_bait.webp", effects: {
      offSpotSuccessBonusPercent: 8,
      variantChanceBonus: 0.05,
      preserveChance: 0.05,
      rarityWeightMultipliers: { Rare: 1.15, Epic: 1.1, Legendary: 1.05 }
    } },
    { id: "weighted_bait", name: "Weighted Bait", price: 1000, bonusPercent: 0, emoji: "<:weighted_bait:1405879805013917828>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/weighted_bait.webp", effects: {
      sizeLbsMultiplier: 1.25,
      sizeInMultiplier: 1.1
    } },
    { id: "money_bait", name: "Money Bait", price: 1000, bonusPercent: 0, emoji: "<:money_bait:1405879779114090566>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/money_bait.webp", effects: {
      priceMultiplier: 1.3
    } },
    { id: "magnet_bait", name: "Magnet Bait", price: 1000, bonusPercent: 0, emoji: "<:magnet_bait:1405879771631714334>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/magnet_bait.webp", effects: {
      rarityWeightMultipliers: { Legendary: 1.1, Mythic: 1.15, Divine: 1.1 }
    } },
    { id: "gift_bait", name: "Gift Bait", price: 1000, bonusPercent: 0, emoji: "<:gift_bait:1405879750484037642>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bait/gift_bait.png", effects: {
      variantChanceBonus: 0.1,
      hqVariantChanceBonus: 0.05,
      rarityWeightMultipliers: { Rare: 1.1, Epic: 1.05 }
    } },
  ],
  buckets: [
    { id: "wooden_bucket", name: "Wooden Bucket", price: 0, capacity: 10, emoji: "<:wooden_bucket:1405879717709615144>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/wooden_bucket.png", description: "ถังเริ่มต้น" },
    { id: "pink_bucket", name: "Pink Bucket", price: 0, capacity: 10, emoji: "<:pink_bucket:1405879699837550592>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/pink_bucket.png", description: "ถังเริ่มต้น" },
    { id: "metal_bucket", name: "Metal Bucket", price: 5000, capacity: 20, emoji: "<:metal_bucket:1405879676362162288>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/metal_bucket.png", description: "ถังขนาดใหญ่" },
    { id: "golden_bucket", name: "Golden Bucket", price: 15000, capacity: 35, emoji: "<a:golden_bucket:1405879670020509717>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/golden_bucket.gif", description: "ถังขนาดมหึมา" },
    { id: "winterlight_bucket", name: "Winterlight Bucket", price: 50000, capacity: 50, emoji: "<a:winterlight_bucket:1405879711791317062>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/winterlight_bucket.gif", description: "ถังขั้นสุดยอด" },
    { id: "coal_bucket", name: "Coal Bucket", price: 200000, capacity: 100, emoji: "<:coal_bucket:1405879654966886513>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/coal_bucket.png", description: "ถังไร้ขีดจำกัด" },
    { id: "god_bucket", name: "God Bucket", price: 200000, capacity: 100, emoji: "<a:god_bucket:1405879666153226300>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/god_bucket.gif", description: "ถังไร้ขีดจำกัด" },
    { id: "shark_bucket", name: "Shark Bucket", price: 200000, capacity: 100, emoji: "<a:shark_bucket:1405879706284200017>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/bucket/shark_bucket.gif", description: "ถังไร้ขีดจำกัด" },
  ], 
  locations: [
    // Freshwater
    { id: "camp_guillermo", waterType: "Freshwater", name: "Camp Guillermo", travelSeconds: 20, emoji: "<:camp_guillermo:1405111669985640498>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/camp_guillermo.png", lootTable: [
      // Common Fish
      { 
        id: "bass", 
        name: "Bass", 
        rarity: "Common", 
        weight: 30, 
        timeWindows: [[22,24],[0,15]], 
        fixedPrice: 5000, 
        minLbs: 1.0, 
        maxLbs: 6.0, 
        minIn: 10, 
        maxIn: 24, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bass.png", 
        emoji: "<:bass:1404815370111549441>", 
        variants: [
          { name: "HQ Bass", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bass_hq.gif", emoji: "<a:bass_hq:1404815385034887228>", rarity: "Rare", weight: 5 },
          { name: "Chroma Bass", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bass_chroma.png", emoji: "<:bass_chroma:1404815377740861581>", rarity: "Epic", weight: 1 }
        ] 
      },
      
      { 
        id: "bluegill", 
        name: "Bluegill", 
        rarity: "Common", 
        weight: 30, 
        timeWindows: [[4,15]], 
        fixedPrice: 5000, 
        minLbs: 0.3, 
        maxLbs: 2.0, 
        minIn: 6, 
        maxIn: 12, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bluegill.png", 
        emoji: "<:bluegill:1404815391787843614>", 
        variants: [
          { name: "HQ Bluegill", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bluegill_hq.gif", emoji: "<a:bluegill_hq:1404815409332617328>", rarity: "Rare", weight: 5 },
          { name: "Chroma Bluegill", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bluegill_chroma.png", emoji: "<:bluegill_chroma:1404815399136006225>", rarity: "Epic", weight: 1 }
        ] 
      },
      
      { 
        id: "crappie", 
        name: "Crappie", 
        rarity: "Common", 
        weight: 20, 
        timeWindows: [[10,21]], 
        fixedPrice: 5000, 
        minLbs: 0.5, 
        maxLbs: 3.0, 
        minIn: 8, 
        maxIn: 14, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/crappie.png", 
        emoji: "<:crappie:1404815432464072734>", 
        variants: [
          { name: "HQ Crappie", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/crappie_hq.gif", emoji: "<a:crappie_hq:1404815444006666282>", rarity: "Rare", weight: 5 },
          { name: "Chroma Crappie", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/crappie_chroma.png", emoji: "<:crappie_chroma:1404815438239760454>", rarity: "Epic", weight: 1 }
        ] 
      },
      
      { 
        id: "guppy", 
        name: "Guppy", 
        rarity: "Common", 
        weight: 20, 
        timeWindows: [[16,24],[0,3]], 
        fixedPrice: 10000, 
        minLbs: 0.1, 
        maxLbs: 0.8, 
        minIn: 3, 
        maxIn: 8, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/guppy.png", 
        emoji: "<:guppy:1404815464844103771>", 
        variants: [
          { name: "HQ Guppy", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/guppy_hq.gif", emoji: "<a:guppy_hq:1404815478555414698>", rarity: "Rare", weight: 5 },
          { name: "Chroma Guppy", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/guppy_chroma.png", emoji: "<:guppy_chroma:1404815471026508059>", rarity: "Epic", weight: 1 }
        ] 
      },
      
      { 
        id: "minnow", 
        name: "Minnow", 
        rarity: "Common", 
        weight: 25, 
        timeWindows: [[4,15]], 
        fixedPrice: 2500, 
        minLbs: 0.1, 
        maxLbs: 0.6, 
        minIn: 2, 
        maxIn: 6, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/minnow.png", 
        emoji: "<:minnow:1404815521760805055>", 
        variants: [
          { name: "HQ Minnow", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/minnow_hq.gif", emoji: "<a:minnow_hq:1404815527288770611>", rarity: "Rare", weight: 5 }
        ] 
      },

      // Rare Fish
      { 
        id: "bullfrog", 
        name: "Bullfrog", 
        rarity: "Rare", 
        weight: 8, 
        timeWindows: [[4,21]], 
        fixedPrice: 10000, 
        minLbs: 0.5, 
        maxLbs: 3.0, 
        minIn: 6, 
        maxIn: 10, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bullfrog.png", 
        emoji: "<:bullfrog:1404815418614611998>", 
        variants: [
          { name: "HQ Bullfrog", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/bullfrog_hq.gif", emoji: "<a:bullfrog_hq:1404815425245806604>", rarity: "Epic", weight: 2 }
        ] 
      },
      
      { 
        id: "goldfish", 
        name: "Goldfish", 
        rarity: "Rare", 
        weight: 6, 
        timeWindows: [[16,24],[0,9]], 
        fixedPrice: 10000, 
        minLbs: 0.2, 
        maxLbs: 1.5, 
        minIn: 4, 
        maxIn: 10, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/goldfish.png", 
        emoji: "<:goldfish:1404815449866113104>", 
        variants: [
          { name: "HQ Goldfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/goldfish_hq.gif", emoji: "<a:goldfish_hq:1404815453976531165>", rarity: "Epic", weight: 2 },
          { name: "Solid Goldfish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/goldfish_solid.png", emoji: "<a:goldfish_solidgold:1404815461664817253>", rarity: "Legendary", weight: 0.5 }
        ] 
      },
      
      { 
        id: "snappingturtle", 
        name: "Snapping Turtle", 
        rarity: "Rare", 
        weight: 4, 
        timeWindows: [[0,24]], 
        fixedPrice: 5000, 
        minLbs: 2.0, 
        maxLbs: 20.0, 
        minIn: 10, 
        maxIn: 30, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/snappingturtle.png", 
        emoji: "<:snappingturtle:1404815532745691306>", 
        variants: [
          { name: "HQ Snapping Turtle", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/snapping_turtle_hq.gif", emoji: "<a:snappingturtle_hq:1404815538475241553>", rarity: "Epic", weight: 2 }
        ] 
      },
      
      { 
        id: "turkeyfish", 
        name: "Turkey Fish", 
        rarity: "Rare", 
        weight: 5, 
        timeWindows: [[0,24]], 
        fixedPrice: 10000, 
        requiresBait: "bait_turkey", 
        minLbs: 1.0, 
        maxLbs: 8.0, 
        minIn: 10, 
        maxIn: 24, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/turkeyfish.png", 
        emoji: "<:turkeyfish:1404815544900780042>", 
        variants: [
          { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/turkeyfish_hq.gif", emoji: "<a:turkeyfish_hq:1404815553264222348>", rarity: "Epic", weight: 2 }
        ] 
      },

      // Epic Fish
      { 
        id: "koi", 
        name: "Koi", 
        rarity: "Epic", 
        weight: 2, 
        timeWindows: [[10,24],[0,3]], 
        fixedPrice: 250000, 
        minLbs: 2.0, 
        maxLbs: 10.0, 
        minIn: 12, 
        maxIn: 28, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/koi.png", 
        emoji: "<:koi:1404815484465053736>", 
        variants: [
          { name: "HQ Koi", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/koi_hq.gif", emoji: "<a:koi_hq:1404815508188172381>", rarity: "Legendary", weight: 0.5 },
          { name: "Black Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/koi_black.png", emoji: "<:koi_black:1404815491578462271>", rarity: "Mythic", weight: 0.2 },
          { name: "Blue Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/koi_blue.png", emoji: "<:koi_blue:1404815498977214514>", rarity: "Mythic", weight: 0.2 },
          { name: "Yellow Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/koi_yellow.png", emoji: "<:koi_yellow:1404815514781618319>", rarity: "Mythic", weight: 0.2 }
        ] 
      },

      // Mythic Fish (Boss Level)
      { 
        id: "aspidochelone", 
        name: "Aspidochelone", 
        rarity: "Mythic", 
        weight: 0.2, 
        timeWindows: [[0,24]], 
        fixedPrice: 12000000, 
        minLbs: 200.0, 
        maxLbs: 800.0, 
        minIn: 60, 
        maxIn: 120, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/aspidochelone.png", 
        emoji: "<:aspidochelone:1404815356970668062>", 
        variants: [
          { name: "HQ Aspidochelone", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/aspidochelone_hq.gif", emoji: "<a:aspidochelone_hq:1404815364159967262>", rarity: "Divine", weight: 0.1 }
        ] 
      },
      
      { 
        id: "ahuitzotl", 
        name: "Ahuitzotl", 
        rarity: "Mythic", 
        weight: 0.2, 
        timeWindows: [[0,24]], 
        fixedPrice: 12000000, 
        minLbs: 150.0, 
        maxLbs: 600.0, 
        minIn: 50, 
        maxIn: 110, 
        thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/ahuitzotl.png", 
        emoji: "<:ahuitzotl:1404815341623967776>", 
        variants: [
          { name: "HQ Ahuitzotl", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/camp_guillermo/ahuitzotl_hq.gif", emoji: "<a:ahuitzotl_hq:1404815352226910339>", rarity: "Divine", weight: 0.1 }
        ] 
      },
      
    ] },

    
    { id: "wily_river", waterType: "Freshwater", name: "Wily River", travelSeconds: 30, emoji: "<:wily_river:1405113029447909397>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/wily_river.png", lootTable: [
 // Catfish (update to 10pm-9am)
      { id: "catfish", name: "Catfish", rarity: "Rare", weight: 20, timeWindows: [[22,24],[0,9]], minLbs: 2.0, maxLbs: 15.0, minIn: 14, maxIn: 34, pricePerLb: 180, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/catfish.png", emoji: "<:catfish:1405115130144100412>", variants: [ { name: "HQ Catfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/fish_catfish_hq.gif", emoji: "<a:catfish_hq:1405115136867438632>", rarity: "Epic", weight: 2 } ] },
      // Salmon (update to 4pm-3am)
      { id: "salmon", name: "Salmon", rarity: "Epic", weight: 5, timeWindows: [[16,24],[0,3]], minLbs: 6.0, maxLbs: 18.0, minIn: 20, maxIn: 36, pricePerLb: 320, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/salmon.png", emoji: "<:salmon:1405115269885726780>", variants: [ { name: "HQ Salmon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/fish_salmon_hq.gif", emoji: "<a:salmon_hq:1405115276542083072>", rarity: "Legendary", weight: 0.5 } ] },
      // Electric Eel 4am-9pm
      { id: "electriceel", name: "Electric Eel", rarity: "Rare", weight: 10, timeWindows: [[4,21]], minLbs: 3.0, maxLbs: 12.0, minIn: 20, maxIn: 60, pricePerLb: 280, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/electriceel.png", emoji: "<:electriceel:1405115156488519710>", variants: [ { name: "HQ Electric Eel", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/eel_electric_hq.gif", emoji: "<a:electriceel_hq:1405115164159639563>", rarity: "Epic", weight: 2 } ] },
      // Piranha 4pm-3am
      { id: "piranha", name: "Piranha", rarity: "Rare", weight: 12, timeWindows: [[16,24],[0,3]], minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, pricePerLb: 250, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/piranha.png", emoji: "<:piranha:1405115214994608158>", variants: [ { name: "HQ Piranha", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/piranha_hq.gif", emoji: "<a:piranha_hq:1405115227699150968>", rarity: "Epic", weight: 2 }, { name: "Chroma Piranha", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/piranha_chroma.png", emoji: "<:piranha_chroma:1405115220984201228>", rarity: "Legendary", weight: 0.5 } ] },
      // Crayfish 4am-3pm
      { id: "crayfish", name: "Crayfish", rarity: "Common", weight: 18, timeWindows: [[4,15]], minLbs: 0.3, maxLbs: 2.0, minIn: 6, maxIn: 12, pricePerLb: 150, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/crayfish.png", emoji: "<:crayfish:1405115143448297583>", variants: [ { name: "HQ Crayfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/crayfish_hq.gif", emoji: "<a:crayfish_hq:1405115151023341578>", rarity: "Rare", weight: 5 } ] },
      // Sturgeon 12am-4pm (already added)
      { id: "sturgeon", name: "Sturgeon", rarity: "Rare", weight: 8, timeWindows: [[0,16]], minLbs: 5.0, maxLbs: 40.0, minIn: 24, maxIn: 60, pricePerLb: 380, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/sturgeon.png", emoji: "<:sturgeon:1405115283961811056>", variants: [ { name: "HQ Sturgeon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/sturgeon_hq.gif", emoji: "<a:sturgeon_hq:1405115297639432332>", rarity: "Epic", weight: 2 }, { name: "Chroma Sturgeon", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/sturgeon_chroma.png", emoji: "<:sturgeon_chroma:1405115290378960936>", rarity: "Legendary", weight: 0.5 } ] },
      // Arapaima 12am-6am, also Snowy Mountain will add separately
      { id: "arapaima", name: "Arapaima", rarity: "Epic", weight: 3, timeWindows: [[0,6]], minLbs: 30.0, maxLbs: 200.0, minIn: 30, maxIn: 80, pricePerLb: 650, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/arapaima.png", emoji: "<:arapaima:1405115104273371218>", variants: [ { name: "HQ Arapaima", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/arapaima_hq.gif", emoji: "<a:arapaima_hq:1405115111621922927>", rarity: "Legendary", weight: 0.5 } ] },
      // Golden Dorado 4pm-9am
      { id: "goldendorado", name: "Golden Dorado", rarity: "Epic", weight: 2, timeWindows: [[16,24],[0,9]], minLbs: 5.0, maxLbs: 35.0, minIn: 20, maxIn: 50, pricePerLb: 750, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/goldendorado.png", emoji: "<:goldendorado:1405115171046690846>", variants: [ { name: "HQ Golden Dorado", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/golden_dorado_hq.gif", emoji: "<a:goldendorado_hq:1405115187077320746>", rarity: "Legendary", weight: 0.5 }, { name: "Chroma Golden Dorado", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/golden_dorado_chroma.png", emoji: "<a:goldendorado_chroma:1405115178348970196>", rarity: "Mythic", weight: 0.2 } ] },
      // Rainbow Bass 4am-3pm
      { id: "rainbowbass", name: "Rainbow Bass", rarity: "Rare", weight: 6, timeWindows: [[4,15]], minLbs: 1.0, maxLbs: 9.0, minIn: 10, maxIn: 24, pricePerLb: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/rainbowbass.png", emoji: "<:rainbowbass:1405115233525174312>", variants: [ { name: "HQ Rainbow Bass", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/rainbow_bass_hq.gif", emoji: "<a:rainbowbass_hq:1405115241229979771>", rarity: "Epic", weight: 2 } ] },
      // Red Arowana 10am-3am
      { id: "redarowana", name: "Red Arowana", rarity: "Epic", weight: 2, timeWindows: [[10,24],[0,3]], minLbs: 2.0, maxLbs: 14.0, minIn: 12, maxIn: 30, pricePerLb: 850, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/redarowana.png", emoji: "<:redarowana:1405115248217821274>", variants: [ { name: "HQ Red Arowana", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/red_arowana_hq.gif", emoji: "<a:redarowana_hq:1405115263191486484>", rarity: "Legendary", weight: 0.5 }, { name: "Chroma Red Arowana", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/red_arowana_chroma.png", emoji: "<:redarowana_chroma:1405115254249361408>", rarity: "Mythic", weight: 0.2 } ] },
      // Turkey Fish global
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/turkeyfish_hq.gif", emoji: "<a:turkeyfish_hq:1404815553264222348>", rarity: "Epic", weight: 2 } ] },
      // Bosses
      { id: "bunyip", name: "Bunyip", rarity: "Mythic", weight: 0.2, timeWindows: [[0,24]], fixedPrice: 12000000, minLbs: 200.0, maxLbs: 900.0, minIn: 80, maxIn: 160, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/bunyip.png", emoji: "<:bunyip:1405115117250805760>", variants: [ { name: "HQ Bunyip", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/bunyip_hq.gif", emoji: "<a:bunyip_hq:1405115122707464205>", rarity: "Divine", weight: 0.1 } ] },
      { id: "jormungandr_new", name: "Jormungandr", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 25000000, minLbs: 300.0, maxLbs: 1200.0, minIn: 100, maxIn: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/jormungandr_new.png", emoji: "<:jormungandr_new:1405115207092535326>", variants: [ { name: "HQ Jormungandr", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/jormungandr_hq.gif", emoji: "<a:jomungandr_hq:1405115194363084841>", rarity: "Divine", weight: 0.05 }, { name: "Chroma Jormungandr", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/wily_river/jormungandr_chroma.png", emoji: "<:jormungandr_chroma:1405115200130121748>", rarity: "Divine", weight: 0.05 } ] },
    ] },


    // Saltwater
    { id: "scurvy_waters", waterType: "Saltwater", name: "Scurvy Waters", travelSeconds: 45, emoji: "<:scurvy_waters:1405117789584232500>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/scurvy_waters.png", lootTable: [
      { id: "bluetang", name: "Blue Tang", rarity: "Common", weight: 22, timeWindows: [[2,21]], fixedPrice: 4000, minLbs: 0.5, maxLbs: 3.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/bluetang.png", emoji: "<:bluetang:1405117902138638468>", variants: [ { name: "HQ Blue Tang", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/blue_tang_hq.gif", emoji: "<a:bluetang_hq:1405117909449048115>" } ] },
      { id: "butterflyfish", name: "Butterfly Fish", rarity: "Epic", weight: 2, timeWindows: [[4,21]], fixedPrice: 250000, minLbs: 1.0, maxLbs: 6.0, minIn: 10, maxIn: 20, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/butterflyfish.png", emoji: "<:butterflyfish:1405117916441219072>", variants: [ { name: "HQ Butterfly Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/butterfly_fish_hq.gif", emoji: "<a:butterflyfish_hq:1405117929183514705>" }, { name: "Chroma Butterfly Fish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/butterfly_fish_chroma.png", emoji: "<:butterflyfish_chroma:1405117922820620359>" } ] },
      { id: "jellyfish", name: "Jellyfish", rarity: "Common", weight: 20, timeWindows: [[22,24],[0,9]], fixedPrice: 5000, minLbs: 0.5, maxLbs: 3.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/jellyfish.png", emoji: "<:jellyfish:1405117934866792489>", variants: [ { name: "HQ Jellyfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/jellyfish_hq.gif", emoji: "<a:jellyfish_hq:1405117946522501143>" }, { name: "Chroma Jellyfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/jellyfish_chroma.png", emoji: "<:jellyfish_chroma:1405117940897943623>" } ] },
      { id: "kathzilla", name: "Kathzilla", rarity: "Epic", weight: 2, timeWindows: [[19,24],[0,6]], fixedPrice: 250000, minLbs: 5.0, maxLbs: 30.0, minIn: 20, maxIn: 50, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/kathzilla.png", emoji: "<:kathzilla:1405117954198077460>", variants: [ { name: "HQ Kathzilla", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/kathzilla_hq.gif", emoji: "<a:kathzilla_hq:1405117962913845348>" } ] },
      { id: "leafyseadragon", name: "Leafy Sea Dragon", rarity: "Epic", weight: 2, timeWindows: [[7,22]], fixedPrice: 250000, minLbs: 2.0, maxLbs: 10.0, minIn: 12, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/leafyseadragon.png", emoji: "<:leafyseadragon:1405117969310416906>", variants: [ { name: "HQ Leafy Sea Dragon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/leafy_sea_dragon_hq.gif", emoji: "<a:leafyseadragon_hq:1405117984397328466>" }, { name: "Chroma Leafy Sea Dragon", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/leafy_sea_dragon_chroma.png", emoji: "<:leafyseadragon_chroma:1405117976075567144>" } ] },
      { id: "lionfish", name: "Lionfish", rarity: "Rare", weight: 7, timeWindows: [[2,13]], fixedPrice: 10000, minLbs: 1.0, maxLbs: 6.0, minIn: 10, maxIn: 20, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/lionfish.png", emoji: "<:lionfish:1405117990654967919>", variants: [ { name: "HQ Lionfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/lionfish_hq.gif", emoji: "<a:lionfish_hq:1405117997223247972>" } ] },
      { id: "lusca", name: "Lusca", rarity: "Mythic", weight: 0.2, timeWindows: [[0,24]], fixedPrice: 12000000, minLbs: 300.0, maxLbs: 1200.0, minIn: 100, maxIn: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/lusca.png", emoji: "<:lusca:1405118003770560603>", variants: [ { name: "HQ Lusca", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/lusca_hq.gif", emoji: "<a:lusca_hq:1405118009340854383>" } ] },
      { id: "parrotfish", name: "Parrotfish", rarity: "Rare", weight: 7, timeWindows: [[16,24],[0,8]], fixedPrice: 20000, minLbs: 2.0, maxLbs: 15.0, minIn: 16, maxIn: 40, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/parrotfish.png", emoji: "<:parrotfish:1405118016240488448>", variants: [ { name: "HQ Parrotfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/parrotfish_hq.gif", emoji: "<a:parrotfish_hq:1405118029054083143>" }, { name: "Chroma Parrotfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/parrotfish_chroma.png", emoji: "<:parrotfish_chroma:1405118022020235375>" } ] },
      { id: "sailfish", name: "Sailfish", rarity: "Epic", weight: 2, timeWindows: [[7,18]], fixedPrice: 250000, minLbs: 50.0, maxLbs: 600.0, minIn: 80, maxIn: 140, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/sailfish.png", emoji: "<:sailfish:1405118036637257748>", variants: [ { name: "HQ Sailfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/sailfish_hq.gif", emoji: "<a:sailfish_hq:1405118048104616056>" } ] },
      { id: "starfish", name: "Starfish", rarity: "Common", weight: 18, timeWindows: [[4,15]], fixedPrice: 10000, minLbs: 0.2, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/starfish.png", emoji: "<:starfish:1405118057357246474>", variants: [ { name: "HQ Starfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/starfish_hq.gif", emoji: "<a:starfish_hq:1405118064806334546>" } ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/turkeyfish_hq.gif", emoji: "<a:turkeyfish_hq:1404815553264222348>", rarity: "Epic", weight: 2 } ] },
      { id: "wahoo", name: "Wahoo", rarity: "Rare", weight: 7, timeWindows: [[14,24],[0,1]], fixedPrice: 10000, minLbs: 3.0, maxLbs: 20.0, minIn: 18, maxIn: 42, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/wahoo.png", emoji: "<:wahoo:1405118079926796288>", variants: [ { name: "HQ Wahoo", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/scurvy_waters/wahoo_hq.gif", emoji: "<a:wahoo_hq:1405118086813712454>" } ] },
    ] },



    { id: "underwater_sanctuary", waterType: "Saltwater", name: "Underwater Sanctuary", travelSeconds: 60, emoji: "<:underwater_sanctuary:1405119961566937122>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/underwater_sanctuary.png", lootTable: [
      { id: "fish_squid", name: "Squid", rarity: "Epic", time: "night", weight: 8, minLbs: 2.0, maxLbs: 12.0, minIn: 12, maxIn: 30, pricePerLb: 280, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/fish_squid.png", emoji: "", variants: [] },
      { id: "fish_angler", name: "Anglerfish", rarity: "Mythic", time: "night", weight: 0.2, minLbs: 10.0, maxLbs: 60.0, minIn: 20, maxIn: 60, pricePerLb: 1200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/fish_angler.png", emoji: "", variants: [] },
      // From Ice Caves list
      { id: "coelacanth", name: "Coelacanth", rarity: "Epic", weight: 2, timeWindows: [[0,24]], fixedPrice: 250000, minLbs: 5.0, maxLbs: 40.0, minIn: 24, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/coelacanth.png", emoji: "<:coelacanth:1405121009295822948>", variants: [
        { name: "HQ Coelacanth", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/coelacanth_hq.gif", emoji: "<a:coelacanth_hq:1405121023409520651>" },
        { name: "Chroma Coelacanth", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/coelacanth_chroma.png", emoji: "<:coelacanth_chroma:1405121015826350120>" }
      ] },
      { id: "vampsquid", name: "Vampire Squid", rarity: "Rare", weight: 6, timeWindows: [[5,22]], fixedPrice: 20000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/vampsquid.png", emoji: "<:vamp_squid:1405121230821916682>", variants: [
        { name: "HQ Vampire Squid", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/vampire_squid_hq.gif", emoji: "<a:vampiresquid_hq:1405121261339803699>✨" },
        { name: "Chroma Vampire Squid", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/vampire_squid_chroma.png", emoji: "<:vampiresquid_chroma:1405121253605511299>" },
        { name: "Real Vampire", priceMultiplier: 3.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/vampire_squid_realvampire.png", emoji: "<:vampiresquid_realvampire:1405121268902006825>" }
      ] },
      // New/Updated per spec
      { id: "barracuda", name: "Barracuda", rarity: "Rare", weight: 6, timeWindows: [[22,24],[0,9]], fixedPrice: 7500, minLbs: 2.0, maxLbs: 15.0, minIn: 16, maxIn: 36, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/barracuda.png", emoji: "<:barracuda:1405120988051410975>", variants: [ { name: "HQ Barracuda", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/barracuda_hq.gif", emoji: "✨" } ] },
      { id: "cod", name: "Cod", rarity: "Common", weight: 25, timeWindows: [[10,21]], fixedPrice: 5000, minLbs: 2.0, maxLbs: 20.0, minIn: 12, maxIn: 36, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/cod.png", emoji: "", variants: [ { name: "HQ Cod", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/cod_hq.gif", emoji: "<a:barracuda_hq:1405120993571246161>" } ] },
      { id: "giantsquid", name: "Giant Squid", rarity: "Epic", weight: 1, timeWindows: [[16,24],[0,9]], fixedPrice: 250000, minLbs: 50.0, maxLbs: 600.0, minIn: 80, maxIn: 140, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/giantsquid.png", emoji: "<:giantsquid:1405121031273713664>", variants: [ { name: "HQ Giant Squid", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/giant_squid_hq.gif", emoji: "<a:giantsquid_hq:1405121051850969158>" }, { name: "Chroma Giant Squid", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/giant_squid_chroma.png", emoji: "<:giantsquid_chroma:1405121040920875028>" } ] },
      { id: "kraken_new", name: "Kraken", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 25000000, minLbs: 800.0, maxLbs: 4000.0, minIn: 160, maxIn: 260, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/kraken_new.png", emoji: "<:kraken_new:1405121077662842973>", variants: [ { name: "HQ Kraken", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/kraken_hq.gif", emoji: "<a:kraken_hq:1405121061334552597>" } ] },
      { id: "leviathan", name: "Leviathan", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 25000000, minLbs: 1000.0, maxLbs: 5000.0, minIn: 170, maxIn: 280, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/leviathan.png", emoji: "<:leviathan:1405121090824441958>", variants: [ { name: "HQ Leviathan", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/leviathan_hq.gif", emoji: "<a:leviathan_hq:1405121097942175887>" } ] },
      { id: "mahimahi", name: "Mahi Mahi", rarity: "Rare", weight: 7, timeWindows: [[10,24],[0,3]], fixedPrice: 20000, minLbs: 2.0, maxLbs: 15.0, minIn: 16, maxIn: 40, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/mahimahi.png", emoji: "<:mahimahi:1405121104846262312>", variants: [ { name: "HQ Mahi Mahi", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/mahi_mahi_hq.gif", emoji: "<a:mahimahi_hq:1405121122676117545>" }, { name: "Chroma Mahi Mahi", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/mahi_mahi_chroma.png", emoji: "<:mahimahi_chroma:1405121114950078551>" } ] },
      { id: "marlin", name: "Marlin", rarity: "Epic", weight: 2, timeWindows: [[4,21]], fixedPrice: 250000, minLbs: 50.0, maxLbs: 600.0, minIn: 80, maxIn: 140, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/marlin.png", emoji: "<:marlin:1405121130465071205>", variants: [ { name: "HQ Marlin", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/marlin_hq.gif", emoji: "<a:marlin_hq:1405121162010300468>" }, { name: "Chroma Marlin", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/marlin_chroma.png", emoji: "<:marlin_chroma:1405121152661327991>" } ] },
      { id: "fish_salmon_us", name: "Salmon", rarity: "Epic", weight: 5, timeWindows: [[16,24],[0,3]], fixedPrice: 10000, minLbs: 6.0, maxLbs: 18.0, minIn: 20, maxIn: 36, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/fish_salmon_us.png", emoji: "<:salmon:1405115269885726780>", variants: [ { name: "HQ Salmon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/salmon_hq.gif", emoji: "<a:salmon_hq:1405115276542083072>" } ] },
      { id: "sardine", name: "Sardine", rarity: "Common", weight: 25, timeWindows: [[4,21]], fixedPrice: 2500, minLbs: 0.2, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/sardine.png", emoji: "<:sardine:1405121180247003226>", variants: [ { name: "HQ Sardine", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/sardine_hq.gif", emoji: "<a:sardine_hq:1405121188396798084>" } ] },
      { id: "swordfish", name: "Swordfish", rarity: "Rare", weight: 5, timeWindows: [[16,24],[0,9]], fixedPrice: 20000, minLbs: 10.0, maxLbs: 80.0, minIn: 40, maxIn: 100, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/swordfish.png", emoji: "<:swordfish:1405121200656748585>"},
      { id: "tuna", name: "Tuna", rarity: "Rare", weight: 8, timeWindows: [[10,21]], fixedPrice: 10000, minLbs: 5.0, maxLbs: 80.0, minIn: 40, maxIn: 120, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/tuna.png", emoji: "<:tuna:1405121208844029972>", variants:  [ { name: "Chroma Tuna", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/tuna_chroma.png", emoji: "<:tuna_chroma:1405121217752731720>" } ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/underwater_sanctuary/turkeyfish_hq.gif", emoji: "<a:turkeyfish_hq:1404815553264222348>", rarity: "Epic", weight: 2 } ] },
    ] },



    { id: "vertigo_beach", waterType: "Saltwater", name: "Vertigo Beach", travelSeconds: 50, emoji: "<:vertigo_beach:1405124759045537862>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/vertigo_beach.png", lootTable: [
      { id: "fish_mackerel", name: "Mackerel", rarity: "Common", time: "day", weight: 50, minLbs: 1.0, maxLbs: 9.0, minIn: 12, maxIn: 30, pricePerLb: 120, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/fish_mackerel.png", emoji: "", variants: [] },
      { id: "fish_tuna", name: "Baby Tuna", rarity: "Rare", time: "day", weight: 20, minLbs: 5.0, maxLbs: 35.0, minIn: 20, maxIn: 50, pricePerLb: 180, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/fish_tuna.png", emoji: "<:tuna:1405121208844029972>", variants: [] },
      // From Ice Caves list
      { id: "jellyfish", name: "Jellyfish", rarity: "Common", weight: 20, timeWindows: [[22,24],[0,9]], fixedPrice: 5000, minLbs: 0.5, maxLbs: 3.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/jellyfish.png", emoji: "<:jellyfish:1405117934866792489>", variants: [
        { name: "HQ Jellyfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/jellyfish_hq.gif", emoji: "✨" },
        { name: "Chroma Jellyfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/jellyfish_chroma.png", emoji: "🌈" }
      ] },
      { id: "leafyseadragon", name: "Leafy Sea Dragon", rarity: "Epic", weight: 2, timeWindows: [[7,22]], fixedPrice: 250000, minLbs: 2.0, maxLbs: 10.0, minIn: 12, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/leafyseadragon.png", emoji: "<:leafyseadragon:1405117969310416906>", variants: [
        { name: "HQ Leafy Sea Dragon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/leafy_sea_dragon_hq.gif", emoji: "✨" },
        { name: "Chroma Leafy Sea Dragon", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/leafy_sea_dragon_chroma.png", emoji: "🌈" }
      ] },
      { id: "ocean_sunfish", name: "Ocean Sunfish", rarity: "Rare", weight: 5, timeWindows: [[0,18]], fixedPrice: 20000, minLbs: 5.0, maxLbs: 60.0, minIn: 24, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/ocean_sunfish.png", emoji: "<:ocean_sunfish:1405124618678833173>", variants: [
        { name: "HQ Ocean Sunfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/ocean_sunfish_hq.gif", emoji: "<a:ocean_sunfish_hq:1405124631794290718>" },
        { name: "Chroma Ocean Sunfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/ocean_sunfish_chroma.png", emoji: "<:ocean_sunfish_chroma:1405124624894791711>" }
      ] },
      // New per spec
      { id: "barracuda_flounder", name: "Barracuda (Flounder)", rarity: "Rare", weight: 6, timeWindows: [[10,24],[0,3]], fixedPrice: 20000, minLbs: 2.0, maxLbs: 12.0, minIn: 12, maxIn: 30, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/flounder.png", emoji: "<:flounder:1405124567437021255>", variants: [ { name: "HQ Flounder", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/flounder_hq.gif", emoji: "<a:flounder_hq:1405124578098806874>" } ] },
      { id: "butterflyfish", name: "Butterfly Fish", rarity: "Epic", weight: 2, timeWindows: [[4,21]], fixedPrice: 250000, minLbs: 1.0, maxLbs: 6.0, minIn: 10, maxIn: 20, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/butterflyfish.png", emoji: "<:butterflyfish:1405117916441219072>", variants: [ { name: "HQ Butterfly Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/butterfly_fish_hq.gif", emoji: "✨" }, { name: "Chroma Butterfly Fish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/butterfly_fish_chroma.png", emoji: "🌈" } ] },
      { id: "charybdis", name: "Charybdis", rarity: "Mythic", weight: 0.2, timeWindows: [[0,24]], fixedPrice: 12000000, minLbs: 300.0, maxLbs: 1200.0, minIn: 100, maxIn: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/charybdis.png", emoji: "<:charybdis:1405124549959483453>", variants: [ { name: "HQ Charybdis", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/charybdis_hq.gif", emoji: "<a:charybdis_hq:1405124559383957514>" } ] },
      { id: "cod", name: "Cod", rarity: "Common", weight: 25, timeWindows: [[10,21]], fixedPrice: 5000, minLbs: 2.0, maxLbs: 20.0, minIn: 12, maxIn: 36, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/cod.png", emoji: "", variants: [ { name: "HQ Cod", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/cod_hq.gif", emoji: "✨" } ] },
      { id: "hammerheadshark", name: "Hammerhead Shark", rarity: "Epic", weight: 1, timeWindows: [[16,24],[0,9]], fixedPrice: 250000, minLbs: 50.0, maxLbs: 500.0, minIn: 60, maxIn: 120, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/hammerheadshark.png", emoji: "<:hammerheadshark:1405124585598357554>", variants: [ { name: "HQ Hammerhead Shark", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/hammerhead_shark_hq.gif", emoji: "<a:hammerheadshark_hq:1405124593466871828>" } ] },
      { id: "pufferfish", name: "Pufferfish", rarity: "Rare", weight: 7, timeWindows: [[16,24],[0,9]], fixedPrice: 20000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/pufferfish.png", emoji: "<:pufferfish:1405124638207643708>", variants: [ { name: "HQ Pufferfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/pufferfish_hq.gif", emoji: "<a:pufferfish_hq:1405124667915894844>" }, { name: "Spineless Pufferfish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/pufferfish_spineless.png", emoji: "<:pufferfish_spineless:1405124674815262780>" }, { name: "Chroma Pufferfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/pufferfish_chroma.png", emoji: "<:pufferfish_chroma:1405124655588835328>" } ] },
      { id: "sardine", name: "Sardine", rarity: "Common", weight: 25, timeWindows: [[4,21]], fixedPrice: 2500, minLbs: 0.2, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/sardine.png", emoji: "<:sardine:1405121180247003226>", variants: [ { name: "HQ Sardine", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/sardine_hq.gif", emoji: "✨" } ] },
      { id: "shrimp", name: "Shrimp", rarity: "Common", weight: 20, timeWindows: [[22,24],[0,15]], fixedPrice: 4000, minLbs: 0.2, maxLbs: 1.0, minIn: 3, maxIn: 6, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/shrimp.png", emoji: "<:shrimp:1405124716615696427>", variants: [ { name: "HQ Shrimp", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/shrimp_hq.gif", emoji: "<a:shrimp_hq:1405124738660958321>" }, { name: "Chroma Shrimp", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/shrimp_chroma.png", emoji: "<:shrimp_chroma:1405124722575937566>" } ] },
      { id: "starfish", name: "Starfish", rarity: "Common", weight: 18, timeWindows: [[4,15]], fixedPrice: 10000, minLbs: 0.2, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/starfish.png", emoji: "<:starfish:1405118057357246474>", variants: [ { name: "HQ Starfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/starfish_hq.gif", emoji: "✨" } ] },
      { id: "scylla", name: "Scylla", rarity: "Mythic", weight: 0.2, timeWindows: [[0,24]], fixedPrice: 12000000, minLbs: 300.0, maxLbs: 1200.0, minIn: 100, maxIn: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/scylla.png", emoji: "<:scylla:1405124698387382312>", variants: [ { name: "HQ Scylla", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/vertigo_beach/scylla_hq.gif", emoji: "<a:scylla_hq:1405124708604579944>" } ] },
      // Turkey Fish global present elsewhere
    ] },


    // Special availability
    { id: "mystic_pond", waterType: "Freshwater", name: "Mystic Pond", travelSeconds: 25, days: [2,6], emoji: "<:mystic_pond:1405127416631922708>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/mystic_pond.png", lootTable: [ // Tue(2), Sat(6)
      // Updated list per request
      { id: "boxturtle", name: "Box Turtle", rarity: "Rare", weight: 6, timeWindows: [[22,24],[0,9]], fixedPrice: 10000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 14, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/boxturtle.png", emoji: "<:boxturtle:1405127354854150185>", variants: [ { name: "HQ Box Turtle", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/box_turtle_hq.gif", emoji: "<a:boxturtle_hq:1405127361397129267>" } ] },
      { id: "crayfish", name: "Crayfish", rarity: "Common", weight: 18, timeWindows: [[4,15]], fixedPrice: 5000, minLbs: 0.3, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/crayfish.png", emoji: "<:crayfish:1405115143448297583>", variants: [ { name: "HQ Crayfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/crayfish_hq.gif", emoji: "✨" } ] },
      { id: "flying_fish", name: "Flying Fish", rarity: "Rare", weight: 7, timeWindows: [[0,24]], fixedPrice: 20000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/flying_fish.png", emoji: "", variants: [ { name: "HQ Flying Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/flying_fish_hq.gif", emoji: "✨" }, { name: "Chroma Flying Fish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/flying_fish_chroma.png", emoji: "🌈" } ] },
      { id: "goldfish", name: "Goldfish", rarity: "Rare", weight: 6, timeWindows: [[16,24],[0,9]], fixedPrice: 10000, minLbs: 0.2, maxLbs: 1.5, minIn: 4, maxIn: 10, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/goldfish.png", emoji: "<:goldfish:1404815449866113104>", variants: [ { name: "HQ Goldfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/goldfish_hq.gif", emoji: "✨" }, { name: "Solid Goldfish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/goldfish_solid.png", emoji: "🥇" } ] },
      { id: "guppy", name: "Guppy", rarity: "Common", weight: 20, timeWindows: [[16,24],[0,3]], fixedPrice: 10000, minLbs: 0.1, maxLbs: 0.8, minIn: 3, maxIn: 8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/guppy.png", emoji: "<:guppy:1404815464844103771>", variants: [ { name: "HQ Guppy", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/guppy_hq.gif", emoji: "✨" }, { name: "Chroma Guppy", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/guppy_chroma.png", emoji: "🌈" } ] },
      { id: "koi", name: "Koi", rarity: "Epic", weight: 2, timeWindows: [[10,24],[0,3]], fixedPrice: 250000, minLbs: 2.0, maxLbs: 10.0, minIn: 12, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/koi.png", emoji: "<:koi:1404815484465053736>", variants: [ { name: "HQ Koi", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/koi_hq.gif", emoji: "✨" }, { name: "Black Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/koi_black.png", emoji: "⚫" }, { name: "Blue Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/koi_blue.png", emoji: "🔵" }, { name: "Yellow Koi", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/koi_yellow.png", emoji: "🟡" } ] },
      { id: "spectralfish", name: "Spectral Fish", rarity: "Epic", weight: 3, timeWindows: [[0,24]], fixedPrice: 250000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/spectralfish.png", emoji: "<:spectralfish:1405126671337787494>", variants: [ { name: "Blue Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/spectral_fish_blue.png", emoji: "<:spectral_blue:1405126655587909652>" }, { name: "Orange Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/spectral_fish_orange.png", emoji: "<:spectral_orange:1405126662982602843>" } ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/turkeyfish_hq.gif", emoji: "✨", rarity: "Epic", weight: 2 } ] },
      { id: "vodyanoy", name: "Vodyanoy", rarity: "Mythic", weight: 0.2, timeWindows: [[0,24]], fixedPrice: 12000000, minLbs: 200.0, maxLbs: 900.0, minIn: 80, maxIn: 160, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/vodyanoy.png", emoji: "<:vodyanoy:1405127398961446974>", variants: [ { name: "Vodyanoy", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/mystic_pond/vodyanoy_hq.gif", emoji: "<a:vodyanoy_hq:1405127406683029627>" } ] },
    ] },


    { id: "crypt_pond", waterType: "Freshwater", name: "Crypt Keeper's Pond", travelSeconds: 30, event: true, emoji: "<:crypt_pond:1405127670207090708>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/crypt_pond.png", lootTable: [
      // New crypt pond fishes
      { id: "electriceel", name: "Electric Eel", rarity: "Rare", weight: 10, timeWindows: [[4,21]], fixedPrice: 20000, minLbs: 3.0, maxLbs: 12.0, minIn: 20, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/electriceel.png", emoji: "<:electriceel:1405115156488519710>", variants: [
        { name: "HQ Electric Eel", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/eel_electric_hq.gif", emoji: "<a:electriceel_hq:1405115164159639563>" }
      ] },
      { id: "ghostfish", name: "Ghost Fish", rarity: "Rare", weight: 12, timeWindows: [[0,24]], fixedPrice: 20000, minLbs: 0.5, maxLbs: 3.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/ghostfish.png", emoji: "<a:ghostfish:1405127554268139530>", variants: [
        { name: "HQ Ghost Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/ghost_fish_hq.gif", emoji: "<a:ghostfish_hq:1405127563348803584>" },
        { name: "Ghost Fish (top edition)", priceMultiplier: 2.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/ghost_fish_topedition.png", emoji: "<a:ghostfish_topedition:1405127569707237438>" }
      ] },
      { id: "gorgolox", name: "Gorgolox", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 30000000, minLbs: 300.0, maxLbs: 900.0, minIn: 60, maxIn: 140, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/gorgolox.png", emoji: "<:gorgolox:1405127576481173584>", variants: [
        { name: "HQ Gorgolox", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/gorgolox_hq.gif", emoji: "<a:gorgolox_hq:1405127590850727936>" },
        { name: "Chroma Gorgolox", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/gorgolox_chroma.png", emoji: "<:gorgolox_chroma:1405127582843928678>" }
      ] },
      { id: "piranha", name: "Piranha", rarity: "Rare", weight: 12, timeWindows: [[16,24],[0,3]], fixedPrice: 10000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/piranha.png", emoji: "<:piranha:1405115214994608158>", variants: [
        { name: "HQ Piranha", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/piranha_hq.gif", emoji: "✨" },
        { name: "Chroma Piranha", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/piranha_chroma.png", emoji: "🌈" }
      ] },
      { id: "skeletonfish", name: "Skeleton Fish", rarity: "Rare", weight: 9, timeWindows: [[0,24]], fixedPrice: 10000, minLbs: 0.8, maxLbs: 4.0, minIn: 8, maxIn: 16, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/skeletonfish.png", emoji: "<:skeletonfish:1405127600602349618>", variants: [
        { name: "HQ Skeleton Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/skeleton_fish_hq.gif", emoji: "<a:skeletonfish_hq:1405127635616403476>" },
        { name: "Blue Skeleton Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/skeleton_fish_blue.png", emoji: "<:skeletonfish_blue:1405127612254392464>" },
        { name: "Red Skeleton Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/skeleton_fish_red.png", emoji: "<:skeletonfish_red:1405127618931462275>" }
      ] },
      { id: "spectralfish", name: "Spectral Fish", rarity: "Epic", weight: 3, timeWindows: [[0,24]], fixedPrice: 250000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/spectralfish.png", emoji: "<:spectralfish:1405126671337787494>", variants: [
        { name: "Blue Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/spectral_fish_blue.png", emoji: "💙" },
        { name: "Orange Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/spectral_fish_orange.png", emoji: "🧡" }
      ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [
        { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/turkeyfish_hq.gif", emoji: "✨" }
      ] },
      { id: "zombiefish", name: "Zombie Fish", rarity: "Rare", weight: 9, timeWindows: [[0,24]], fixedPrice: 10000, minLbs: 0.8, maxLbs: 5.0, minIn: 8, maxIn: 16, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/zombiefish.png", emoji: "<:zombiefish:1405127649508069447>", variants: [
        { name: "HQ Zombie Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/zombie_fish_hq.gif", emoji: "<a:zombiefish_hq:1405127662967455765>" },
        { name: "Chroma Zombie Fish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/crypt_pond/zombie_fish_chroma.png", emoji: "<:zombiefish_chroma:1405127656122486834>" }
      ] },
    ] },


    { id: "ice_caves", waterType: "Freshwater", name: "Ice Caves", travelSeconds: 40, event: true, emoji: "<:Ice_caves:1405127454103961660>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/ice_caves.png", lootTable: [
      // From table (Ice Caves)
      { id: "arcticchar", name: "Arctic Char", rarity: "Common", weight: 20, timeWindows: [[0,24]], fixedPrice: 5000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/arcticchar.png", emoji: "<:arcticchar:1405126570737143909>", variants: [ { name: "HQ Arctic Char", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/arcticchar_hq.gif", emoji: "✨" } ] },
      { id: "belugawhale", name: "Beluga Whale", rarity: "Rare", weight: 3, timeWindows: [[0,24]], fixedPrice: 20000, minLbs: 500.0, maxLbs: 3500.0, minIn: 100, maxIn: 200, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/belugawhale.png", emoji: "<:belugawhale:1405127438937227304>", variants: [ { name: "HQ Beluga Whale", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/beluga_whale_hq.gif", emoji: "<a:belugawhale_hq:1405127445828341760>" } ] },
      { id: "coelacanth", name: "Coelacanth", rarity: "Epic", weight: 2, timeWindows: [[0,24]], fixedPrice: 250000, minLbs: 5.0, maxLbs: 40.0, minIn: 24, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/coelacanth.png", emoji: "", variants: [
        { name: "HQ Coelacanth", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/coelacanth_hq.gif", emoji: "✨" },
        { name: "Chroma Coelacanth", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/coelacanth_chroma.png", emoji: "🌈" }
      ] },
      { id: "jellyfish", name: "Jellyfish", rarity: "Common", weight: 20, timeWindows: [[22,24],[0,9]], fixedPrice: 5000, minLbs: 0.5, maxLbs: 3.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/jellyfish.png", emoji: "<:jellyfish:1405117934866792489>", variants: [ { name: "HQ Jellyfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/jellyfish_hq.gif", emoji: "✨" }, { name: "Chroma Jellyfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/jellyfish_chroma.png", emoji: "🌈" } ] },
      { id: "leafyseadragon", name: "Leafy Sea Dragon", rarity: "Epic", weight: 2, timeWindows: [[7,22]], fixedPrice: 250000, minLbs: 2.0, maxLbs: 10.0, minIn: 12, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/leafyseadragon.png", emoji: "<:leafyseadragon:1405117969310416906>", variants: [ { name: "HQ Leafy Sea Dragon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/leafy_sea_dragon_hq.gif", emoji: "✨" }, { name: "Chroma Leafy Sea Dragon", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/leafy_sea_dragon_chroma.png", emoji: "🌈" } ] },
      { id: "narwhal", name: "Narwhal", rarity: "Rare", weight: 3, timeWindows: [[0,24]], fixedPrice: 20000, minLbs: 800.0, maxLbs: 3500.0, minIn: 120, maxIn: 220, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/narwhal.png", emoji: "<:narwhal:1405127468553212015>", variants: [ { name: "HQ Narwhal", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/narwhal_hq.gif", emoji: "<a:narwhal_hq:1405127481740234822>" }, { name: "Chroma Narwhal", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/narwhal_chroma.png", emoji: "<:narwhal_chroma:1405127475716948109>" } ] },
      { id: "ocean_sunfish", name: "Ocean Sunfish", rarity: "Rare", weight: 5, timeWindows: [[0,18]], fixedPrice: 20000, minLbs: 5.0, maxLbs: 60.0, minIn: 24, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/ocean_sunfish.png", emoji: "<:ocean_sunfish:1405124618678833173>", variants: [ { name: "HQ Ocean Sunfish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/ocean_sunfish_hq.gif", emoji: "✨" }, { name: "Chroma Ocean Sunfish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/ocean_sunfish_chroma.png", emoji: "🌈" } ] },
      { id: "pliosaur", name: "Pliosaur", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 30000000, minLbs: 500.0, maxLbs: 5000.0, minIn: 150, maxIn: 300, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/pliosaur.png", emoji: "<:pliosaur:1405127489939968031>", variants: [ { name: "HQ Pliosaur", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/pliosaur_hq.gif", emoji: "<a:pliosaur_hq:1405127497305034882>" } ] },
      { id: "sturgeon", name: "Sturgeon", rarity: "Rare", weight: 8, timeWindows: [[0,16]], fixedPrice: 20000, minLbs: 5.0, maxLbs: 40.0, minIn: 24, maxIn: 60, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/sturgeon.png", emoji: "<:sturgeon:1405115283961811056>", variants: [ { name: "HQ Sturgeon", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/sturgeon_hq.gif", emoji: "✨", rarity: "Epic", weight: 2 }, { name: "Chroma Sturgeon", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/sturgeon_chroma.png", emoji: "🌈", rarity: "Legendary", weight: 0.5 } ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/turkeyfish_hq.gif", emoji: "✨" } ] },
      { id: "vampsquid", name: "Vampire Squid", rarity: "Rare", weight: 6, timeWindows: [[5,22]], fixedPrice: 20000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/vampsquid.png", emoji: "<:vamp_squid:1405121230821916682>", variants: [ { name: "HQ Vampire Squid", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/vampire_squid_hq.gif", emoji: "✨" }, { name: "Chroma Vampire Squid", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/vampire_squid_chroma.png", emoji: "🌈" }, { name: "Real Vampire", priceMultiplier: 3.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/ice_caves/vampire_squid_realvampire.png", emoji: "🧛" } ] },
    ] },



    { id: "snowy_mountain", waterType: "Freshwater", name: "Snowy Mountain", travelSeconds: 45, event: true, emoji: "<:snowy_mountain:1405126680049094820>", thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/snowy_mountain.png", lootTable: [
      { id: "fish_trout", name: "River Trout", rarity: "Common", time: "day", weight: 55, minLbs: 0.5, maxLbs: 6.5, minIn: 10, maxIn: 26, pricePerLb: 120, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/fish_trout.png", emoji: "", variants: [] },
      // Add Spectral Fish here as requested
      { id: "spectralfish", name: "Spectral Fish", rarity: "Epic", weight: 3, timeWindows: [[0,24]], fixedPrice: 250000, minLbs: 1.0, maxLbs: 6.0, minIn: 8, maxIn: 18, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/spectral_fish.png", emoji: "<:spectralfish:1405126671337787494>", variants: [ { name: "Blue Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/spectral_fish_blue.png", emoji: "💙" }, { name: "Orange Spectral Fish", priceMultiplier: 1.8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/spectral_fish_orange.png", emoji: "🧡" } ] },
      // From Ice Caves list
      { id: "arcticchar", name: "Arctic Char", rarity: "Common", weight: 20, timeWindows: [[0,24]], fixedPrice: 5000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 28, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/arcticchar.png", emoji: "<:arcticchar:1405126570737143909>", variants: [ { name: "HQ Arctic Char", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/arcticchar_hq.gif", emoji: "<a:arcticchar_hq:1405126579117494333>" } ] },
      // From Mystic Pond list
      { id: "flying_fish", name: "Flying Fish", rarity: "Rare", weight: 7, timeWindows: [[0,24]], fixedPrice: 20000, minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/flying_fish.png", emoji: "", variants: [ { name: "HQ Flying Fish", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/flying_fish_hq.gif", emoji: "✨" }, { name: "Chroma Flying Fish", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/flying_fish_chroma.png", emoji: "🌈" } ] },
      // From Wily River list (Arapaima)
      { id: "arapaima", name: "Arapaima", rarity: "Epic", weight: 3, timeWindows: [[0,6]], fixedPrice: 250000, minLbs: 30.0, maxLbs: 200.0, minIn: 30, maxIn: 80, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/arapaima.png", emoji: "<:arapaima:1405115104273371218>", variants: [ { name: "HQ Arapaima", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/arapaima_hq.gif", emoji: "✨", rarity: "Legendary", weight: 0.5 } ] },
      // New per spec
      { id: "bluegill_sm", name: "Bluegill", rarity: "Common", weight: 22, timeWindows: [[4,15]], fixedPrice: 5000, minLbs: 0.3, maxLbs: 2.0, minIn: 6, maxIn: 12, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/bluegill.png", emoji: "<:bluegill:1404815391787843614>", variants: [ { name: "HQ Bluegill", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/bluegill_sm_hq.gif", emoji: "✨" }, { name: "Chroma Bluegill", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/bluegill_sm_chroma.png", emoji: "🌈" } ] },
      { id: "guppy_sm", name: "Guppy", rarity: "Common", weight: 20, timeWindows: [[16,24],[0,3]], fixedPrice: 10000, minLbs: 0.1, maxLbs: 0.8, minIn: 3, maxIn: 8, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/guppy.png", emoji: "<:guppy:1404815464844103771>", variants: [ { name: "HQ Guppy", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/guppy_sm_hq.gif", emoji: "✨" }, { name: "Chroma Guppy", priceMultiplier: 2.0, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/guppy_sm_chroma.png", emoji: "🌈" } ] },
      { id: "nelma", name: "Nelma", rarity: "Rare", weight: 6, timeWindows: [[4,15]], fixedPrice: 10000, minLbs: 3.0, maxLbs: 20.0, minIn: 20, maxIn: 50, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/nelma.png", emoji: "<:nelma:1405126641226743828>", variants: [ { name: "HQ Nelma", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/nelma_hq.gif", emoji: "<a:nelma_hq:1405126648311054368>" } ] },
      { id: "issrakr", name: "Issrakr", rarity: "Divine", weight: 0.1, timeWindows: [[0,24]], fixedPrice: 30000000, minLbs: 500.0, maxLbs: 5000.0, minIn: 150, maxIn: 300, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/issrakr.png", emoji: "<:issrakr:1405126624793464884>", variants: [ { name: "Issrakr", priceMultiplier: 1.2, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/issrakr_hq.gif", emoji: "<a:issrakr_hq:1405126631055691849>" } ] },
      { id: "turkeyfish", name: "Turkey Fish", rarity: "Rare", weight: 5, timeWindows: [[0,24]], fixedPrice: 10000, requiresBait: "bait_turkey", minLbs: 1.0, maxLbs: 8.0, minIn: 10, maxIn: 24, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/turkeyfish.png", emoji: "<:turkeyfish:1404815544900780042>", variants: [ { name: "HQ Tuna", priceMultiplier: 1.5, thumbnail: "https://cdn.kitsxkorn.xyz/fish/snowy_mountain/turkeyfish_hq.gif", emoji: "✨" } ] },
    ] },
  ]
}; 
