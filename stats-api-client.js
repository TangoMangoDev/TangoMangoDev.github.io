// stats-api-client.js
import statsDB from './indexeddb-manager.js';

class StatsAPIClient {
    constructor() {
        this.baseUrl = '/data/stats';
        this.cache = new Map(); // Additional in-memory cache for quick access
    }

    async getStats(year, week = 'total', position = 'ALL', forceRefresh = false) {
        const cacheKey = `${year}_${week}_${position}`;
        
        // Check in-memory cache first (fastest)
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log(`📦 Serving from memory cache: ${cacheKey}`);
            return this.cache.get(cacheKey);
        }

        // Check if data is already loaded in IndexedDB
        if (!forceRefresh && statsDB.isDataLoaded(year, week, position)) {
            console.log(`📦 Serving from IndexedDB: ${cacheKey}`);
            const data = await statsDB.getStats(year, week, position);
            this.cache.set(cacheKey, data); // Store in memory cache too
            return data;
        }

        // Fetch from backend
        console.log(`🌐 Fetching from backend: ${cacheKey}`);
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ year, week, position })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch stats');
            }

            const data = result.data;

            // Store in IndexedDB
            await statsDB.storeStats(data, year, week, position);

            // Store in memory cache
            this.cache.set(cacheKey, data);

            console.log(`✅ Fetched and cached ${data.length} records for ${cacheKey}`);
            return data;

        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }

    // Get available years/weeks for UI
    async getAvailableData() {
        // This could be another endpoint or hardcoded based on your data
        return {
            years: ['2024', '2023', '2022'],
            weeks: ['total', 'week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'week8', 'week9', 'week10', 'week11', 'week12', 'week13', 'week14', 'week15', 'week16', 'week17', 'week18'],
            positions: ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        };
    }

    // Clear cache
    clearCache(year = null, week = null, position = null) {
        if (year || week || position) {
            const pattern = `${year || '[^_]+'}_${week || '[^_]+'}_${position || '[^_]+'}`;
            const regex = new RegExp(pattern);
            
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    // Get cache info for debugging
    getCacheInfo() {
        return {
            memoryCacheSize: this.cache.size,
            memoryCacheKeys: Array.from(this.cache.keys())
        };
    }
}

export default new StatsAPIClient();
