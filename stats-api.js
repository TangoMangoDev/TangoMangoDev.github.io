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
        // NEW: In-memory player rankings by league
        this.playerRankings = new Map(); // leagueId -> ranked player data
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

    // NEW: Calculate and store fantasy rankings for a league
    async calculateFantasyRankings(leagueId, allPlayers, scoringRules) {
        if (!leagueId || !allPlayers || !scoringRules) {
            console.log('❌ Missing data for fantasy rankings calculation');
            return;
        }

        console.log(`🏆 Calculating fantasy rankings for league ${leagueId} with ${allPlayers.length} players`);

        // Calculate fantasy points for each player
        const playersWithFantasyPoints = allPlayers.map(player => {
            let totalFantasyPoints = 0;

            // Calculate total fantasy points using raw stats and scoring rules
            Object.entries(player.rawStats || {}).forEach(([statId, statValue]) => {
                if (scoringRules[statId] && statValue > 0) {
                    const rule = scoringRules[statId];
                    
                    // Base points
                    let points = statValue * parseFloat(rule.points || 0);
                    
                    // Add bonuses
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

        // Sort by fantasy points (highest first) and assign overall rank
        const rankedPlayers = playersWithFantasyPoints
            .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
            .map((player, index) => ({
                ...player,
                overallRank: index + 1
            }));

        // Calculate position-specific ranks
        const positionRanks = {};
        
        // Group by position and rank within each position
        const playersByPosition = rankedPlayers.reduce((acc, player) => {
            if (!acc[player.position]) acc[player.position] = [];
            acc[player.position].push(player);
            return acc;
        }, {});

        // Assign position ranks
        Object.entries(playersByPosition).forEach(([position, players]) => {
            players
                .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                .forEach((player, index) => {
                    player.positionRank = index + 1;
                });
        });

        // Store rankings in memory
        this.playerRankings.set(leagueId, {
            players: rankedPlayers,
            lastUpdated: Date.now(),
            totalPlayers: rankedPlayers.length,
            positionCounts: Object.fromEntries(
                Object.entries(playersByPosition).map(([pos, players]) => [pos, players.length])
            )
        });

        console.log(`✅ Fantasy rankings calculated for league ${leagueId}:`, {
            totalPlayers: rankedPlayers.length,
            positionCounts: Object.fromEntries(
                Object.entries(playersByPosition).map(([pos, players]) => [pos, players.length])
            )
        });

        return rankedPlayers;
    }

    // NEW: Get ranked players for a league
    getRankedPlayers(leagueId, position = 'ALL', limit = null) {
        const rankings = this.playerRankings.get(leagueId);
        
        if (!rankings) {
            console.log(`⚠️ No rankings found for league ${leagueId}`);
            return [];
        }

        let players = rankings.players;

        // Filter by position if specified
        if (position && position !== 'ALL') {
            players = players.filter(p => p.position === position);
        }

        // Apply limit if specified
        if (limit) {
            players = players.slice(0, limit);
        }

        return players;
    }

    // NEW: Check if rankings exist and are recent
    hasRecentRankings(leagueId, maxAgeHours = 24) {
        const rankings = this.playerRankings.get(leagueId);
        
        if (!rankings) return false;
        
        const age = (Date.now() - rankings.lastUpdated) / (1000 * 60 * 60);
        return age < maxAgeHours;
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
        
        // Clear rankings too
        this.playerRankings.clear();
        console.log('🗑️ Cleared player rankings');
    }
}

// Global API instance
window.statsAPI = new StatsAPI();
