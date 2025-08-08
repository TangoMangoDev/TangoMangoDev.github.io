// stats-api.js - Pure API layer with IndexedDB caching
class StatsCache {
    constructor() {
        this.dbName = 'nfl_stats_cache';
        this.version = 10;
        this.storeName = 'stats';
        this.scoringRulesStore = 'scoring_rules';
        this.rawDataStore = 'raw_data';
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

                // Raw data store for 9999 calls by year
                if (!db.objectStoreNames.contains(this.rawDataStore)) {
                    const rawStore = db.createObjectStore(this.rawDataStore, { keyPath: 'year' });
                    rawStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // NOTE: Rankings stores are created dynamically per league-year
            };
        });
    }

    // Get rankings store name for specific league-year
    getRankingsStoreName(leagueId, year) {
        return `rankings_${year}_${leagueId}`;
    }

    // Create rankings store for specific league-year if it doesn't exist
    async ensureRankingsStore(leagueId, year) {
        await this.init();
        const storeName = this.getRankingsStoreName(leagueId, year);
        
        if (this.db.objectStoreNames.contains(storeName)) {
            return storeName;
        }

        // Close current connection and reopen with new version to add store
        const currentVersion = this.db.version;
        this.db.close();
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, currentVersion + 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.version = this.db.version; // Update version
                resolve(storeName);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(storeName)) {
                    const rankStore = db.createObjectStore(storeName, { keyPath: 'playerId' });
                    rankStore.createIndex('overallRank', 'overallRank', { unique: false });
                    rankStore.createIndex('positionRank', 'positionRank', { unique: false });
                    rankStore.createIndex('position', 'position', { unique: false });
                    rankStore.createIndex('fantasyPoints', 'fantasyPoints', { unique: false });
                    rankStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log(`✅ Created rankings store: ${storeName}`);
                }
            };
        });
    }

    // Raw data methods
    async getRawDataForYear(year) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.rawDataStore], 'readonly');
            const store = transaction.objectStore(this.rawDataStore);
            
            return new Promise((resolve) => {
                const request = store.get(year);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    const now = new Date();
                    const cachedTime = new Date(result.timestamp);
                    const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                    
                    if (diffHours > 24) {
                        console.log(`Raw data cache expired for year ${year}`);
                        resolve(null);
                        return;
                    }
                    
                    console.log(`✅ Raw data cache hit for year ${year} (${result.data.length} players)`);
                    resolve(result.data);
                };
                
                request.onerror = () => resolve(null);
            });
        } catch (error) {
            console.error('Error getting raw data from cache:', error);
            return null;
        }
    }

    async setRawDataForYear(year, data) {
        try {
            await this.init();
            
            const cacheEntry = {
                year,
                data,
                timestamp: new Date().toISOString()
            };
            
            const transaction = this.db.transaction([this.rawDataStore], 'readwrite');
            const store = transaction.objectStore(this.rawDataStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    console.log(`✅ Cached raw data for year ${year} (${data.length} players)`);
                    resolve();
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error setting raw data cache:', error);
        }
    }

    // Rankings methods using YOUR specified store naming
    async hasRankingsForLeague(leagueId, year) {
        try {
            await this.init();
            const storeName = this.getRankingsStoreName(leagueId, year);
            
            if (!this.db.objectStoreNames.contains(storeName)) {
                return false;
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve) => {
                const countRequest = store.count();
                
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    resolve(count > 0);
                };
                
                countRequest.onerror = () => resolve(false);
            });
        } catch (error) {
            console.error('Error checking rankings in cache:', error);
            return false;
        }
    }

    async setPlayerRankings(leagueId, year, rankedPlayers) {
        try {
            const storeName = await this.ensureRankingsStore(leagueId, year);
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Clear existing rankings
            await new Promise((resolve, reject) => {
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => resolve();
                clearRequest.onerror = () => reject(clearRequest.error);
            });
            
            // Add new rankings - just player data + ranks + points
            const addPromises = rankedPlayers.map(player => {
                return new Promise((addResolve, addReject) => {
                    const rankData = {
                        playerId: player.id,
                        overallRank: player.overallRank,
                        positionRank: player.positionRank,
                        position: player.position,
                        fantasyPoints: player.fantasyPoints,
                        timestamp: new Date().toISOString()
                    };
                    
                    const addRequest = store.put(rankData);
                    addRequest.onsuccess = () => addResolve();
                    addRequest.onerror = () => addReject(addRequest.error);
                });
            });
            
            await Promise.all(addPromises);
            console.log(`✅ Stored ${rankedPlayers.length} rankings in ${storeName}`);
            
        } catch (error) {
            console.error('Error storing player rankings:', error);
        }
    }

    async getPlayerRankings(leagueId, year, playerIds) {
        try {
            await this.init();
            const storeName = this.getRankingsStoreName(leagueId, year);
            
            if (!this.db.objectStoreNames.contains(storeName)) {
                console.log(`❌ No rankings store found: ${storeName}`);
                return new Map();
            }

            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const rankings = new Map();
                let completed = 0;
                const total = playerIds.length;
                
                if (total === 0) {
                    resolve(rankings);
                    return;
                }
                
                playerIds.forEach(playerId => {
                    const request = store.get(playerId);
                    
                    request.onsuccess = () => {
                        const result = request.result;
                        if (result) {
                            const now = new Date();
                            const cachedTime = new Date(result.timestamp);
                            const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                            
                            if (diffHours < 24) {
                                rankings.set(playerId, result);
                            }
                        }
                        
                        completed++;
                        if (completed === total) {
                            console.log(`✅ Retrieved ${rankings.size}/${total} player rankings from ${storeName}`);
                            resolve(rankings);
                        }
                    };
                    
                    request.onerror = () => {
                        completed++;
                        if (completed === total) {
                            resolve(rankings);
                        }
                    };
                });
            });
        } catch (error) {
            console.error('Error getting player rankings:', error);
            return new Map();
        }
    }

    // Rest of the methods stay the same...
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

    async setScoringRules(leagueId, rules, leagueName = null) {
        try {
            await this.init();
            
            const cacheEntry = {
                leagueId,
                rules,
                leagueName,
                timestamp: new Date().toISOString()
            };
            
            const transaction = this.db.transaction([this.scoringRulesStore], 'readwrite');
            const store = transaction.objectStore(this.scoringRulesStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(cacheEntry);
                
                request.onsuccess = () => {
                    console.log(`✅ Cached scoring rules for ${leagueId}${leagueName ? ` (${leagueName})` : ''}`);
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
            
            const storeNames = [this.storeName, this.scoringRulesStore, this.rawDataStore];
            const transaction = this.db.transaction(storeNames, 'readwrite');
            
            const clearPromises = storeNames.map(storeName => {
                return new Promise((resolve, reject) => {
                    const store = transaction.objectStore(storeName);
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
            
            await Promise.all(clearPromises);
            console.log('🗑️ Cleared all cached data');
        } catch (error) {
            console.error('Cache clear all error:', error);
        }
    }
}

// StatsAPI class remains exactly the same as before...
class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/stats';
        this.cache = new StatsCache();
        this.currentRequests = new Map();
        this.rankingsCalculated = new Set();
    }

    async getPlayersData(year = '2024', week = 'total', position = 'ALL', page = 1, limit = 50) {
        const requestKey = `${year}_${week}_${position}_${page}_${limit}`;
        
        if (this.currentRequests.has(requestKey)) {
            console.log(`⏳ Waiting for pending request: ${requestKey}`);
            return await this.currentRequests.get(requestKey);
        }

        const cachedData = await this.cache.get(year, week, position, page);
        if (cachedData) {
            console.log(`✅ Cache hit for ${year}_${week}_${position}_${page}`);
            return cachedData;
        }

        const fetchPromise = this.fetchFromAPI(year, week, position, page, limit);
        this.currentRequests.set(requestKey, fetchPromise);

        try {
            const data = await fetchPromise;
            
            if (data.success) {
                await this.cache.set(year, week, position, page, data);
                console.log(`✅ Cached response for ${year}_${week}_${position}_${page}`);
            }
            
            return data;
        } catch (error) {
            console.error('Stats fetch error:', error);
            throw error;
        } finally {
            this.currentRequests.delete(requestKey);
        }
    }

    async getAllPlayersForRanking(year) {
        console.log(`🔍 Getting ALL players for year ${year}...`);
        
        const cachedData = await this.cache.getRawDataForYear(year);
        if (cachedData) {
            console.log(`✅ Using cached raw data for year ${year} (${cachedData.length} players)`);
            return cachedData.map(player => ({
                ...player,
                rawStats: player.stats,
                stats: convertStatsForDisplay(player.stats)
            }));
        }
        
        console.log(`🌐 Fetching fresh data for year ${year} from API...`);
        const allPlayersData = await this.fetchFromAPI(year, 'total', 'ALL', 1, 9999);
        
        await this.cache.setRawDataForYear(year, allPlayersData.data);
        
        return allPlayersData.data.map(player => ({
            ...player,
            rawStats: player.stats,
            stats: convertStatsForDisplay(player.stats)
        }));
    }

    async getTop50RankedPlayers(leagueId, year) {
        console.log(`🏆 Getting top 50 ranked players for ${leagueId}-${year}`);
        
        const top50Rankings = await this.cache.getTop50Rankings(leagueId, year);
        
        if (!top50Rankings || top50Rankings.length === 0) {
            console.log(`❌ No rankings found for ${leagueId}-${year}`);
            return null;
        }
        
        const cachedData = await this.cache.getRawDataForYear(year);
        if (!cachedData) {
            console.log(`❌ No cached raw data for year ${year}`);
            return null;
        }
        
        const playersMap = new Map(cachedData.map(p => [p.id, p]));
        
        const enhancedPlayers = top50Rankings.map(ranking => {
            const player = playersMap.get(ranking.playerId);
            if (player) {
                return {
                    ...player,
                    rawStats: player.stats,
                    stats: convertStatsForDisplay(player.stats),
                    overallRank: ranking.overallRank,
                    positionRank: ranking.positionRank,
                    fantasyPoints: ranking.fantasyPoints
                };
            }
            return null;
        }).filter(Boolean);
        
        console.log(`✅ Retrieved ${enhancedPlayers.length} top ranked players`);
        return enhancedPlayers;
    }

    async calculateFantasyRankings(leagueId, year, allPlayers, scoringRules) {
        if (!leagueId || !year || !allPlayers || !scoringRules) {
            console.log('❌ Missing data for fantasy rankings calculation');
            return false;
        }

        console.log(`🏆 BACKGROUND: Calculating fantasy rankings for league ${leagueId}-${year} with ${allPlayers.length} players`);

        const playersWithFantasyPoints = allPlayers.map(player => {
            let totalFantasyPoints = 0;

            Object.entries(player.rawStats || {}).forEach(([statId, statValue]) => {
                if (scoringRules[statId] && statValue !== 0) {
                    const rule = scoringRules[statId];
                    let points = statValue * parseFloat(rule.points || 0);
                    
                    if (rule.bonuses && Array.isArray(rule.bonuses)) {
                        rule.bonuses.forEach(bonusRule => {
                            const target = parseFloat(bonusRule.bonus.target || 0);
                            const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
                            
                            if (statValue >= target) {
                                points += bonusPoints;
                            }
                        });
                    }
                    
                    totalFantasyPoints += points;
                }
            });

            return {
                ...player,
                fantasyPoints: Math.round(totalFantasyPoints * 100) / 100
            };
        });

        const rankedPlayers = playersWithFantasyPoints
            .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
            .map((player, index) => ({
                ...player,
                overallRank: index + 1
            }));

        const playersByPosition = {};
        rankedPlayers.forEach(player => {
            if (!playersByPosition[player.position]) {
                playersByPosition[player.position] = [];
            }
            playersByPosition[player.position].push(player);
        });

        Object.keys(playersByPosition).forEach(position => {
            playersByPosition[position]
                .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                .forEach((player, index) => {
                    player.positionRank = index + 1;
                });
        });

        const finalRankedPlayers = Object.values(playersByPosition).flat();

        await this.cache.setPlayerRankings(leagueId, year, finalRankedPlayers);
        this.rankingsCalculated.add(`${leagueId}-${year}`);

        console.log(`✅ BACKGROUND: Fantasy rankings calculated and stored for league ${leagueId}-${year}`);
        return true;
    }

    async enhancePlayersWithRankings(leagueId, year, players) {
        if (!leagueId || !year || !players.length) return players;

        const playerIds = players.map(p => p.id);
        const rankings = await this.cache.getPlayerRankings(leagueId, year, playerIds);

        return players.map(player => {
            const ranking = rankings.get(player.id);
            if (ranking) {
                return {
                    ...player,
                    overallRank: ranking.overallRank,
                    positionRank: ranking.positionRank,
                    fantasyPoints: ranking.fantasyPoints
                };
            }
            return player;
        });
    }

    async hasRankingsForLeague(leagueId, year) {
        if (this.rankingsCalculated.has(`${leagueId}-${year}`)) {
            return true;
        }
        
        const hasInDB = await this.cache.hasRankingsForLeague(leagueId, year);
        if (hasInDB) {
            this.rankingsCalculated.add(`${leagueId}-${year}`);
        }
        
        return hasInDB;
    }

    async getScoringRules(leagueId) {
        console.log(`🔍 getScoringRules called for league: ${leagueId}`);
        
        if (!leagueId) {
            console.log('❌ No leagueId provided to getScoringRules');
            return {};
        }
        
        const cachedRules = await this.cache.getScoringRules(leagueId);
        if (cachedRules) {
            console.log(`✅ Using cached scoring rules for ${leagueId}:`, Object.keys(cachedRules).length, 'rules');
            return { [leagueId]: cachedRules };
        }

        console.log(`🌐 Fetching scoring rules from API for league: ${leagueId}`);
        
        try {
            const response = await fetch(`/data/stats/rules?leagueId=${leagueId}`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`📊 API response received:`, data);
            
            if (data.success && data.scoringRules && data.scoringRules[leagueId]) {
                const rulesForLeague = data.scoringRules[leagueId];
                console.log(`💾 STORING ${Object.keys(rulesForLeague).length} scoring rules in IndexedDB for league ${leagueId}`);
                
                await this.cache.setScoringRules(leagueId, rulesForLeague);
                
                return { [leagueId]: rulesForLeague };
            } else {
                console.log(`⚠️ No scoring rules found in API response for league ${leagueId}`);
                return {};
            }
            
        } catch (error) {
            console.error(`❌ Error loading scoring rules for ${leagueId}:`, error);
            return {};
        }
    }

    async fetchFromAPI(year, week, position, page, limit = 50) {
        const params = new URLSearchParams({
            year,
            week,
            position,
            page: page.toString(),
            limit: limit.toString()
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
        
        this.rankingsCalculated.clear();
        console.log('🗑️ Cleared all caches and rankings');
    }
}

window.statsAPI = new StatsAPI();
