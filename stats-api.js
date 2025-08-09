// stats-api.js - New player-centric IndexedDB schema
class StatsCache {
    constructor() {
        this.dbName = 'nfl_stats_cache';
        this.version = 20; // New version for clean schema
        this.scoringRulesStore = 'scoring_rules';
        this.playersStore = 'players'; // Main store: YEAR.PlayerID.Position.Rank
        this.db = null;
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
                
                // Clear all old stores
                const existingStores = Array.from(db.objectStoreNames);
                existingStores.forEach(storeName => {
                    db.deleteObjectStore(storeName);
                });

                // Scoring rules store
                const rulesStore = db.createObjectStore(this.scoringRulesStore, { keyPath: 'leagueId' });
                rulesStore.createIndex('timestamp', 'timestamp', { unique: false });

                // Players store with composite key: YEAR.PlayerID.Position.Rank
                const playersStore = db.createObjectStore(this.playersStore, { keyPath: 'playerKey' });
                playersStore.createIndex('year', 'year', { unique: false });
                playersStore.createIndex('position', 'position', { unique: false });
                playersStore.createIndex('rank', 'rank', { unique: false });
                playersStore.createIndex('yearPosition', 'yearPosition', { unique: false });
                playersStore.createIndex('timestamp', 'timestamp', { unique: false });
                
                console.log(`✅ Created new clean schema`);
            };
        });
    }

    // Generate player key: YEAR.PlayerID.Position.Rank
    generatePlayerKey(year, playerId, position, rank) {
        return `${year}.${playerId}.${position}.${rank}`;
    }

    // Store player with stats for specific week/total
    async setPlayerRecord(year, player, rank, week, stats) {
        try {
            await this.init();
            
            const playerKey = this.generatePlayerKey(year, player.id, player.position, rank);
            const yearPosition = `${year}_${player.position}`;
            
            // Get existing record or create new one
            const transaction = this.db.transaction([this.playersStore], 'readwrite');
            const store = transaction.objectStore(this.playersStore);
            
            return new Promise((resolve, reject) => {
                const getRequest = store.get(playerKey);
                
                getRequest.onsuccess = () => {
                    let playerRecord = getRequest.result;
                    
                    if (!playerRecord) {
                        // Create new record
                        playerRecord = {
                            playerKey,
                            year: parseInt(year),
                            playerId: player.id,
                            name: player.name,
                            position: player.position,
                            team: player.team,
                            rank: rank,
                            yearPosition,
                            weeklyStats: {},
                            timestamp: new Date().toISOString()
                        };
                    }
                    
                    // Add/update stats for this week
                    playerRecord.weeklyStats[week] = stats;
                    playerRecord.timestamp = new Date().toISOString();
                    
                    const putRequest = store.put(playerRecord);
                    putRequest.onsuccess = () => resolve(playerRecord);
                    putRequest.onerror = () => reject(putRequest.error);
                };
                
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            console.error('Error storing player record:', error);
        }
    }

    // Get ranked players by position for a year
    async getRankedPlayersByPosition(year, position, limit = 50) {
        try {
            await this.init();
            
            const transaction = this.db.transaction([this.playersStore], 'readonly');
            const store = transaction.objectStore(this.playersStore);
            
            return new Promise((resolve, reject) => {
                const players = [];
                
                if (position === 'ALL') {
                    // Get all players for the year
                    const index = store.index('year');
                    const cursorRequest = index.openCursor(IDBKeyRange.only(parseInt(year)));
                    
                    cursorRequest.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && players.length < limit) {
                            const player = cursor.value;
                            
                            // Check if not expired (24 hours)
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
                            console.log(`✅ Retrieved ${players.length} players for ${year} ${position}`);
                            resolve(players.slice(0, limit));
                        }
                    };
                    
                    cursorRequest.onerror = () => reject(cursorRequest.error);
                } else {
                    // Get players for specific position
                    const index = store.index('yearPosition');
                    const yearPosition = `${year}_${position}`;
                    const cursorRequest = index.openCursor(IDBKeyRange.only(yearPosition));
                    
                    cursorRequest.onsuccess = (event) => {
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
                            console.log(`✅ Retrieved ${players.length} players for ${year} ${position}`);
                            resolve(players.slice(0, limit));
                        }
                    };
                    
                    cursorRequest.onerror = () => reject(cursorRequest.error);
                }
            });
        } catch (error) {
            console.error('Error getting ranked players:', error);
            return [];
        }
    }

    // Get player stats for specific week
    getPlayerStatsForWeek(playerRecord, week) {
        if (!playerRecord.weeklyStats) return null;
        return playerRecord.weeklyStats[week] || null;
    }

    // Check if we have players for a year
    async hasPlayersForYear(year) {
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
            console.error('Error checking players for year:', error);
            return false;
        }
    }

    // Store all ranked players for a year with season total stats
    async storeRankedPlayersForYear(year, rankedPlayers) {
        try {
            console.log(`💾 Storing ${rankedPlayers.length} ranked players for year ${year}`);
            
            const storePromises = rankedPlayers.map((player, index) => {
                const rank = index + 1;
                return this.setPlayerRecord(year, player, rank, 'total', player.stats);
            });
            
            await Promise.all(storePromises);
            console.log(`✅ Stored all ${rankedPlayers.length} ranked players for year ${year}`);
        } catch (error) {
            console.error('Error storing ranked players:', error);
        }
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
                    
                    const now = new Date();
                    const cachedTime = new Date(result.timestamp);
                    const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                    
                    if (diffHours > 24) {
                        resolve(null);
                        return;
                    }
                    
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
                    console.log(`✅ Cached scoring rules for ${leagueId}`);
                    resolve();
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error setting scoring rules cache:', error);
        }
    }

    async clearAll() {
        try {
            await this.init();
            
            const storeNames = [this.scoringRulesStore, this.playersStore];
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

// StatsAPI class
class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/stats';
        this.cache = new StatsCache();
        this.yearDataLoaded = new Set();
    }

    // Main method to get players for display
    async getPlayersForDisplay(year = '2024', week = 'total', position = 'ALL', limit = 50) {
        console.log(`🎯 Getting players for display: ${year}, ${week}, ${position}`);
        
        // Check if we have players for this year
        const hasPlayers = await this.cache.hasPlayersForYear(year);
        
        if (!hasPlayers) {
            console.log(`📊 No players found for year ${year}, loading from API...`);
            await this.loadAndRankAllPlayersForYear(year);
        }
        
        // Get ranked players from IndexedDB
        const rankedPlayers = await this.cache.getRankedPlayersByPosition(year, position, limit);
        
        // Convert to display format with stats for the requested week
        const displayPlayers = rankedPlayers.map(playerRecord => {
            const stats = this.cache.getPlayerStatsForWeek(playerRecord, week);
            
            if (!stats) return null;
            
            return {
                id: playerRecord.playerId,
                name: playerRecord.name,
                position: playerRecord.position,
                team: playerRecord.team,
                overallRank: playerRecord.rank,
                stats: convertStatsForDisplay(stats),
                rawStats: stats
            };
        }).filter(Boolean);
        
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

    // Load all players for a year and rank them
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
            
            // Store ranked players in IndexedDB
            await this.cache.storeRankedPlayersForYear(year, allPlayersData.data);
            
            this.yearDataLoaded.add(year);
            console.log(`✅ Completed loading and ranking for year ${year}`);
            
        } catch (error) {
            console.error(`❌ Error loading players for year ${year}:`, error);
            throw error;
        }
    }

    // Add weekly stats to existing player records
    async addWeeklyStatsForPlayers(year, week, players) {
        console.log(`📊 Adding weekly stats for week ${week}, year ${year}`);
        
        const promises = players.map(async (player) => {
            // Find the player's rank from existing records
            const rankedPlayers = await this.cache.getRankedPlayersByPosition(year, player.position, 9999);
            const playerRecord = rankedPlayers.find(p => p.playerId === player.id);
            
            if (playerRecord) {
                return this.cache.setPlayerRecord(year, player, playerRecord.rank, week, player.stats);
            }
        });
        
        try {
            await Promise.all(promises.filter(Boolean));
            console.log(`✅ Added weekly stats for ${players.length} players`);
        } catch (error) {
            console.error('Error adding weekly stats:', error);
        }
    }

    // Get scoring rules
    async getScoringRules(leagueId) {
        console.log(`🔍 getScoringRules called for league: ${leagueId}`);
        
        if (!leagueId) {
            console.log('❌ No leagueId provided to getScoringRules');
            return {};
        }
        
        const cachedRules = await this.cache.getScoringRules(leagueId);
        if (cachedRules) {
            console.log(`✅ Using cached scoring rules for ${leagueId}`);
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

    // Fetch from API
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

    async clearCache() {
        await this.cache.clearAll();
        this.yearDataLoaded.clear();
        console.log('🗑️ Cleared all caches');
    }
}

window.statsAPI = new StatsAPI();
