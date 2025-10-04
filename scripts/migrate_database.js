const mongoose = require('mongoose');

// Import โมเดลเก่าและใหม่
const OldHouseModel = require('../settings/models/house.js');
const OldInventoryModel = require('../settings/models/inventory.js');
const NewHouseModel = require('../settings/models/house_optimized.js');
const NewInventoryModel = require('../settings/models/inventory_optimized.js');

class DatabaseMigrator {
    constructor() {
        this.migrationStats = {
            houses: { total: 0, migrated: 0, errors: 0 },
            inventories: { total: 0, migrated: 0, errors: 0 }
        };
    }

    async migrateHouses() {
        console.log('🏠 Starting House migration...');
        
        try {
            const oldHouses = await OldHouseModel.find({});
            this.migrationStats.houses.total = oldHouses.length;
            
            for (const oldHouse of oldHouses) {
                try {
                    const newHouseData = this.convertHouseStructure(oldHouse);
                    
                    await NewHouseModel.findOneAndUpdate(
                        { guild: oldHouse.guild, user: oldHouse.user },
                        newHouseData,
                        { upsert: true, new: true }
                    );
                    
                    this.migrationStats.houses.migrated++;
                    console.log(`✅ Migrated house for ${oldHouse.user} in ${oldHouse.guild}`);
                    
                } catch (error) {
                    this.migrationStats.houses.errors++;
                    console.error(`❌ Error migrating house ${oldHouse._id}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('❌ House migration failed:', error);
        }
    }

    convertHouseStructure(oldHouse) {
        const newHouse = {
            guild: oldHouse.guild,
            user: oldHouse.user,
            furniture: new Map(),
            wallpaper: {
                left: new Map(),
                right: new Map()
            },
            floor: {
                placed: false
            },
            layout: {
                grid: Array(4).fill().map(() => Array(4).fill(null)),
                maxSlots: 16
            }
        };

        // แปลง Furniture
        if (oldHouse.A_DATA) {
            this.migrateFurnitureGroup(oldHouse.A_DATA, 'A', newHouse);
        }
        if (oldHouse.B_DATA) {
            this.migrateFurnitureGroup(oldHouse.B_DATA, 'B', newHouse);
        }
        if (oldHouse.C_DATA) {
            this.migrateFurnitureGroup(oldHouse.C_DATA, 'C', newHouse);
        }
        if (oldHouse.D_DATA) {
            this.migrateFurnitureGroup(oldHouse.D_DATA, 'D', newHouse);
        }

        // แปลง Wallpaper
        if (oldHouse.WALL_DATA) {
            this.migrateWallpaper(oldHouse.WALL_DATA, newHouse);
        }

        // แปลง Floor
        if (oldHouse.FLOOR_DATA && oldHouse.FLOOR_DATA.FLOOR) {
            newHouse.floor = {
                itemName: oldHouse.FLOOR_DATA.FLOORI,
                placed: true
            };
        }

        return newHouse;
    }

    migrateFurnitureGroup(groupData, groupLetter, newHouse) {
        const positions = ['1', '2', '3', '4'];
        
        positions.forEach(pos => {
            const key = `${groupLetter}${pos}`;
            const placed = groupData[`${groupLetter}${pos}`];
            const itemName = groupData[`${groupLetter}${pos}I`];
            
            if (placed && itemName) {
                newHouse.furniture.set(key, {
                    itemName: itemName,
                    area: 1, // ค่าเริ่มต้น, อาจต้องปรับตาม item
                    placed: true
                });
                
                // อัพเดท grid
                const row = groupLetter.charCodeAt(0) - 65;
                const col = parseInt(pos) - 1;
                if (row < 4 && col < 4) {
                    newHouse.layout.grid[row][col] = itemName;
                }
            }
        });
    }

    migrateWallpaper(wallData, newHouse) {
        // Left wallpaper
        const leftPositions = ['L1', 'L2', 'L3', 'L4'];
        leftPositions.forEach(pos => {
            const placed = wallData[pos];
            const itemName = wallData[`${pos}I`];
            
            if (placed && itemName) {
                newHouse.wallpaper.left.set(pos, {
                    itemName: itemName,
                    area: 1,
                    placed: true
                });
            }
        });

        // Right wallpaper
        const rightPositions = ['R1', 'R2', 'R3', 'R4'];
        rightPositions.forEach(pos => {
            const placed = wallData[pos];
            const itemName = wallData[`${pos}I`];
            
            if (placed && itemName) {
                newHouse.wallpaper.right.set(pos, {
                    itemName: itemName,
                    area: 1,
                    placed: true
                });
            }
        });
    }

    async migrateInventories() {
        console.log('🎒 Starting Inventory migration...');
        
        try {
            const oldInventories = await OldInventoryModel.find({});
            this.migrationStats.inventories.total = oldInventories.length;
            
            for (const oldInventory of oldInventories) {
                try {
                    const newInventoryData = this.convertInventoryStructure(oldInventory);
                    
                    await NewInventoryModel.findOneAndUpdate(
                        { guild: oldInventory.guild, user: oldInventory.user },
                        newInventoryData,
                        { upsert: true, new: true }
                    );
                    
                    this.migrationStats.inventories.migrated++;
                    console.log(`✅ Migrated inventory for ${oldInventory.user} in ${oldInventory.guild}`);
                    
                } catch (error) {
                    this.migrationStats.inventories.errors++;
                    console.error(`❌ Error migrating inventory ${oldInventory._id}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('❌ Inventory migration failed:', error);
        }
    }

    convertInventoryStructure(oldInventory) {
        const newInventory = {
            guild: oldInventory.guild,
            user: oldInventory.user,
            items: {
                furniture: new Map(),
                wallpaper: new Map(),
                floor: new Map(),
                food: new Map()
            },
            stats: {
                totalItems: 0,
                lastItemAdded: new Date(),
                mostUsedType: 'furniture'
            }
        };

        // แปลง items array เป็น Map แยกตาม type
        if (oldInventory.item && Array.isArray(oldInventory.item)) {
            const itemCounts = new Map();
            
            oldInventory.item.forEach(item => {
                const key = `${item.name}_${item.type}`;
                const existing = itemCounts.get(key);
                
                if (existing) {
                    existing.quantity += 1;
                } else {
                    itemCounts.set(key, {
                        name: item.name,
                        type: item.type,
                        quantity: 1,
                        ...item // รวม properties อื่นๆ
                    });
                }
            });

            // จัดกลุ่มตาม type
            itemCounts.forEach((itemData, key) => {
                const type = itemData.type;
                if (newInventory.items[type]) {
                    const itemId = `${itemData.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    newInventory.items[type].set(itemId, {
                        name: itemData.name,
                        quantity: itemData.quantity,
                        level: itemData.level || 1,
                        area: itemData.area || 1,
                        side: itemData.side,
                        exp: itemData.exp,
                        feed: itemData.feed,
                        lastUsed: new Date()
                    });
                }
            });

            // คำนวณ stats
            newInventory.stats.totalItems = oldInventory.item.length;
        }

        return newInventory;
    }

    async runMigration() {
        console.log('🚀 Starting Database Migration...');
        console.log('⚠️  Warning: This will create new collections alongside existing ones');
        
        const startTime = Date.now();
        
        // เริ่ม migration
        await Promise.all([
            this.migrateHouses(),
            this.migrateInventories()
        ]);
        
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log('\n📊 Migration Summary:');
        console.log('='.repeat(50));
        console.log(`🏠 Houses: ${this.migrationStats.houses.migrated}/${this.migrationStats.houses.total} migrated (${this.migrationStats.houses.errors} errors)`);
        console.log(`🎒 Inventories: ${this.migrationStats.inventories.migrated}/${this.migrationStats.inventories.total} migrated (${this.migrationStats.inventories.errors} errors)`);
        console.log(`⏱️  Total time: ${duration}s`);
        console.log('='.repeat(50));
        
        if (this.migrationStats.houses.errors === 0 && this.migrationStats.inventories.errors === 0) {
            console.log('✅ Migration completed successfully!');
        } else {
            console.log('⚠️  Migration completed with some errors. Please check the logs above.');
        }
    }

    async validateMigration() {
        console.log('\n🔍 Validating migration...');
        
        try {
            const oldHouseCount = await OldHouseModel.countDocuments();
            const newHouseCount = await NewHouseModel.countDocuments();
            
            const oldInventoryCount = await OldInventoryModel.countDocuments();
            const newInventoryCount = await NewInventoryModel.countDocuments();
            
            console.log(`Houses: ${oldHouseCount} -> ${newHouseCount}`);
            console.log(`Inventories: ${oldInventoryCount} -> ${newInventoryCount}`);
            
            if (oldHouseCount === newHouseCount && oldInventoryCount === newInventoryCount) {
                console.log('✅ Migration validation passed!');
                return true;
            } else {
                console.log('❌ Migration validation failed!');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Validation error:', error);
            return false;
        }
    }
}

// สำหรับการรัน script
async function main() {
    try {
        // เชื่อมต่อ MongoDB (ใช้ connection string ของคุณ)
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
        console.log('✅ Connected to MongoDB');
        
        const migrator = new DatabaseMigrator();
        await migrator.runMigration();
        await migrator.validateMigration();
        
        console.log('\n📝 Next steps:');
        console.log('1. Update your code to use the new models');
        console.log('2. Test thoroughly');
        console.log('3. Backup old collections');
        console.log('4. Drop old collections when confident');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// เรียกใช้ script หากรันโดยตรง
if (require.main === module) {
    main();
}

module.exports = { DatabaseMigrator }; 