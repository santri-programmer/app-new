// High Performance IndexedDB Utility
class JimpitanDB {
  constructor() {
    this.dbName = "JimpitanAppDB";
    this.version = 2; // Increased version for new indexes
    this.db = null;
    this.initialized = false;
  }

  // Optimized initialization dengan connection pooling
  async init() {
    if (this.initialized && this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error("Failed to open database"));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.initialized = true;

        // Optimize database settings
        this.db.onversionchange = () => {
          this.db.close();
          this.initialized = false;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createOptimizedStores(db);
      };
    });
  }

  // Create optimized object stores dengan composite indexes
  createOptimizedStores(db) {
    // Create object store for daily inputs dengan optimized indexes
    if (!db.objectStoreNames.contains("dailyInputs")) {
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
    }

    // Optimized settings store
    if (!db.objectStoreNames.contains("settings")) {
      const settingsStore = db.createObjectStore("settings", {
        keyPath: "key",
      });
      settingsStore.createIndex("key", "key", { unique: true });
    }

    // Cache store untuk performance
    if (!db.objectStoreNames.contains("cache")) {
      const cacheStore = db.createObjectStore("cache", {
        keyPath: "key",
      });
      cacheStore.createIndex("expires", "expires", { unique: false });
    }
  }

  // High-performance save dengan batch operations support
  async saveDailyInput(inputData) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
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
        reject(new Error("Failed to save data"));
      };
    });
  }

  // Optimized query dengan composite index
  async getDailyInputs(kategori, tanggal = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readonly");
      const store = transaction.objectStore("dailyInputs");

      // Gunakan composite index untuk maximum performance
      const index = store.index("kategori_tanggal");
      const range = tanggal
        ? IDBKeyRange.only([kategori, tanggal])
        : IDBKeyRange.bound([kategori, ""], [kategori, "\uffff"]);

      const request = index.getAll(range);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve data"));
      };
    });
  }

  // Batch operations untuk bulk inserts
  async batchSaveDailyInputs(inputsArray) {
    if (inputsArray.length === 0) return [];

    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");

      const results = [];
      let completed = 0;
      let hasError = false;

      inputsArray.forEach((inputData, index) => {
        const dataWithMeta = {
          ...inputData,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
        };

        const request = store.add(dataWithMeta);

        request.onsuccess = () => {
          results[index] = request.result;
          completed++;

          if (completed === inputsArray.length && !hasError) {
            resolve(results);
          }
        };

        request.onerror = () => {
          hasError = true;
          reject(new Error(`Failed to save item at index ${index}`));
        };
      });
    });
  }

  // Optimized update operation
  async updateDailyInput(id, updates) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingData = getRequest.result;
        if (!existingData) {
          reject(new Error("Data not found"));
          return;
        }

        const updatedData = {
          ...existingData,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedData);

        putRequest.onsuccess = () => {
          resolve(updatedData);
        };

        putRequest.onerror = () => {
          reject(new Error("Failed to update data"));
        };
      };

      getRequest.onerror = () => {
        reject(new Error("Failed to retrieve data for update"));
      };
    });
  }

  // High-performance delete
  async deleteDailyInput(id) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error("Failed to delete data"));
      };
    });
  }

  // Optimized bulk delete dengan range query
  async deleteDailyInputsByDate(kategori, tanggal) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");
      const index = store.index("kategori_tanggal");

      const range = IDBKeyRange.only([kategori, tanggal]);
      const request = index.getAll(range);

      request.onsuccess = () => {
        const itemsToDelete = request.result;

        if (itemsToDelete.length === 0) {
          resolve({ deletedCount: 0, errorCount: 0 });
          return;
        }

        let deletedCount = 0;
        let errorCount = 0;

        itemsToDelete.forEach((item) => {
          const deleteRequest = store.delete(item.id);
          deleteRequest.onsuccess = () => {
            deletedCount++;
          };
          deleteRequest.onerror = () => {
            errorCount++;
          };
        });

        transaction.oncomplete = () => {
          resolve({ deletedCount, errorCount });
        };

        transaction.onerror = () => {
          reject(new Error("Transaction failed during deletion"));
        };
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve data for deletion"));
      };
    });
  }

  // Cache operations untuk performance
  async setCache(key, value, ttl = 300000) {
    // 5 minutes default
    await this.ensureInit();

    return new Promise((resolve, reject) => {
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
        reject(new Error("Failed to set cache"));
      };
    });
  }

  async getCache(key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
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
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error("Failed to get cache"));
      };
    });
  }

  async clearCache(key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");

      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error("Failed to clear cache"));
      };
    });
  }

  // Utility methods
  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // Cleanup expired cache entries
  async cleanupExpiredCache() {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");
      const index = store.index("expires");

      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.getAllKeys(range);

      request.onsuccess = () => {
        const keysToDelete = request.result;
        let deletedCount = 0;

        keysToDelete.forEach((key) => {
          const deleteRequest = store.delete(key);
          deleteRequest.onsuccess = () => {
            deletedCount++;
          };
        });

        transaction.oncomplete = () => {
          resolve(deletedCount);
        };
      };

      request.onerror = () => {
        reject(new Error("Failed to cleanup cache"));
      };
    });
  }

  // Performance monitoring
  async getDatabaseSize() {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ["dailyInputs", "settings", "cache"],
        "readonly"
      );
      let totalSize = 0;
      let storeCount = 0;

      ["dailyInputs", "settings", "cache"].forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const data = request.result;
          totalSize += new Blob([JSON.stringify(data)]).size;
          storeCount++;

          if (storeCount === 3) {
            resolve({
              totalBytes: totalSize,
              totalMB: (totalSize / (1024 * 1024)).toFixed(2),
            });
          }
        };

        request.onerror = () => {
          storeCount++;
        };
      });
    });
  }
}

// Create global optimized instance
const jimpitanDB = new JimpitanDB();

// Auto cleanup expired cache every hour
setInterval(() => {
  jimpitanDB.cleanupExpiredCache().catch(() => {});
}, 60 * 60 * 1000);
