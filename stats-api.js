// stats-api.js - Pure API layer with IndexedDB caching
class StatsCache {
    constructor() {
        this.dbName = 'nfl_stats_cache';
        this.version = 12; // Increment for this fix
        this.storeName = 'stats';
        this.scoringRulesStore = 'scoring_rules';
        this.rawDataStore = 'raw_data';
        this.rankingsStore = 'rankings';
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

                // Raw data store
                if (!db.objectStoreNames.contains(this.rawDataStore)) {
                    const rawStore = db.createObjectStore(this.rawDataStore, { keyPath: 'year' });
                    rawStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // UNIFIED rankings store with proper composite key structure
                if (!db.objectStoreNames.contains(this.rankingsStore)) {
                    const rankStore = db.createObjectStore(this.rankingsStore, { keyPath: 'compositeKey' });
                    // Key index for efficient league-year queries
                    rankStore.createIndex('leagueYear', 'leagueYear', { unique: false });
                    rankStore.createIndex('overallRank', 'overallRank', { unique: false });
                    rankStore.createIndex('positionRank', 'positionRank', { unique: false });
                    rankStore.createIndex('position', 'position', { unique: false });
                    rankStore.createIndex('fantasyPoints', 'fantasyPoints', { unique: false });
                    rankStore.createIndex('timestamp', 'timestamp', { unique: false });
                    //console.log(`✅ Created unified rankings store`);
                }
            };
        });
    }

    // Generate proper composite keys
    getRankingKey(leagueId, year, playerId) {
        return `${leagueId}_${year}_${playerId}`;
    }

    getLeagueYearKey(leagueId, year) {
        return `${leagueId}_${year}`;
    }

    async hasRankingsForLeague(leagueId, year) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.rankingsStore], 'readonly');
            const store = transaction.objectStore(this.rankingsStore);
            const index = store.index('leagueYear');
            
            return new Promise((resolve) => {
                const leagueYearKey = this.getLeagueYearKey(leagueId, year);
                const countRequest = index.count(IDBKeyRange.only(leagueYearKey));
                
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
            await this.init();
            
            const transaction = this.db.transaction([this.rankingsStore], 'readwrite');
            const store = transaction.objectStore(this.rankingsStore);
            
            // Clear existing rankings for this league-year using the index
            const index = store.index('leagueYear');
            const leagueYearKey = this.getLeagueYearKey(leagueId, year);
            const keyRange = IDBKeyRange.only(leagueYearKey);
            
            await new Promise((resolve, reject) => {
                const deleteRequest = index.openCursor(keyRange);
                
                deleteRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                
                deleteRequest.onerror = () => reject(deleteRequest.error);
            });
            
            // Add new rankings with proper composite keys
            const addPromises = rankedPlayers.map(player => {
                return new Promise((addResolve, addReject) => {
                    const rankData = {
                        compositeKey: this.getRankingKey(leagueId, year, player.id),
                        leagueYear: this.getLeagueYearKey(leagueId, year),
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
            console.log(`✅ Stored ${rankedPlayers.length} rankings for ${leagueId}-${year}`);
            
        } catch (error) {
            console.error('Error storing player rankings:', error);
        }
    }

    async getPlayerRankings(leagueId, year, playerIds) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.rankingsStore], 'readonly');
            const store = transaction.objectStore(this.rankingsStore);
            
            return new Promise((resolve, reject) => {
                const rankings = new Map();
                let completed = 0;
                const total = playerIds.length;
                
                if (total === 0) {
                    resolve(rankings);
                    return;
                }
                
                playerIds.forEach(playerId => {
                    const compositeKey = this.getRankingKey(leagueId, year, playerId);
                    const request = store.get(compositeKey);
                    
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
                            console.log(`✅ Retrieved ${rankings.size}/${total} player rankings`);
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

    // NEW: Get top 50 ranked players efficiently using index
    async getTop50Rankings(leagueId, year) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.rankingsStore], 'readonly');
            const store = transaction.objectStore(this.rankingsStore);
            const leagueYearIndex = store.index('leagueYear');
            
            return new Promise((resolve, reject) => {
                const rankings = [];
                const leagueYearKey = this.getLeagueYearKey(leagueId, year);
                const keyRange = IDBKeyRange.only(leagueYearKey);
                
                const request = leagueYearIndex.openCursor(keyRange);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const ranking = cursor.value;
                        
                        // Check if not expired
                        const now = new Date();
                        const cachedTime = new Date(ranking.timestamp);
                        const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                        
                        if (diffHours < 24) {
                            rankings.push(ranking);
                        }
                        
                        cursor.continue();
                    } else {
                        // Sort by overall rank and take top 50
                        const top50 = rankings
                            .sort((a, b) => a.overallRank - b.overallRank)
                            .slice(0, 50);
                        
                        console.log(`✅ Retrieved top 50 rankings from ${rankings.length} total for ${leagueId}-${year}`);
                        resolve(top50);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error getting top 50 rankings:', error);
            return [];
        }
    }

    // All other methods stay exactly the same...
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
            
            const storeNames = [this.storeName, this.scoringRulesStore, this.rawDataStore, this.rankingsStore];
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
// stats-api.js - Enhanced with new player-centric schema
class StatsCache {
    constructor() {
        this.dbName = 'nfl_stats_cache';
        this.version = 15; // Increment for new schema
        this.storeName = 'stats';
        this.scoringRulesStore = 'scoring_rules';
        this.playersStore = 'players'; // NEW: Individual player records
        this.rankingsStore = 'rankings';
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
                
                // Legacy stats store (keep for compatibility)
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

                // NEW: Individual player records store
                if (!db.objectStoreNames.contains(this.playersStore)) {
                    const playersStore = db.createObjectStore(this.playersStore, { keyPath: 'playerKey' });
                    // Indexes for efficient querying
                    playersStore.createIndex('year', 'year', { unique: false });
                    playersStore.createIndex('position', 'position', { unique: false });
                    playersStore.createIndex('rank', 'rank', { unique: false });
                    playersStore.createIndex('yearPosition', 'yearPosition', { unique: false });
                    playersStore.createIndex('yearRank', 'yearRank', { unique: false });
                    playersStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log(`✅ Created players store with indexes`);
                }
                
                // Rankings store (simplified)
                if (!db.objectStoreNames.contains(this.rankingsStore)) {
                    const rankStore = db.createObjectStore(this.rankingsStore, { keyPath: 'compositeKey' });
                    rankStore.createIndex('leagueYear', 'leagueYear', { unique: false });
                    rankStore.createIndex('overallRank', 'overallRank', { unique: false });
                    rankStore.createIndex('positionRank', 'positionRank', { unique: false });
                    rankStore.createIndex('position', 'position', { unique: false });
                    rankStore.createIndex('fantasyPoints', 'fantasyPoints', { unique: false });
                    rankStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // NEW: Generate player key - YEAR.PlayerID.Position.Rank
    generatePlayerKey(year, playerId, position, rank) {
        return `${year}.${playerId}.${position}.${rank || 0}`;
    }

    // NEW: Store individual player with all their weekly stats
    async setPlayerRecord(year, player, rank = null) {
        try {
            await this.init();
            
            const playerKey = this.generatePlayerKey(year, player.id, player.position, rank);
            const yearPosition = `${year}_${player.position}`;
            const yearRank = `${year}_${rank || 999999}`;
            
            const playerRecord = {
                playerKey,
                year: parseInt(year),
                playerId: player.id,
                name: player.name,
                position: player.position,
                team: player.team,
                rank: rank || 999999,
                yearPosition,
                yearRank,
                // Store ALL weekly stats + season total
                weeklyStats: {
                    total: player.stats // Season total stats
                },
                timestamp: new Date().toISOString()
            };
            
            const transaction = this.db.transaction([this.playersStore], 'readwrite');
            const store = transaction.objectStore(this.playersStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(playerRecord);
                request.onsuccess = () => resolve(playerRecord);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error storing player record:', error);
        }
    }

    // NEW: Add weekly stats to existing player record
    async addWeeklyStatsToPlayer(year, playerId, position, week, stats) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.playersStore], 'readwrite');
            const store = transaction.objectStore(this.playersStore);
            const index = store.index('year');
            
            return new Promise((resolve, reject) => {
                // Find the player record for this year
                const yearRange = IDBKeyRange.only(parseInt(year));
                const request = index.openCursor(yearRange);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const playerRecord = cursor.value;
                        if (playerRecord.playerId === playerId && playerRecord.position === position) {
                            // Add the weekly stats
                            if (!playerRecord.weeklyStats) {
                                playerRecord.weeklyStats = {};
                            }
                            playerRecord.weeklyStats[week] = stats;
                            playerRecord.timestamp = new Date().toISOString();
                            
                            const updateRequest = cursor.update(playerRecord);
                            updateRequest.onsuccess = () => resolve(playerRecord);
                            updateRequest.onerror = () => reject(updateRequest.error);
                        } else {
                            cursor.continue();
                        }
                    } else {
                        reject(new Error(`Player ${playerId} not found for year ${year}`));
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error adding weekly stats:', error);
        }
    }

    // NEW: Get ranked players by position for a year
    async getRankedPlayersByPosition(year, position, limit = 50) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.playersStore], 'readonly');
            const store = transaction.objectStore(this.playersStore);
            
            return new Promise((resolve, reject) => {
                const players = [];
                const yearPosition = position === 'ALL' ? null : `${year}_${position}`;
                
                if (position === 'ALL') {
                    // Get all players for the year, sorted by rank
                    const index = store.index('yearRank');
                    const yearPattern = `${year}_`;
                    const range = IDBKeyRange.bound(yearPattern, yearPattern + '\uffff');
                    const request = index.openCursor(range);
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && players.length < limit) {
                            const player = cursor.value;
                            
                            // Check if not expired
                            const now = new Date();
                            const cachedTime = new Date(player.timestamp);
                            const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                            
                            if (diffHours < 24) {
                                players.push(player);
                            }
                            cursor.continue();
                        } else {
                            console.log(`✅ Retrieved ${players.length} ranked players for year ${year}, position ${position}`);
                            resolve(players);
                        }
                    };
                } else {
                    // Get players for specific position
                    const index = store.index('yearPosition');
                    const request = index.openCursor(IDBKeyRange.only(yearPosition));
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && players.length < limit) {
                            const player = cursor.value;
                            
                            // Check if not expired
                            const now = new Date();
                            const cachedTime = new Date(player.timestamp);
                            const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                            
                            if (diffHours < 24) {
                                players.push(player);
                            }
                            cursor.continue();
                        } else {
                            // Sort by rank
                            players.sort((a, b) => a.rank - b.rank);
                            console.log(`✅ Retrieved ${players.length} ranked players for year ${year}, position ${position}`);
                            resolve(players.slice(0, limit));
                        }
                    };
                }
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error getting ranked players:', error);
            return [];
        }
    }

    // NEW: Get player stats for specific week
    getPlayerStatsForWeek(playerRecord, week) {
        if (!playerRecord.weeklyStats) return null;
        
        // Return the requested week's stats or season total
        return playerRecord.weeklyStats[week] || playerRecord.weeklyStats.total || null;
    }

    // NEW: Check if we have ranked players for a year
    async hasRankedPlayersForYear(year) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.playersStore], 'readonly');
            const store = transaction.objectStore(this.playersStore);
            const index = store.index('year');
            
            return new Promise((resolve) => {
                const countRequest = index.count(IDBKeyRange.only(parseInt(year)));
                
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    console.log(`📊 Found ${count} player records for year ${year}`);
                    resolve(count > 0);
                };
                
                countRequest.onerror = () => resolve(false);
            });
        } catch (error) {
            console.error('Error checking ranked players:', error);
            return false;
        }
    }

    // NEW: Store all ranked players for a year
    async storeRankedPlayersForYear(year, rankedPlayers) {
        try {
            console.log(`💾 Storing ${rankedPlayers.length} ranked players for year ${year}`);
            
            const storePromises = rankedPlayers.map((player, index) => {
                const rank = index + 1;
                return this.setPlayerRecord(year, player, rank);
            });
            
            await Promise.all(storePromises);
            console.log(`✅ Stored all ${rankedPlayers.length} ranked players for year ${year}`);
        } catch (error) {
            console.error('Error storing ranked players:', error);
        }
    }

    // All existing methods remain the same...
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

    // Legacy methods for compatibility
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
            
            const storeNames = [this.storeName, this.playersStore];
            const transaction = this.db.transaction(storeNames, 'readwrite');
            
            if (year) {
                // Clear specific year from both stores
                const promises = storeNames.map(storeName => {
                    return new Promise((resolve, reject) => {
                        const store = transaction.objectStore(storeName);
                        const index = store.index('year');
                        const request = index.openCursor(IDBKeyRange.only(parseInt(year)));
                        
                        request.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                cursor.delete();
                                cursor.continue();
                            } else {
                                resolve();
                            }
                        };
                        
                        request.onerror = () => reject(request.error);
                    });
                });
                
                await Promise.all(promises);
                console.log(`🗑️ Cleared cache for year ${year}`);
            }
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    async clearAll() {
        try {
            await this.init();
            
            const storeNames = [this.storeName, this.scoringRulesStore, this.playersStore, this.rankingsStore];
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

// Enhanced StatsAPI class with new player-centric approach
class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/stats';
        this.cache = new StatsCache();
        this.currentRequests = new Map();
        this.yearDataLoaded = new Set(); // Track which years have been fully loaded
    }

    // NEW: Main method to get players for display
    async getPlayersForDisplay(year = '2024', week = 'total', position = 'ALL', limit = 50) {
        console.log(`🎯 Getting players for display: ${year}, ${week}, ${position}, limit: ${limit}`);
        
        // Check if we have ranked players for this year
        const hasRankedPlayers = await this.cache.hasRankedPlayersForYear(year);
        
        if (!hasRankedPlayers) {
            console.log(`📊 No ranked players found for year ${year}, loading from API...`);
            await this.loadAndRankAllPlayersForYear(year);
        }
        
        // Get ranked players from IndexedDB
        const rankedPlayers = await this.cache.getRankedPlayersByPosition(year, position, limit);
        
        // Convert to display format with stats for the requested week
        const displayPlayers = rankedPlayers.map(playerRecord => {
            const stats = this.cache.getPlayerStatsForWeek(playerRecord, week);
            
            return {
                id: playerRecord.playerId,
                name: playerRecord.name,
                position: playerRecord.position,
                team: playerRecord.team,
                overallRank: playerRecord.rank,
                stats: convertStatsForDisplay(stats || {}),
                rawStats: stats || {}
            };
        }).filter(player => player.stats && Object.keys(player.stats).length > 0);
        
        console.log(`✅ Returning ${displayPlayers.length} players for display`);
        
        return {
            success: true,
            data: displayPlayers,
            count: displayPlayers.length,
            pagination: {
                totalRecords: displayPlayers.length,
                currentPage: 1,
                totalPages: 1
            }
        };
    }

    // NEW: Load all players for a year and rank them
    async loadAndRankAllPlayersForYear(year) {
        if (this.yearDataLoaded.has(year)) {
            console.log(`✅ Year ${year} already loaded and ranked`);
            return;
        }
        
        console.log(`🚀 Loading and ranking ALL players for year ${year}...`);
        
        try {
            // Fetch ALL players for the year (season totals)
            const allPlayersData = await this.fetchFromAPI(year, 'total', 'ALL', 1, 9999);
            
            if (!allPlayersData.success || !allPlayersData.data) {
                throw new Error('Failed to fetch players from API');
            }
            
            console.log(`📊 Fetched ${allPlayersData.data.length} players from API for year ${year}`);
            
            // Store ranked players in new schema
            await this.cache.storeRankedPlayersForYear(year, allPlayersData.data);
            
            this.yearDataLoaded.add(year);
            console.log(`✅ Completed loading and ranking for year ${year}`);
            
        } catch (error) {
            console.error(`❌ Error loading players for year ${year}:`, error);
            throw error;
        }
    }

    // NEW: Add weekly stats to existing player records
    async addWeeklyStatsForPlayers(year, week, players) {
        console.log(`📊 Adding weekly stats for week ${week}, year ${year}`);
        
        const promises = players.map(player => {
            return this.cache.addWeeklyStatsToPlayer(year, player.id, player.position, week, player.stats);
        });
        
        try {
            await Promise.all(promises);
            console.log(`✅ Added weekly stats for ${players.length} players`);
        } catch (error) {
            console.error('Error adding weekly stats:', error);
        }
    }

    // Enhanced method that uses new schema first, falls back to legacy
    async getPlayersData(year = '2024', week = 'total', position = 'ALL', page = 1, limit = 50) {
        console.log(`🔍 getPlayersData called: ${year}, ${week}, ${position}, page ${page}`);
        
        // Try new schema first
        if (week === 'total') {
            try {
                return await this.getPlayersForDisplay(year, week, position, limit);
            } catch (error) {
                console.warn('New schema failed, falling back to legacy:', error);
            }
        }
        
        // Fall back to legacy caching for weekly data or if new schema fails
        return await this.getPlayersDataLegacy(year, week, position, page, limit);
    }

    // Legacy method for weekly data that's not in new schema yet
    async getPlayersDataLegacy(year = '2024', week = 'total', position = 'ALL', page = 1, limit = 50) {
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
                
                // If this is weekly data, try to add it to existing player records
                if (week !== 'total' && data.data) {
                    await this.addWeeklyStatsForPlayers(year, week, data.data);
                }
                
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

    // Calculate fantasy rankings and store in new schema
    async calculateAndStoreFantasyRankings(leagueId, year, allPlayers, scoringRules) {
        if (!leagueId || !year || !allPlayers || !scoringRules) {
            console.log('❌ Missing data for fantasy rankings calculation');
            return false;
        }

        console.log(`🏆 Calculating fantasy rankings for league ${leagueId}-${year} with ${allPlayers.length} players`);

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

        // Sort by fantasy points and assign ranks
        const rankedPlayers = playersWithFantasyPoints
            .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
            .map((player, index) => ({
                ...player,
                overallRank: index + 1
            }));

        // Calculate position ranks
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

        // Store in both new player schema and legacy rankings
        await this.cache.storeRankedPlayersForYear(year, finalRankedPlayers);
        
        console.log(`✅ Fantasy rankings calculated and stored for league ${leagueId}-${year}`);
        return true;
    }

    // Legacy methods for compatibility
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
            this.yearDataLoaded.delete(year);
        } else {
            await this.cache.clearAll();
            this.yearDataLoaded.clear();
        }
        
        console.log('🗑️ Cleared all caches and rankings');
    }
}

window.statsAPI = new StatsAPI
