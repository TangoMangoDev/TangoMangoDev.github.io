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
    playersStore.createIndex('rank', 'rank', { unique: false }); // This is the key index for sorting
    playersStore.createIndex('yearPosition', 'yearPosition', { unique: false });
    playersStore.createIndex('yearRank', 'yearRank', { unique: false }); // Composite index for year + rank
    playersStore.createIndex('timestamp', 'timestamp', { unique: false });
    
    console.log(`✅ Created new clean schema with proper rank indexing`);
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
        const yearRank = `${year}_${rank.toString().padStart(6, '0')}`; // Pad rank for proper sorting
        
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
                        yearRank, // Add this for sorting
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
 // FIXED: Get ranked players by position for a year - PROPERLY SORTED BY RANK
async getRankedPlayersByPosition(year, position, limit = 50) {
    try {
        await this.init();
        
        const transaction = this.db.transaction([this.playersStore], 'readonly');
        const store = transaction.objectStore(this.playersStore);
        
        return new Promise((resolve, reject) => {
            const players = [];
            
            if (position === 'ALL') {
                // Get all players for the year using the RANK INDEX
                const index = store.index('rank');
                const cursorRequest = index.openCursor();
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {  // 👈 REMOVE THE LIMIT CHECK HERE
                        const player = cursor.value;
                        
                        // Only include players from the correct year
                        if (player.year === parseInt(year)) {
                            // Check if not expired (24 hours)
                            const now = new Date();
                            const cachedTime = new Date(player.timestamp);
                            const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                            
                            if (diffHours < 24) {
                                players.push(player);
                                
                                // 👈 CHECK LIMIT AFTER ADDING VALID PLAYER
                                if (players.length >= limit) {
                                    console.log(`✅ Retrieved TOP ${players.length} ranked players for ${year} ${position}`);
                                    resolve(players);
                                    return;
                                }
                            }
                        }
                        cursor.continue();
                    } else {
                        // No more records
                        console.log(`✅ Retrieved TOP ${players.length} ranked players for ${year} ${position}`);
                        resolve(players);
                    }
                };
                
                cursorRequest.onerror = () => reject(cursorRequest.error);
            } else {
                // Similar fix for position-specific queries
                const index = store.index('yearPosition');
                const yearPosition = `${year}_${position}`;
                const cursorRequest = index.openCursor(IDBKeyRange.only(yearPosition));
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const player = cursor.value;
                        
                        // Check if not expired
                        const now = new Date();
                        const cachedTime = new Date(player.timestamp);
                        const diffHours = (now - cachedTime) / (1000 * 60 * 60);
                        
                        if (diffHours < 24) {
                            players.push(player);
                            
                            // 👈 CHECK LIMIT AFTER ADDING VALID PLAYER
                            if (players.length >= limit) {
                                // Still need to sort by rank for position filtering
                                players.sort((a, b) => a.rank - b.rank);
                                console.log(`✅ Retrieved TOP ${players.length} ranked ${position} players for ${year}`);
                                resolve(players);
                                return;
                            }
                        }
                        cursor.continue();
                    } else {
                        // MANUALLY sort by rank for position filtering
                        players.sort((a, b) => a.rank - b.rank);
                        console.log(`✅ Retrieved TOP ${players.length} ranked ${position} players for ${year}`);
                        resolve(players);
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
// Updated StatsCache method to properly store ranked players
async storeRankedPlayersForYear(year, rankedPlayers) {
    try {
        console.log(`💾 Storing ${rankedPlayers.length} ranked players for year ${year}`);
        
        const storePromises = rankedPlayers.map((player) => {
            // Use the player's calculated rank
            const rank = player.rank || 999999;
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
// Updated StatsAPI class with weekly stats fetching
// Updated StatsAPI class with proper ranking logic
class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/stats';
        this.weeklyUrl = '/data/stats/weekly';
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
        
        // If requesting weekly data, fetch it from backend and update IndexedDB
        if (week !== 'total') {
            console.log(`📅 Fetching weekly stats for week ${week}...`);
            await this.fetchAndStoreWeeklyStats(year, week, rankedPlayers);
            
            // After storing weekly stats, get updated player records
            const updatedPlayers = await this.cache.getRankedPlayersByPosition(year, position, limit);
            
            // Convert to display format with weekly stats
            const displayPlayers = updatedPlayers.map(playerRecord => {
                const stats = this.cache.getPlayerStatsForWeek(playerRecord, week);
                
                if (!stats) return null;
                
                return {
                    id: playerRecord.playerId,
                    name: playerRecord.name,
                    position: playerRecord.position,
                    team: playerRecord.team,
                    overallRank: playerRecord.rank,
                    stats: window.convertStatsForDisplay ? window.convertStatsForDisplay(stats) : stats,
                    rawStats: stats
                };
            }).filter(Boolean);
            
            console.log(`✅ Returning ${displayPlayers.length} players for display (week ${week})`);
            
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
        } else {
            // For season totals, use existing logic
            const displayPlayers = rankedPlayers.map(playerRecord => {
                const stats = this.cache.getPlayerStatsForWeek(playerRecord, week);
                
                if (!stats) return null;
                
                return {
                    id: playerRecord.playerId,
                    name: playerRecord.name,
                    position: playerRecord.position,
                    team: playerRecord.team,
                    overallRank: playerRecord.rank,
                    stats: window.convertStatsForDisplay ? window.convertStatsForDisplay(stats) : stats,
                    rawStats: stats
                };
            }).filter(Boolean);
            
            console.log(`✅ Returning ${displayPlayers.length} players for display (season total)`);
            
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
    }

    // FIXED: Load all players for a year and rank them by fantasy points
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
            
            // CALCULATE FANTASY POINTS AND RANK PLAYERS
            console.log(`🏆 Calculating fantasy points and ranking players...`);
            
            // Calculate total fantasy points for each player
            const playersWithFantasyPoints = allPlayersData.data.map(player => {
                let totalFantasyPoints = 0;
                
                // Calculate fantasy points using season total stats
 // REPLACE the existing fantasy points calculation in loadAndRankAllPlayersForYear method
// Calculate fantasy points using season total stats
if (player.stats && typeof player.stats === 'object') {
    Object.entries(player.stats).forEach(([statId, statValue]) => {
        if (statValue && statValue !== 0) {
            switch(statId) {
                case '4': // Pass Yds (CORRECT)
                    totalFantasyPoints += statValue * 0.04;
                    break;
                case '5': // Pass TD (CORRECT)
                    totalFantasyPoints += statValue * 4;
                    break;
                case '6': // Int (CORRECT)
                    totalFantasyPoints -= statValue * 2;
                    break;
                case '9': // Rush Yds (CORRECT)
                    totalFantasyPoints += statValue * 0.1;
                    break;
                case '10': // Rush TD (CORRECT)
                    totalFantasyPoints += statValue * 6;
                    break;
                case '11': // Rec (CORRECT)
                    totalFantasyPoints += statValue * 1;
                    break;
                case '12': // Rec Yds (CORRECT)
                    totalFantasyPoints += statValue * 0.1;
                    break;
                case '13': // Rec TD (CORRECT)
                    totalFantasyPoints += statValue * 6;
                    break;
                case '17': // Fum (CORRECT)
                    totalFantasyPoints -= statValue * 2;
                    break;
                case '18': // Fum Lost (CORRECT)
                    totalFantasyPoints -= statValue * 2;
                    break;
                // Add more stats as needed for kickers and defense
                case '19': case '20': case '21': case '22': case '23': // FG Made
                    totalFantasyPoints += statValue * 3;
                    break;
                case '29': // PAT Made
                    totalFantasyPoints += statValue * 1;
                    break;
                // Defense stats
                case '32': case '40': // Sack (appears twice in mapping)
                    totalFantasyPoints += statValue * 1;
                    break;
                case '33': case '41': // Int (defense)
                    totalFantasyPoints += statValue * 2;
                    break;
                case '34': case '43': // Fum Rec
                    totalFantasyPoints += statValue * 2;
                    break;
                case '35': case '44': // TD (defense)
                    totalFantasyPoints += statValue * 6;
                    break;
                case '36': case '45': // Safe
                    totalFantasyPoints += statValue * 2;
                    break;
            }
        }
    });
}
                
                return {
                    ...player,
                    fantasyPoints: Math.round(totalFantasyPoints * 100) / 100
                };
            });
            
            // RANK PLAYERS BY FANTASY POINTS
            const rankedPlayers = playersWithFantasyPoints
                .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
                .map((player, index) => ({
                    ...player,
                    rank: index + 1
                }));
            
            console.log(`🏆 Ranked ${rankedPlayers.length} players by fantasy points`);
            console.log(`🥇 Top 5 players:`, rankedPlayers.slice(0, 5).map(p => 
                `${p.name} (${p.position}) - ${p.fantasyPoints} pts`
            ));
            
            // Store ranked players in IndexedDB
            await this.cache.storeRankedPlayersForYear(year, rankedPlayers);
            
            this.yearDataLoaded.add(year);
            console.log(`✅ Completed loading and ranking for year ${year}`);
            
        } catch (error) {
            console.error(`❌ Error loading players for year ${year}:`, error);
            throw error;
        }
    }

    // NEW: Fetch weekly stats for players and store in IndexedDB
    async fetchAndStoreWeeklyStats(year, week, rankedPlayers) {
        try {
            // Check if any players already have weekly stats
            const playersNeedingStats = rankedPlayers.filter(player => 
                !this.cache.getPlayerStatsForWeek(player, week)
            );
            
            if (playersNeedingStats.length === 0) {
                console.log(`✅ All players already have stats for week ${week}`);
                return;
            }
            
            const playerIds = playersNeedingStats.map(p => p.playerId);
            console.log(`📅 Fetching weekly stats for ${playerIds.length} players, week ${week}`);
            
            const params = new URLSearchParams({
                year,
                week,
                playerIds: playerIds.join(',')
            });

            const url = `${this.weeklyUrl}?${params}`;
            console.log(`🌐 Fetching weekly stats: ${url}`);

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
                throw new Error(data.error || 'Weekly stats request failed');
            }

            console.log(`✅ Fetched weekly stats for ${data.count} players`);
            
            // Store weekly stats in IndexedDB
            const storePromises = data.data.map(player => {
                const rankedPlayer = rankedPlayers.find(rp => rp.playerId === player.id);
                if (rankedPlayer) {
                    return this.cache.setPlayerRecord(year, player, rankedPlayer.rank, week, player.stats);
                }
            });
            
            await Promise.all(storePromises.filter(Boolean));
            console.log(`✅ Stored weekly stats for week ${week} in IndexedDB`);
            
        } catch (error) {
            console.error(`❌ Error fetching weekly stats for week ${week}:`, error);
            // Don't throw - allow the system to continue with whatever data it has
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

    // Fetch from API (for season totals)
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
