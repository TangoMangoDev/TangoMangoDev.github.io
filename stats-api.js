// stats-api.js - Pure API layer with IndexedDB caching
class StatsCache {
    constructor() {
        this.dbName = 'nfl_stats_cache';
        this.version = 2; // Increment version to add scoring rules store
        this.storeName = 'stats';
        this.scoringRulesStore = 'scoring_rules';
        this.db = null;
        this.cacheExpiryMinutes = 60;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Stats store
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'cacheKey' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('year', 'year', { unique: false });
                    store.createIndex('week', 'week', { unique: false });
                    store.createIndex('position', 'position', { unique: false });
                }

                // Scoring rules store
                if (!db.objectStoreNames.contains(this.scoringRulesStore)) {
                    const rulesStore = db.createObjectStore(this.scoringRulesStore, { keyPath: 'leagueId' });
                    rulesStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Scoring rules methods
    async getScoringRules(leagueId) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.scoringRulesStore], 'readonly');
            const store = transaction.objectStore(this.scoringRulesStore);
            
            return new Promise((resolve, reject) => {
                const request = store.get(leagueId);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    // Check if cached data is still fresh (24 hours)
                    const now = new Date();
                    const cachedTime = new Date(result.timestamp);
                    const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                    
                    if (diffHours > 24) {
                        console.log(`Scoring rules cache expired for ${leagueId}`);
                        resolve(null);
                        return;
                    }
                    
                    console.log(`✅ Scoring rules cache hit for ${leagueId}`);
                    resolve(result.rules);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error getting scoring rules from cache:', error);
            return null;
        }
    }

    async setScoringRules(leagueId, rules) {
        try {
            await this.init();
            
            const cacheEntry = {
                leagueId,
                rules,
                timestamp: new Date().toISOString()
            };
            
            const transaction = this.db.transaction([this.scoringRulesStore], 'readwrite');
            const store = transaction.objectStore(this.scoringRulesStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    console.log(`✅ Cached scoring rules for ${leagueId}`);
                    resolve();
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error setting scoring rules cache:', error);
        }
    }

    generateCacheKey(year, week, position, page) {
        return `${year}_${week}_${position}_${page}`;
    }

    async get(year, week, position, page) {
        try {
            await this.init();
            
            const cacheKey = this.generateCacheKey(year, week, position, page);
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.get(cacheKey);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    const now = new Date();
                    const cachedTime = new Date(result.timestamp);
                    const diffMinutes = (now - cachedTime) / (1000 * 60);
                    
                    if (diffMinutes > this.cacheExpiryMinutes) {
                        console.log(`Cache expired for ${cacheKey}, age: ${diffMinutes.toFixed(2)} minutes`);
                        resolve(null);
                        return;
                    }
                    
                    console.log(`✅ Cache hit for ${cacheKey}, age: ${diffMinutes.toFixed(2)} minutes`);
                    resolve(result.data);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(year, week, position, page, data) {
        try {
            await this.init();
            
            const cacheKey = this.generateCacheKey(year, week, position, page);
            const cacheEntry = {
                cacheKey,
                year,
                week, 
                position,
                page,
                data,
                timestamp: new Date().toISOString()
            };
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    console.log(`✅ Cached data for ${cacheKey}`);
                    resolve();
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    async clear(year) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('year');
            
            return new Promise((resolve, reject) => {
                const request = index.openCursor(IDBKeyRange.only(year));
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        console.log(`🗑️ Cleared cache for year ${year}`);
                        resolve();
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    async clearAll() {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.storeName, this.scoringRulesStore], 'readwrite');
            const statsStore = transaction.objectStore(this.storeName);
            const rulesStore = transaction.objectStore(this.scoringRulesStore);
            
            await Promise.all([
                new Promise((resolve, reject) => {
                    const request = statsStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                }),
                new Promise((resolve, reject) => {
                    const request = rulesStore.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                })
            ]);
            
            console.log('🗑️ Cleared all cached data and scoring rules');
        } catch (error) {
            console.error('Cache clear all error:', error);
        }
    }
}

class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/stats';
        this.cache = new StatsCache();
        this.currentRequests = new Map();
    }

    async getPlayersData(year = '2024', week = 'total', position = 'ALL', page = 1) {
        const requestKey = `${year}_${week}_${position}_${page}`;
        
        if (this.currentRequests.has(requestKey)) {
            console.log(`⏳ Waiting for pending request: ${requestKey}`);
            return await this.currentRequests.get(requestKey);
        }

        const cachedData = await this.cache.get(year, week, position, page);
        if (cachedData) {
            return cachedData;
        }

        const fetchPromise = this.fetchFromAPI(year, week, position, page);
        this.currentRequests.set(requestKey, fetchPromise);

        try {
            const data = await fetchPromise;
            
            if (data.success) {
                await this.cache.set(year, week, position, page, data);
            }
            
            return data;
        } catch (error) {
            console.error('Stats fetch error:', error);
            throw error;
        } finally {
            this.currentRequests.delete(requestKey);
        }
    }

    // FIXED: Proper method definition (was missing 'async' and had wrong function syntax)
    async getScoringRules(leagueId) {
        console.log(`🔍 getScoringRules called for league: ${leagueId}`);
        
        // Check cache first
        const cachedRules = await this.cache.getScoringRules(leagueId);
        if (cachedRules) {
            console.log(`✅ Using cached scoring rules for ${leagueId}`);
            return cachedRules;
        }

        // Fetch from API
        try {
            const url = leagueId ? 
                `/data/stats/rules?leagueId=${leagueId}` : 
                `/data/stats/rules`;
                
            console.log(`🌐 Fetching scoring rules from: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load rules`);
            
            const data = await response.json();
            console.log(`📊 Received scoring rules response:`, data);
            
            const rules = data.scoringRules || {};
            
            // Cache the rules if we have a specific league ID and rules exist
            if (leagueId && rules[leagueId] && Object.keys(rules[leagueId]).length > 0) {
                console.log(`💾 Caching scoring rules for league ${leagueId}`);
                await this.cache.setScoringRules(leagueId, rules);
            }
            
            return rules;
        } catch (error) {
            console.error(`❌ Error loading scoring rules:`, error);
            return {};
        }
    }

    async fetchFromAPI(year, week, position, page) {
        const params = new URLSearchParams({
            year,
            week,
            position,
            page: page.toString()
        });

        const url = `${this.baseUrl}?${params}`;
        console.log(`🌐 Fetching from API: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }

        console.log(`✅ Fetched ${data.count} players from API`);
        return data;
    }

    async clearCache(year = null) {
        if (year) {
            await this.cache.clear(year);
        } else {
            await this.cache.clearAll();
        }
    }
}

// Global API instance
window.statsAPI = new StatsAPI();
