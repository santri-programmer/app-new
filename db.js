// High Performance IndexedDB Utility
class JimpitanDB {
  constructor() {
    this.dbName = "JimpitanAppDB";
    this.version = 3;
    this.db = null;
    this.initialized = false;
  }

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
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.createOptimizedStores(db, event.oldVersion);
      };
    });
  }

  createOptimizedStores(db, oldVersion) {
    // Delete existing stores jika ada
    if (db.objectStoreNames.contains("dailyInputs")) {
      db.deleteObjectStore("dailyInputs");
    }
    if (db.objectStoreNames.contains("settings")) {
      db.deleteObjectStore("settings");
    }
    if (db.objectStoreNames.contains("cache")) {
      db.deleteObjectStore("cache");
    }

    // Create object store for daily inputs
    const store = db.createObjectStore("dailyInputs", {
      keyPath: "id",
      autoIncrement: true,
    });

    // Create indexes
    store.createIndex("kategori_tanggal", ["kategori", "tanggal"], {
      unique: false,
    });
    store.createIndex("kategori_donatur", ["kategori", "donatur"], {
      unique: false,
    });
    store.createIndex("kategori", "kategori", { unique: false });
    store.createIndex("tanggal", "tanggal", { unique: false });
    store.createIndex("donatur", "donatur", { unique: false });
    store.createIndex("createdAt", "createdAt", { unique: false });

    // Create settings store
    const settingsStore = db.createObjectStore("settings", {
      keyPath: "key",
    });
    settingsStore.createIndex("key", "key", { unique: true });

    // Create cache store
    const cacheStore = db.createObjectStore("cache", {
      keyPath: "key",
    });
    cacheStore.createIndex("expires", "expires", { unique: false });
  }

  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // === DAILY INPUTS METHODS ===

  async saveDailyInput(inputData) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");

      const dataWithMeta = {
        ...inputData,
        createdAt: new Date().toISOString(),
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

  async getDailyInputs(kategori, tanggal = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readonly");
      const store = transaction.objectStore("dailyInputs");

      let index;
      try {
        index = store.index("kategori_tanggal");
      } catch (e) {
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
        reject(new Error("Failed to retrieve data"));
      };
    });
  }

  async getDailyInputsFallback(kategori, tanggal = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readonly");
      const store = transaction.objectStore("dailyInputs");
      const index = store.index("kategori");

      const request = index.getAll(kategori);

      request.onsuccess = () => {
        let results = request.result;
        if (tanggal) {
          results = results.filter((item) => item.tanggal === tanggal);
        }
        resolve(results);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve data with fallback"));
      };
    });
  }

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

  async deleteDailyInputsByDateFallback(kategori, tanggal) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");
      const index = store.index("kategori");

      const request = index.getAll(kategori);

      request.onsuccess = () => {
        const allItems = request.result;
        const itemsToDelete = allItems.filter(
          (item) => item.tanggal === tanggal
        );

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
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve data for deletion"));
      };
    });
  }

  async batchSaveDailyInputs(inputsArray) {
    if (inputsArray.length === 0) return [];

    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readwrite");
      const store = transaction.objectStore("dailyInputs");

      const results = [];
      let completed = 0;

      inputsArray.forEach((inputData, index) => {
        const dataWithMeta = {
          ...inputData,
          createdAt: new Date().toISOString(),
        };

        const request = store.add(dataWithMeta);

        request.onsuccess = () => {
          results[index] = request.result;
          completed++;

          if (completed === inputsArray.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          reject(new Error(`Failed to save item at index ${index}`));
        };
      });
    });
  }

  async getAllDailyInputs() {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["dailyInputs"], "readonly");
      const store = transaction.objectStore("dailyInputs");

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve all data"));
      };
    });
  }

  // === CACHE METHODS ===

  async setCache(key, value, ttl = 300000) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");

      const cacheItem = {
        key,
        value: JSON.stringify(value),
        expires: Date.now() + ttl,
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

        if (result.expires < Date.now()) {
          this.clearCache(key);
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

  // === SETTINGS METHODS ===

  async saveSetting(key, value) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["settings"], "readwrite");
      const store = transaction.objectStore("settings");

      const request = store.put({ key, value });

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error("Failed to save setting"));
      };
    });
  }

  async getSetting(key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["settings"], "readonly");
      const store = transaction.objectStore("settings");

      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };

      request.onerror = () => {
        reject(new Error("Failed to get setting"));
      };
    });
  }

  // === UTILITY METHODS ===

  async repairDatabase() {
    try {
      if (this.db) {
        this.db.close();
        this.initialized = false;
        this.db = null;
      }

      await new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);

        deleteRequest.onsuccess = () => {
          resolve();
        };

        deleteRequest.onerror = () => {
          reject(new Error("Failed to delete database"));
        };
      });

      await this.init();
      return true;
    } catch (error) {
      return false;
    }
  }

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
              resolve({ exists: true, count: countRequest.result });
            countRequest.onerror = () => resolve({ exists: false });
          });
        } catch (error) {
          health[storeName] = { exists: false };
        }
      }

      return health;
    } catch (error) {
      return { overall: "unhealthy" };
    }
  }
}

// Create global instance
const jimpitanDB = new JimpitanDB();
