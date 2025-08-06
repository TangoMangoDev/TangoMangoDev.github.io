// indexeddb-manager.js
class StatsIndexedDB {
    constructor() {
        this.dbName = 'FantasyStatsDB';
        this.version = 1;
        this.db = null;
        this.loadTracker = new Map(); // In-memory tracker for loaded data
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadStoredTracker();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stats store
                if (!db.objectStoreNames.contains('stats')) {
                    const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
                    statsStore.createIndex('year', 'year', { unique: false });
                    statsStore.createIndex('week', 'week', { unique: false });
                    statsStore.createIndex('position', 'position', { unique: false });
                    statsStore.createIndex('playerKey', 'playerKey', { unique: false });
                }

                // Create metadata store for tracking loaded data
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    // Generate unique key for tracking loaded data
    generateLoadKey(year, week, position = 'ALL') {
        return `${year}_${week}_${position}`;
    }

    // Check if data is already loaded
    isDataLoaded(year, week, position = 'ALL') {
        const key = this.generateLoadKey(year, week, position);
        return this.loadTracker.has(key) || localStorage.getItem(`loaded_${key}`) === 'true';
    }

    // Mark data as loaded
    markAsLoaded(year, week, position = 'ALL') {
        const key = this.generateLoadKey(year, week, position);
        this.loadTracker.set(key, true);
        localStorage.setItem(`loaded_${key}`, 'true');
        
        // Also store in IndexedDB metadata
        this.storeMetadata(key, {
            year,
            week, 
            position,
            loadedAt: new Date().toISOString()
        });
    }

    // Store metadata in IndexedDB
    async storeMetadata(key, data) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        
        await store.put({ key, ...data });
    }

    // Load stored tracker from localStorage
    loadStoredTracker() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('loaded_') && localStorage.getItem(key) === 'true') {
                const loadKey = key.replace('loaded_', '');
                this.loadTracker.set(loadKey, true);
            }
        }
    }

    // Store stats data in IndexedDB
    async storeStats(statsArray, year, week, position = 'ALL') {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readwrite');
        const store = transaction.objectStore('stats');

        // Store each player's stats with metadata
        for (const player of statsArray) {
            const record = {
                id: `${player.playerKey}_${year}_${week}`,
                playerKey: player.playerKey,
                playerName: player.playerName,
                position: player.position,
                year: year,
                week: week,
                stats: player.stats,
                storedAt: new Date().toISOString()
            };

            await store.put(record);
        }

        // Mark as loaded
        this.markAsLoaded(year, week, position);
    }

    // Retrieve stats from IndexedDB
    async getStats(year, week, position = 'ALL') {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readonly');
        const store = transaction.objectStore('stats');

        let results = [];

        if (position === 'ALL') {
            // Get all records for year/week
            const yearIndex = store.index('year');
            const request = yearIndex.getAll(year);
            
            const allRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = allRecords.filter(record => record.week === week);
        } else {
            // Get records for specific position
            const positionIndex = store.index('position');
            const request = positionIndex.getAll(position);
            
            const positionRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = positionRecords.filter(record => 
                record.year === year && record.week === week
            );
        }

        return results;
    }

    // Clear specific data
    async clearData(year, week, position = 'ALL') {
        const key = this.generateLoadKey(year, week, position);
        this.loadTracker.delete(key);
        localStorage.removeItem(`loaded_${key}`);
        
        // Could also remove from IndexedDB if needed
        // This is a basic implementation - you might want more sophisticated clearing
    }

    // Get storage info for debugging
    async getStorageInfo() {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['stats', 'metadata'], 'readonly');
        const statsStore = transaction.objectStore('stats');
        const metadataStore = transaction.objectStore('metadata');

        const statsCount = await new Promise((resolve) => {
            const request = statsStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        const metadataCount = await new Promise((resolve) => {
            const request = metadataStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        return {
            statsRecords: statsCount,
            metadataRecords: metadataCount,
            loadedKeys: Array.from(this.loadTracker.keys()),
            localStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('loaded_'))
        };
    }
}

// Export singleton instance
const statsDB = new StatsIndexedDB();
export default statsDB;
