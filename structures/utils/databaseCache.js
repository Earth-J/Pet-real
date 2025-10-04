const NodeCache = require('node-cache');

class DatabaseCache {
    constructor() {
        // สร้าง cache แยกสำหรับแต่ละ collection
        this.houseCache = new NodeCache({ 
            stdTTL: 300, // 5 นาที
            checkperiod: 60, // ตรวจสอบทุก 1 นาที
            useClones: false // ประหยัด memory
        });
        
        this.inventoryCache = new NodeCache({ 
            stdTTL: 180, // 3 นาที (inventory เปลี่ยนบ่อยกว่า)
            checkperiod: 30,
            useClones: false
        });
        
        this.userDataCache = new NodeCache({
            stdTTL: 600, // 10 นาที (user data เปลี่ยนไม่บ่อย)
            checkperiod: 120,
            useClones: false
        });
    }
    
    // House Cache Methods
    getHouseKey(guild, user) {
        return `house:${guild}:${user}`;
    }
    
    async getHouse(guild, user, Model) {
        const key = this.getHouseKey(guild, user);
        let house = this.houseCache.get(key);
        
        if (!house) {
            house = await Model.findOne({ guild, user });
            if (house) {
                this.houseCache.set(key, house, 300); // cache 5 นาที
            }
        }
        
        return house;
    }
    
    setHouse(guild, user, house) {
        const key = this.getHouseKey(guild, user);
        this.houseCache.set(key, house, 300);
    }
    
    invalidateHouse(guild, user) {
        const key = this.getHouseKey(guild, user);
        this.houseCache.del(key);
    }
    
    // Inventory Cache Methods
    getInventoryKey(guild, user) {
        return `inventory:${guild}:${user}`;
    }
    
    async getInventory(guild, user, Model) {
        const key = this.getInventoryKey(guild, user);
        let inventory = this.inventoryCache.get(key);
        
        if (!inventory) {
            inventory = await Model.findOne({ guild, user });
            if (inventory) {
                this.inventoryCache.set(key, inventory, 180); // cache 3 นาที
            }
        }
        
        return inventory;
    }
    
    setInventory(guild, user, inventory) {
        const key = this.getInventoryKey(guild, user);
        this.inventoryCache.set(key, inventory, 180);
    }
    
    invalidateInventory(guild, user) {
        const key = this.getInventoryKey(guild, user);
        this.inventoryCache.del(key);
    }
    
    // Inventory ตาม Type (สำหรับ furniture, wallpaper, etc.)
    async getInventoryByType(guild, user, type, Model) {
        const key = `${this.getInventoryKey(guild, user)}:${type}`;
        let items = this.inventoryCache.get(key);
        
        if (!items) {
            const inventory = await this.getInventory(guild, user, Model);
            if (inventory && inventory.items && inventory.items[type]) {
                items = Array.from(inventory.items[type].entries()).map(([id, data]) => ({
                    id,
                    ...data
                }));
                this.inventoryCache.set(key, items, 180);
            } else {
                items = [];
            }
        }
        
        return items;
    }
    
    // User Data Cache Methods
    getUserDataKey(guild, user) {
        return `user:${guild}:${user}`;
    }
    
    async getUserData(guild, user, Model) {
        const key = this.getUserDataKey(guild, user);
        let userData = this.userDataCache.get(key);
        
        if (!userData) {
            userData = await Model.findOne({ guild, user });
            if (userData) {
                this.userDataCache.set(key, userData, 600);
            }
        }
        
        return userData;
    }
    
    setUserData(guild, user, userData) {
        const key = this.getUserDataKey(guild, user);
        this.userDataCache.set(key, userData, 600);
    }
    
    invalidateUserData(guild, user) {
        const key = this.getUserDataKey(guild, user);
        this.userDataCache.del(key);
    }
    
    // Batch Operations
    async batchGetUserData(guild, user, models) {
        const promises = [];
        const results = {};
        
        if (models.house) {
            promises.push(
                this.getHouse(guild, user, models.house)
                    .then(data => { results.house = data; })
            );
        }
        
        if (models.inventory) {
            promises.push(
                this.getInventory(guild, user, models.inventory)
                    .then(data => { results.inventory = data; })
            );
        }
        
        if (models.profile) {
            promises.push(
                this.getUserData(guild, user, models.profile)
                    .then(data => { results.profile = data; })
            );
        }
        
        await Promise.all(promises);
        return results;
    }
    
    // Utility Methods
    clearUserCache(guild, user) {
        this.invalidateHouse(guild, user);
        this.invalidateInventory(guild, user);
        this.invalidateUserData(guild, user);
    }
    
    clearAllCache() {
        this.houseCache.flushAll();
        this.inventoryCache.flushAll();
        this.userDataCache.flushAll();
    }
    
    getCacheStats() {
        return {
            house: {
                keys: this.houseCache.keys().length,
                hits: this.houseCache.getStats().hits,
                misses: this.houseCache.getStats().misses
            },
            inventory: {
                keys: this.inventoryCache.keys().length,
                hits: this.inventoryCache.getStats().hits,
                misses: this.inventoryCache.getStats().misses
            },
            userData: {
                keys: this.userDataCache.keys().length,
                hits: this.userDataCache.getStats().hits,
                misses: this.userDataCache.getStats().misses
            }
        };
    }
    
    // Middleware สำหรับ auto-invalidate เมื่อมีการอัพเดท
    createInvalidationMiddleware(type) {
        return function(next) {
            const guild = this.guild;
            const user = this.user;
            
            // Invalidate cache หลังจาก save
            this.constructor.schema.post('save', () => {
                switch(type) {
                    case 'house':
                        dbCache.invalidateHouse(guild, user);
                        break;
                    case 'inventory':
                        dbCache.invalidateInventory(guild, user);
                        break;
                    case 'profile':
                        dbCache.invalidateUserData(guild, user);
                        break;
                }
            });
            
            next();
        };
    }
}

// สร้าง singleton instance
const dbCache = new DatabaseCache();

module.exports = { dbCache, DatabaseCache }; 