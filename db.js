// High Performance IndexedDB Utility - FIXED VERSION
class JimpitanDB {
  constructor() {
    this.dbName = "JimpitanAppDB";
    this.version = 3; // ⚠️ INCREASE VERSION NUMBER
    this.db = null;
    this.initialized = false;
  }

  // Optimized initialization dengan better error handling
  async init() {
    if (this.initialized && this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error("❌ Database opening failed");
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;

        console.log("✅ Database initialized successfully");

        // Optimize database settings
        this.db.onversionchange = () => {
          console.log("🔄 Database version change detected");
          this.db.close();
          this.initialized = false;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log(
          "🔄 Database upgrade needed from",
          event.oldVersion,
          "to",
          event.newVersion
        );
        const db = event.target.result;
        this.createOptimizedStores(db, event.oldVersion);
      };

      request.onblocked = () => {
        console.warn("⚠️ Database upgrade blocked by other connections");
      };
    });
  }

  // Create optimized object stores dengan migration support
  createOptimizedStores(db, oldVersion) {
    console.log("🏗️ Creating/updating database stores...");

    // Migration dari version lama
    if (oldVersion < 1) {
      // Initial version - create all stores
      this.createAllStores(db);
    } else {
      // Migration path untuk existing databases
      this.migrateDatabase(db, oldVersion);
    }
  }

  // Create all object stores dari awal
  createAllStores(db) {
    // Delete existing stores jika ada (clean start)
    if (db.objectStoreNames.contains("dailyInputs")) {
      db.deleteObjectStore("dailyInputs");
    }
    if (db.objectStoreNames.contains("settings")) {
      db.deleteObjectStore("settings");
    }
    if (db.objectStoreNames.contains("cache")) {
      db.deleteObjectStore("cache");
    }

    // Create object store for daily inputs dengan optimized indexes
    const store = db.createObjectStore("dailyInputs", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Composite index untuk fastest queries
    store.createIndex("kategori_tanggal", ["kategori", "tanggal"], {
      unique: false,
    });
    store.createIndex("kategori_donatur", ["kategori", "donatur"], {
      unique: false,
    });
    store.createIndex("tanggal_kategori", ["tanggal", "kategori"], {
      unique: false,
    });

    // Single field indexes sebagai fallback
    store.createIndex("kategori", "kategori", { unique: false });
    store.createIndex("tanggal", "tanggal", { unique: false });
    store.createIndex("donatur", "donatur", { unique: false });
    store.createIndex("createdAt", "createdAt", { unique: false });

    console.log("✅ Created dailyInputs store with indexes");

    // Optimized settings store
    const settingsStore = db.createObjectStore("settings", {
      keyPath: "key",
    });
    settingsStore.createIndex("key", "key", { unique: true });

    console.log("✅ Created settings store");

    // Cache store untuk performance
    const cacheStore = db.createObjectStore("cache", {
      keyPath: "key",
    });
    cacheStore.createIndex("expires", "expires", { unique: false });

    console.log("✅ Created cache store");
  }

  // Migration path untuk existing databases
  migrateDatabase(db, oldVersion) {
    console.log(
      `🔄 Migrating database from version ${oldVersion} to ${this.version}`
    );

    // Migration dari version 1 ke 2
    if (oldVersion < 2) {
      if (!db.objectStoreNames.contains("cache")) {
        const cacheStore = db.createObjectStore("cache", {
          keyPath: "key",
        });
        cacheStore.createIndex("expires", "expires", { unique: false });
        console.log("✅ Added cache store in migration");
      }
    }

    // Migration dari version 2 ke 3
    if (oldVersion < 3) {
      // Recreate stores dengan indexes yang benar
      this.createAllStores(db);
    }
  }

  // High-performance save dengan batch operations support
  async saveDailyInput(inputData) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["dailyInputs"], "readwrite");
        const store = transaction.objectStore("dailyInputs");

        const dataWithMeta = {
          ...inputData,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
        };

        const request = store.add(dataWithMeta);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.error("❌ Save operation failed");
          reject(new Error("Failed to save data"));
        };

        transaction.onerror = () => {
          console.error("❌ Transaction failed");
          reject(new Error("Transaction failed"));
        };
      } catch (error) {
        console.error("❌ Database operation error:", error);
        reject(error);
      }
    });
  }

  // Optimized query dengan composite index dan better error handling
  async getDailyInputs(kategori, tanggal = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["dailyInputs"], "readonly");
        const store = transaction.objectStore("dailyInputs");

        // Cek jika index tersedia, jika tidak gunakan fallback
        let index;
        try {
          index = store.index("kategori_tanggal");
        } catch (e) {
          // Fallback ke index kategori biasa
          console.warn("⚠️ Composite index not available, using fallback");
          index = store.index("kategori");
        }

        const range = tanggal
          ? IDBKeyRange.only([kategori, tanggal])
          : IDBKeyRange.bound([kategori, ""], [kategori, "\uffff"]);

        const request = index.getAll(range);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.error("❌ Query operation failed");
          reject(new Error("Failed to retrieve data"));
        };

        transaction.onerror = () => {
          console.error("❌ Transaction failed");
          reject(new Error("Transaction failed"));
        };
      } catch (error) {
        console.error("❌ Database query error:", error);
        reject(error);
      }
    });
  }

  // Cache operations untuk performance
  async setCache(key, value, ttl = 300000) {
    // 5 minutes default
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["cache"], "readwrite");
        const store = transaction.objectStore("cache");

        const cacheItem = {
          key,
          value: JSON.stringify(value),
          expires: Date.now() + ttl,
          timestamp: Date.now(),
        };

        const request = store.put(cacheItem);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          console.error("❌ Cache set operation failed");
          reject(new Error("Failed to set cache"));
        };
      } catch (error) {
        console.error("❌ Cache operation error:", error);
        reject(error);
      }
    });
  }

  async getCache(key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["cache"], "readonly");
        const store = transaction.objectStore("cache");

        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }

          // Check expiration
          if (result.expires < Date.now()) {
            this.clearCache(key); // Async cleanup
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(result.value));
          } catch (e) {
            console.error("❌ Cache parse error:", e);
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error("❌ Cache get operation failed");
          reject(new Error("Failed to get cache"));
        };
      } catch (error) {
        console.error("❌ Cache operation error:", error);
        reject(error);
      }
    });
  }

  async clearCache(key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["cache"], "readwrite");
        const store = transaction.objectStore("cache");

        const request = store.delete(key);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          console.error("❌ Cache clear operation failed");
          reject(new Error("Failed to clear cache"));
        };
      } catch (error) {
        console.error("❌ Cache operation error:", error);
        reject(error);
      }
    });
  }

  // Cleanup expired cache entries
  async cleanupExpiredCache() {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["cache"], "readwrite");
        const store = transaction.objectStore("cache");
        const index = store.index("expires");

        const range = IDBKeyRange.upperBound(Date.now());
        const request = index.getAllKeys(range);

        request.onsuccess = () => {
          const keysToDelete = request.result;

          if (keysToDelete.length === 0) {
            resolve(0);
            return;
          }

          let deletedCount = 0;
          let errorCount = 0;

          keysToDelete.forEach((key) => {
            const deleteRequest = store.delete(key);
            deleteRequest.onsuccess = () => {
              deletedCount++;
            };
            deleteRequest.onerror = () => {
              errorCount++;
            };
          });

          transaction.oncomplete = () => {
            console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
            resolve(deletedCount);
          };

          transaction.onerror = () => {
            console.error("❌ Cache cleanup transaction failed");
            reject(new Error("Cache cleanup transaction failed"));
          };
        };

        request.onerror = () => {
          console.error("❌ Cache cleanup failed");
          reject(new Error("Failed to cleanup cache"));
        };
      } catch (error) {
        console.error("❌ Cache cleanup error:", error);
        reject(error);
      }
    });
  }

  // Fallback method jika composite index bermasalah
  async getDailyInputsFallback(kategori, tanggal = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(["dailyInputs"], "readonly");
        const store = transaction.objectStore("dailyInputs");
        const index = store.index("kategori");

        const request = index.getAll(kategori);

        request.onsuccess = () => {
          let results = request.result;

          // Filter manual oleh tanggal jika diperlukan
          if (tanggal) {
            results = results.filter((item) => item.tanggal === tanggal);
          }

          resolve(results);
        };

        request.onerror = () => {
          reject(new Error("Failed to retrieve data with fallback"));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // Utility methods dengan better error handling
  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }

    // Double check jika database masih terbuka
    if (!this.db) {
      throw new Error("Database not available");
    }
  }

  // Database repair function
  async repairDatabase() {
    console.log("🔧 Attempting database repair...");

    try {
      // Close existing connection
      if (this.db) {
        this.db.close();
        this.initialized = false;
        this.db = null;
      }

      // Delete database dan buat ulang
      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);

        deleteRequest.onsuccess = () => {
          console.log("✅ Old database deleted");
          resolve();
        };

        deleteRequest.onerror = () => {
          console.error("❌ Failed to delete old database");
          reject(new Error("Failed to delete database"));
        };

        deleteRequest.onblocked = () => {
          console.warn("⚠️ Database deletion blocked");
          reject(new Error("Database deletion blocked"));
        };
      });

      // Reinitialize
      await this.init();
      console.log("✅ Database repaired successfully");
      return true;
    } catch (error) {
      console.error("❌ Database repair failed:", error);
      return false;
    }
  }

  // Check database health
  async checkHealth() {
    try {
      await this.ensureInit();

      const stores = ["dailyInputs", "settings", "cache"];

      const health = {};

      for (const storeName of stores) {
        try {
          const transaction = this.db.transaction([storeName], "readonly");
          const store = transaction.objectStore(storeName);
          const countRequest = store.count();

          health[storeName] = await new Promise((resolve) => {
            countRequest.onsuccess = () =>
              resolve({
                exists: true,
                count: countRequest.result,
              });
            countRequest.onerror = () =>
              resolve({
                exists: false,
                error: "Store not accessible",
              });
          });
        } catch (error) {
          health[storeName] = {
            exists: false,
            error: error.message,
          };
        }
      }

      return health;
    } catch (error) {
      return {
        overall: "unhealthy",
        error: error.message,
      };
    }
  }
}

// Create global optimized instance
const jimpitanDB = new JimpitanDB();

// Export repair function untuk global access
window.jimpitanDBRepair = () => jimpitanDB.repairDatabase();
window.jimpitanDBCheckHealth = () => jimpitanDB.checkHealth();

// Auto cleanup expired cache every hour
setInterval(() => {
  jimpitanDB.cleanupExpiredCache?.().catch(() => {});
}, 60 * 60 * 1000);
