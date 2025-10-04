const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const Canvas = require("@napi-rs/canvas");

// Dependencies
const GProfile = require("../../settings/models/profile.js");
const GInv = require("../../settings/models/inventory.js");

// Cooldown system
const shopCooldowns = new Map();
const SHOP_COOLDOWN = 1 * 60 * 1000; // 1 minute cooldown

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = shopCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < SHOP_COOLDOWN) {
        const remaining = Math.ceil((SHOP_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

// Food items for pets
const PET_FOODS = [
    {
        id: "basic_food",
        name: "อาหารเม็ดคุณภาพเเย่",
        price: 300,
        type: "food",
        feed: 1,
        exp: 2,
        emoji: "🍖"
    },
    {
        id: "premium_food",
        name: "อาหารเม็ดคุณภาพดี",
        price: 500,
        type: "food",
        feed: 2,
        exp: 5,
        emoji: "🥩"
    },
    {
        id: "deluxe_food",
        name: "ทาโก้",
        price: 700,
        type: "food",
        feed: 5,
        exp: 10,
        emoji: "🌮"
    },
	{
        id: "mega_food",
        name: "ขนมโดนัท",
        price: 1250,
        type: "food",
        feed: 10,
        exp: 20,
        emoji: "🍩"
    }
];

// Cleaning items for poop
const CLEANING_ITEMS = [
    {
        id: "trash_bag_1",
        name: "ถุงขยะ (1 ชิ้น)",
        price: 100,
        type: "cleaning",
        capacity: 10,
        quantity: 1,
        emoji: "🗑️",
        description: "ถุงขยะ 1 ชิ้น เก็บขี้ได้ 10 ก้อน"
    },
    {
        id: "trash_bag_5",
        name: "ถุงขยะ (5 ชิ้น)",
        price: 450,
        type: "cleaning",
        capacity: 10,
        quantity: 5,
        emoji: "🗑️",
        description: "ถุงขยะ 5 ชิ้น เก็บขี้ได้ 50 ก้อน (ประหยัด 50 บาท)"
    },
    {
        id: "trash_bag_10",
        name: "ถุงขยะ (10 ชิ้น)",
        price: 850,
        type: "cleaning",
        capacity: 10,
        quantity: 10,
        emoji: "🗑️",
        description: "ถุงขยะ 10 ชิ้น เก็บขี้ได้ 100 ก้อน (ประหยัด 150 บาท)"
    }
];



// แสดงได้สูงสุด 6 รายการต่อหน้า
const PAGE_SIZE = 6;

module.exports = {
	name: ["ร้านค้า"],
	description: "ร้านค้าขายอาหารสัตว์เลี้ยงเเละที่ทำความสะอาด",
	category: "Shop",
	run: async (client, interaction) => {
		await interaction.deferReply();

		// ตรวจสอบ cooldown
		const cooldownRemaining = checkCooldown(interaction.user.id);
		if (cooldownRemaining > 0) {
			return interaction.editReply({ content: `⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะเปิดร้านได้อีกครั้ง` });
		}

		const msg = await interaction.editReply({ content: "Loading shop..." });

		// เปิดเมนูเลือกประเภทร้าน
		await openShopMenu(client, interaction, msg);
	}
}








async function openShopMenu(client, interaction, msg) {
	try {
		const embed = new EmbedBuilder()
			.setColor(client.color)
			.setTitle("🛒 Shop Menu")
			.setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/shop.gif")
			.setDescription("เลือกประเภทสินค้าที่ต้องการซื้อ");

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('shop_category_select')
			.setPlaceholder('เลือกประเภทร้านค้า')
			.setMinValues(1)
			.setMaxValues(1)
			.setOptions([
				{
					label: '🍖 อาหารสัตว์เลี้ยง',
					description: 'ซื้ออาหารสัตว์เลี้ยง',
					value: 'food'
				},
				{
					label: '🗑️ ถุงขยะ',
					description: 'ซื้อถุงขยะสำหรับเก็บขี้',
					value: 'cleaning'
				}
			]);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		let actualMsg = msg;
		try {
			await msg.edit({ embeds: [embed], components: [row] });
		} catch (error) {
			if (error.code === 10008) {
				// Message no longer exists, try to send a new one
				actualMsg = await interaction.followUp({ embeds: [embed], components: [row] });
			} else {
				throw error;
			}
		}

		const filter = (m) => m.user.id === interaction.user.id;
		const collector = actualMsg.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

		collector.on('collect', async (selectMenu) => {
			try {
				await selectMenu.deferUpdate();
				const [selectedCategory] = selectMenu.values;
				
				// Validate that the message still exists before proceeding
				try {
					await actualMsg.fetch();
				} catch (fetchError) {
					if (fetchError.code === 10008) {
						console.error("Message no longer exists when opening shop, sending new message");
						// Send a new message and open the shop there
						const newMsg = await interaction.followUp({ 
							content: "กำลังเปิดร้านค้า..." 
						});
						
						if (selectedCategory === 'food') {
							await openFoodShop(client, interaction, newMsg);
						} else if (selectedCategory === 'cleaning') {
							await openCleaningShop(client, interaction, newMsg);
						}
						collector.stop();
						return;
					}
					throw fetchError;
				}
				
				if (selectedCategory === 'food') {
					await openFoodShop(client, interaction, actualMsg);
				} else if (selectedCategory === 'cleaning') {
					await openCleaningShop(client, interaction, actualMsg);
				}
				collector.stop();
			} catch (error) {
				console.error("Error in select menu collect:", error);
				try {
					await selectMenu.followUp({ content: "เกิดข้อผิดพลาดในการประมวลผลคำสั่ง" });
				} catch (followUpError) {
					console.error("Error sending follow-up:", followUpError);
				}
			}
	});

		collector.on('end', async (collected, reason) => {
		if (reason === 'time') {
			try {
				const timed = new EmbedBuilder()
					.setColor(client.color)
					.setDescription("เวลาหมดแล้ว");
				await actualMsg.edit({ embeds: [timed], components: [] });
			} catch (error) {
				if (error.code !== 10008) {
					console.error("Error editing message on timeout:", error);
				}
			}
		}
	});
	} catch (e) {
		console.error("openShopMenu error:", e);
		try { 
			await actualMsg.edit({ content: "เกิดข้อผิดพลาด", components: [], files: [] }); 
		} catch (error) {
			if (error.code !== 10008) {
				console.error("Error editing message in openShopMenu:", error);
			}
		}
	}
}

async function openCleaningShop(client, interaction, msg) {
	try {
		// Validate message exists before proceeding
		try {
			await msg.fetch();
		} catch (fetchError) {
			if (fetchError.code === 10008) {
				console.error("Message no longer exists in openCleaningShop, cannot proceed");
				return;
			}
			throw fetchError;
		}

		const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
		const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

		const options = CLEANING_ITEMS;
		let page = 0; 
		const totalPages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));

		function buildCleaningMenuSlice() {
			const slice = options.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
			let menu = new StringSelectMenuBuilder()
				.setCustomId("shop_cleaning_unified")
				.setPlaceholder("เลือกถุงขยะ")
				.setMinValues(1).setMaxValues(1);

			if (slice.length === 0) {
				menu = menu.setDisabled(true).addOptions(new StringSelectMenuOptionBuilder().setLabel('ไม่มีสินค้า').setValue('none').setDescription('—'));
			} else {
				menu = menu.setOptions(slice.map(item => new StringSelectMenuOptionBuilder()
					.setLabel(`${item.emoji} ${item.name} | ${Commas(item.price)} บาท`)
					.setValue(item.id)
					.setDescription(item.description)));
			}
			return menu;
		}

		const canvas = Canvas.createCanvas(450, 300);
		const ctx = canvas.getContext("2d");
		try { const bg = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/shop/trash_bag-shop.png"); ctx.drawImage(bg, 0, 0, canvas.width, canvas.height); }
		catch(_) { ctx.fillStyle = "#0b1020"; ctx.fillRect(0,0,450,300); }
		const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `cleaning_select.png` });
		const embed = new EmbedBuilder().setImage("attachment://cleaning_select.png").setColor(client.color).setTitle("🗑️ ร้านขายถุงขยะ");

		const filter = (m) => m.user.id === interaction.user.id;
		const collector = msg.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

		async function renderCleaningPage() {
			const rowMenu = new ActionRowBuilder().addComponents(buildCleaningMenuSlice());
			const rowPage = buildPaginationRow(page, totalPages, 'cleaning_shop');
			try {
				await msg.edit({ content: " ", embeds: [embed], components: [rowMenu, rowPage], files: [attc] });
			} catch (error) {
				if (error.code === 10008) {
					console.error("Message no longer exists in renderCleaningPage, stopping collector");
					collector.stop();
					return;
				}
				throw error;
			}
		}
		await renderCleaningPage();
		const nonOwnerCollector = msg.createMessageComponentCollector({ filter: (x) => x.user.id !== interaction.user.id, time: 5 * 60 * 1000 });
		nonOwnerCollector.on('collect', async (menu) => { try { await menu.reply({ content: "เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น", flags: MessageFlags.Ephemeral }); } catch {} });

		collector.on('collect', async (menu) => {
			try {
				if (menu.isButton() && menu.customId.startsWith('cleaning_shop_')) {
					await safeDeferUpdate(menu);
					if (menu.customId.endsWith('_first')) page = 0;
					if (menu.customId.endsWith('_prev')) page = Math.max(0, page - 1);
					if (menu.customId.endsWith('_next')) page = Math.min(totalPages - 1, page + 1);
					if (menu.customId.endsWith('_last')) page = totalPages - 1;
					await renderCleaningPage();
					return;
				}
				if (!menu.isStringSelectMenu()) return;
				if (menu.customId !== 'shop_cleaning_unified') return;
				await safeDeferUpdate(menu);
				const [itemId] = menu.values;
				const item = CLEANING_ITEMS.find(x => x.id === itemId);
				if (!item) return;
				if ((profile?.money || 0) < item.price) { 
					return menu.followUp({ content: `ยอดยอดเงินไม่พอ ราคา: ${item.price}`,  }); 
				}
				
				profile.money -= item.price;
				
				// สร้างถุงขยะตามจำนวนที่ซื้อ
				for (let i = 0; i < item.quantity; i++) {
					inv.item.push({
						id: generateID(),
						name: `Trash Bag`,
						type: item.type,
						capacity: item.capacity,
						used: 0,
						emoji: item.emoji
					});
				}
				
				await profile.save(); 
				await inv.save();
				
				// อัปเดต cooldown
				shopCooldowns.set(interaction.user.id, Date.now());
				
				const done = new EmbedBuilder()
					.setColor(client.color)
					.setDescription(`ซื้อ ${item.emoji} ${item.name} สำเร็จ!\n\n📦 ได้รับถุงขยะ ${item.quantity} ชิ้น (ความจุ ${item.capacity} ก้อนต่อชิ้น)\n💡 ใช้ \`/เก็บขี้\` เพื่อใช้ถุงขยะทำความสะอาดขี้ของสัตว์เลี้ยง`);
				try {
					await msg.edit({ embeds: [done], components: [], files: [] });
				} catch (error) {
					if (error.code !== 10008) {
						console.error("Error editing message after purchase:", error);
					}
				}
				collector.stop();
				try { nonOwnerCollector.stop(); } catch {}
			} catch (e) { console.error("cleaning item buy error:", e); }
		});

		collector.on('end', async (collected, reason) => {
			if (reason === 'time') { 
				try { 
					const timed = new EmbedBuilder().setColor(client.color).setDescription("หมดเวลาช้อปแล้ว"); 
					await msg.edit({ embeds: [timed], components: [], files: [] }); 
				} catch (error) {
					if (error.code !== 10008) {
						console.error("Error editing message on cleaning shop timeout:", error);
					}
				} 
			}
			try { nonOwnerCollector.stop(); } catch {}
		});
	} catch (e) {
		console.error("openCleaningShop error:", e);
		try { 
			await msg.edit({ content: "เกิดข้อผิดพลาด", components: [], files: [] }); 
		} catch (error) {
			if (error.code !== 10008) {
				console.error("Error editing message in openCleaningShop:", error);
			}
		}
	}
}

async function openFoodShop(client, interaction, msg) {
	try {
		// Validate message exists before proceeding
		try {
			await msg.fetch();
		} catch (fetchError) {
			if (fetchError.code === 10008) {
				console.error("Message no longer exists in openFoodShop, cannot proceed");
				return;
			}
			throw fetchError;
		}

		const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
		const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

		const options = PET_FOODS;
		let page = 0; 
		const totalPages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));

		function buildFoodMenuSlice() {
			const slice = options.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
			let menu = new StringSelectMenuBuilder()
				.setCustomId("shop_food_unified")
				.setPlaceholder("เลือกอาหารสัตว์เลี้ยง")
				.setMinValues(1).setMaxValues(1);

			if (slice.length === 0) {
				menu = menu.setDisabled(true).addOptions(new StringSelectMenuOptionBuilder().setLabel('ไม่มีสินค้า').setValue('none').setDescription('—'));
			} else {
				menu = menu.setOptions(slice.map(food => new StringSelectMenuOptionBuilder()
					.setLabel(`${food.emoji} ${food.name} | ${Commas(food.price)} บาท`)
					.setValue(food.id)
					.setDescription(`เพิ่มความอิ่ม: +${food.feed} | EXP: +${food.exp}`)));
			}
			return menu;
		}

		const canvas = Canvas.createCanvas(450, 300);
		const ctx = canvas.getContext("2d");
		try { const bg = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/shop/food-shop.png"); ctx.drawImage(bg, 0, 0, canvas.width, canvas.height); }
		catch(_) { ctx.fillStyle = "#0b1020"; ctx.fillRect(0,0,450,300); }
		const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `food_select.png` });
		const embed = new EmbedBuilder().setImage("attachment://food_select.png").setColor(client.color).setTitle("🍖 ร้านขายอาหารสัตว์เลี้ยง");

		const filter = (m) => m.user.id === interaction.user.id;
		const collector = msg.createMessageComponentCollector({ filter, time: 5 * 60 * 1000 });

		async function renderFoodPage() {
			const rowMenu = new ActionRowBuilder().addComponents(buildFoodMenuSlice());
			const rowPage = buildPaginationRow(page, totalPages, 'food_shop');
			try {
				await msg.edit({ content: " ", embeds: [embed], components: [rowMenu, rowPage], files: [attc] });
			} catch (error) {
				if (error.code === 10008) {
					console.error("Message no longer exists in renderFoodPage, stopping collector");
					collector.stop();
					return;
				}
				throw error;
			}
		}
		await renderFoodPage();
		const nonOwnerCollector = msg.createMessageComponentCollector({ filter: (x) => x.user.id !== interaction.user.id, time: 5 * 60 * 1000 });
		nonOwnerCollector.on('collect', async (menu) => { try { await menu.reply({ content: "เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น", flags: MessageFlags.Ephemeral }); } catch {} });

		collector.on('collect', async (menu) => {
			try {
				if (menu.isButton() && menu.customId.startsWith('food_shop_')) {
					await safeDeferUpdate(menu);
					if (menu.customId.endsWith('_first')) page = 0;
					if (menu.customId.endsWith('_prev')) page = Math.max(0, page - 1);
					if (menu.customId.endsWith('_next')) page = Math.min(totalPages - 1, page + 1);
					if (menu.customId.endsWith('_last')) page = totalPages - 1;
					await renderFoodPage();
					return;
				}
				if (!menu.isStringSelectMenu()) return;
				if (menu.customId !== 'shop_food_unified') return;
				await safeDeferUpdate(menu);
				const [foodId] = menu.values;
				const food = PET_FOODS.find(x => x.id === foodId);
				if (!food) return;
				if ((profile?.money || 0) < food.price) { 
					return menu.followUp({ content: `ยอดเงินไม่พอ ราคา: ${food.price}`,  }); 
				}
				
				profile.money -= food.price;
				inv.item.push({
					id: generateID(),
					name: food.name,
					type: food.type,
					feed: food.feed,
					exp: food.exp,
					emoji: food.emoji
				});
				
				await profile.save(); 
				await inv.save();
				
				// อัปเดต cooldown
				shopCooldowns.set(interaction.user.id, Date.now());
				
				const done = new EmbedBuilder()
					.setColor(client.color)
					.setDescription(`ซื้อ ${food.emoji} ${food.name} สำเร็จ!`);
				try {
					await msg.edit({ embeds: [done], components: [], files: [] });
				} catch (error) {
					if (error.code !== 10008) {
						console.error("Error editing message after food purchase:", error);
					}
				}
				collector.stop();
				try { nonOwnerCollector.stop(); } catch {}
			} catch (e) { console.error("food buy error:", e); }
		});

		collector.on('end', async (collected, reason) => {
			if (reason === 'time') { 
				try { 
					const timed = new EmbedBuilder().setColor(client.color).setDescription("หมดเวลาช้อปเเล้ว"); 
					await msg.edit({ embeds: [timed], components: [], files: [] }); 
				} catch (error) {
					if (error.code !== 10008) {
						console.error("Error editing message on food shop timeout:", error);
					}
				} 
			}
			try { nonOwnerCollector.stop(); } catch {}
		});
	} catch (e) {
		console.error("openFoodShop error:", e);
		try { 
			await msg.edit({ content: "เกิดข้อผิดพลาด", components: [], files: [] }); 
		} catch (error) {
			if (error.code !== 10008) {
				console.error("Error editing message in openFoodShop:", error);
			}
		}
	}
}

function buildPaginationRow(page, totalPages, baseId) {
	const first = new ButtonBuilder().setCustomId(`${baseId}_first`).setLabel('⏮').setStyle(ButtonStyle.Primary).setDisabled(page <= 0);
	const prev = new ButtonBuilder().setCustomId(`${baseId}_prev`).setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page <= 0);
	const label = new ButtonBuilder().setCustomId(`${baseId}_label`).setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true);
	const next = new ButtonBuilder().setCustomId(`${baseId}_next`).setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1);
	const last = new ButtonBuilder().setCustomId(`${baseId}_last`).setLabel('⏭').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1);
	return new ActionRowBuilder().addComponents(first, prev, label, next, last);
}

function Commas(x) { return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
const crypto = require('crypto');
function generateID() { return crypto.randomBytes(16).toString('base64'); }

async function safeDeferUpdate(i) {
	try {
		if (!i.deferred && !i.replied) {
			await i.deferUpdate();
		}
	} catch (_) { /* ignore Unknown interaction */ }
} 