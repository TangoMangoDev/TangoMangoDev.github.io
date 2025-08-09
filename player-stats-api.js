// player-stats-api.js - FIXED with complete week checking and fetching
class PlayerStatsAPI extends StatsAPI {
    constructor() {
        super();
        this.playerDataCache = new Map();
        this.baseMissingWeeksUrl = '/data/stats/player/missing-weeks';
        this.allWeeks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
    }

    // FIXED: Ensure IndexedDB is properly initialized
    async ensureInitialized() {
        if (!this.cache.db) {
            console.log('🔄 Initializing IndexedDB for player stats...');
            await this.cache.init();
        }
        return this.cache.db;
    }

    // Main method to get ALL data for a specific player across years/weeks
    async getPlayerCompleteStats(playerId) {
        console.log(`🎯 Getting complete stats for player: ${playerId}`);
        
        try {
            const allPlayerData = {
                playerId,
                playerName: 'Unknown Player',
                years: {},
                position: null,
                team: null,
                lastUpdated: new Date().toISOString()
            };

            // Get data for all available years
            const availableYears = ['2024', '2023']; // Add more years as needed
            
            for (const year of availableYears) {
                console.log(`📊 Processing year ${year} for player ${playerId}`);
                const yearData = await this.getPlayerStatsForYear(playerId, year);
                
                if (yearData && Object.keys(yearData.weeks).length > 0) {
                    allPlayerData.years[year] = yearData;
                    
                    // Set player metadata from most recent year
                    if (!allPlayerData.position && yearData.position) {
                        allPlayerData.position = yearData.position;
                        allPlayerData.team = yearData.team;
                        allPlayerData.playerName = yearData.playerName || allPlayerData.playerName;
                    }
                }
            }

            console.log(`✅ Complete player data retrieved for ${playerId}:`, allPlayerData);
            return allPlayerData;
            
        } catch (error) {
            console.error(`❌ Error getting complete stats for player ${playerId}:`, error);
            throw error;
        }
    }

    // FIXED: Get all stats for a player in a specific year - CHECK ALL 18 WEEKS
    async getPlayerStatsForYear(playerId, year) {
        try {
            console.log(`📊 Getting player ${playerId} stats for year ${year}`);
            
            // First, check what we have in IndexedDB
            const cachedData = await this.getPlayerFromIndexedDB(playerId, year);  // Line 57
            const existingWeeks = cachedData ? Object.keys(cachedData.weeks) : [];
            
            console.log(`📋 Found ${existingWeeks.length} weeks in IndexedDB:`, existingWeeks);
            
            // Determine missing weeks (we need ALL 18 weeks + total)
            const missingWeeks = this.allWeeks.filter(week => !existingWeeks.includes(week));
            
            console.log(`❌ Missing ${missingWeeks.length} weeks:`, missingWeeks);
            
            // If we have missing weeks, fetch them from backend
            if (missingWeeks.length > 0) {
                console.log(`🌐 Fetching ${missingWeeks.length} missing weeks from backend...`);
                const missingData = await this.fetchMissingWeeksFromBackend(playerId, year, missingWeeks);
                
                if (missingData) {
                    // Merge missing data with existing data
                    await this.storeMissingWeeksInIndexedDB(missingData, existingWeeks);
                    
                    // Get updated data from IndexedDB
                    const updatedData = await this.getPlayerFromIndexedDB(playerId, year);
                    if (updatedData) {
                        console.log(`✅ Updated player data with ${Object.keys(updatedData.weeks).length} total weeks`);
                        return updatedData;
                    }
                }
            }
            
            // Return cached data (if any)
            if (cachedData) {
                console.log(`✅ Using cached data for player ${playerId} year ${year} (${existingWeeks.length} weeks)`);
                return cachedData;
            }

            console.log(`⚠️ No data found for player ${playerId} year ${year}`);
            return null;
            
        } catch (error) {
            console.error(`❌ Error getting player stats for year ${year}:`, error);
            return null;
        }
    }

    // NEW: Fetch missing weeks from backend
    async fetchMissingWeeksFromBackend(playerId, year, missingWeeks) {
        try {
            const params = new URLSearchParams({
                playerId,
                year,
                missingWeeks: missingWeeks.join(',')
            });

            const url = `${this.baseMissingWeeksUrl}?${params}`;
            console.log(`🌐 Fetching missing weeks: ${url}`);

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
                throw new Error(data.error || 'Backend request failed');
            }

            if (!data.data) {
                console.log(`⚠️ No missing weeks data returned for player ${playerId} year ${year}`);
                return null;
            }

            console.log(`✅ Fetched ${data.weeksFound}/${missingWeeks.length} missing weeks for player ${playerId}`);
            return data.data;
            
        } catch (error) {
            console.error(`❌ Error fetching missing weeks from backend:`, error);
            return null;
        }
    }

    // NEW: Store missing weeks data in IndexedDB (merge with existing)
    async storeMissingWeeksInIndexedDB(missingWeeksData, existingWeeks) {
        try {
            await this.ensureInitialized();
            
            const { playerId, year, name, position, team, rank, weeklyStats } = missingWeeksData;
            
            // Get existing record or create new one
            const existingRecord = await this.getPlayerRecordFromIndexedDB(playerId, year);
            
            let playerRecord;
            
            if (existingRecord) {
                // Merge with existing record
                playerRecord = {
                    ...existingRecord,
                    weeklyStats: {
                        ...existingRecord.weeklyStats,
                        ...weeklyStats
                    },
                    timestamp: new Date().toISOString()
                };
                console.log(`🔄 Merging missing weeks with existing record for player ${playerId}`);
            } else {
                // Create new record
                playerRecord = {
                    playerKey: this.cache.generatePlayerKey(year, playerId, position, rank || 999999),
                    year: parseInt(year),
                    playerId,
                    name,
                    position,
                    team,
                    rank: rank || 999999,
                    yearPosition: `${year}_${position}`,
                    yearRank: `${year}_${(rank || 999999).toString().padStart(6, '0')}`,
                    weeklyStats,
                    timestamp: new Date().toISOString()
                };
                console.log(`🆕 Creating new record for player ${playerId}`);
            }

            const transaction = this.cache.db.transaction([this.cache.playersStore], 'readwrite');
            const store = transaction.objectStore(this.cache.playersStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(playerRecord);
                request.onsuccess = () => {
                    console.log(`✅ Stored/updated player ${playerId} with missing weeks in IndexedDB`);
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
            
        } catch (error) {
            console.error(`❌ Error storing missing weeks in IndexedDB:`, error);
        }
    }

    // NEW: Get specific player record from IndexedDB
    async getPlayerRecordFromIndexedDB(playerId, year) {
        try {
            await this.ensureInitialized();
            
            const transaction = this.cache.db.transaction([this.cache.playersStore], 'readonly');
            const store = transaction.objectStore(this.cache.playersStore);
            const yearIndex = store.index('year');
            
            return new Promise((resolve, reject) => {
                const cursorRequest = yearIndex.openCursor(IDBKeyRange.only(parseInt(year)));
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        const record = cursor.value;
                        
                        if (record.playerId === playerId) {
                            resolve(record);
                            return;
                        }
                        
                        cursor.continue();
                    } else {
                        resolve(null);
                    }
                };
                
                cursorRequest.onerror = () => reject(cursorRequest.error);
            });
            
        } catch (error) {
            console.error(`❌ Error getting player record from IndexedDB:`, error);
            return null;
        }
    }

    // EXISTING: Get player data from IndexedDB
    async getPlayerFromIndexedDB(playerId, year) {
    try {
        await this.ensureInitialized();
        
        const transaction = this.cache.db.transaction([this.cache.playersStore], 'readonly');
        const store = transaction.objectStore(this.cache.playersStore);
        const yearIndex = store.index('year');
        
        return new Promise((resolve, reject) => {
            const playerData = {
                playerId,
                year: parseInt(year),
                playerName: null,
                position: null,
                team: null,
                weeks: {},
                rank: null  // ADD rank field
            };

            const cursorRequest = yearIndex.openCursor(IDBKeyRange.only(parseInt(year)));
            
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const record = cursor.value;
                    
                    if (record.playerId === playerId) {
                        if (!playerData.playerName) {
                            playerData.playerName = record.name;
                            playerData.position = record.position;
                            playerData.team = record.team;
                            
                            // EXTRACT RANK from yearRank field (format: "2024_000001")
                            if (record.yearRank) {
                                const rankPart = record.yearRank.split('_')[1];
                                playerData.rank = parseInt(rankPart);
                            }
                        }
                        
                    if (record.weeklyStats) {
    Object.entries(record.weeklyStats).forEach(([week, stats]) => {
        // The stats are directly the weeklyStats[week], not weeklyStats[week].stats
        if (stats && this.hasNonZeroStats(stats)) {
            playerData.weeks[week] = {
                week: week === 'total' ? 'total' : parseInt(week),
                stats, // This is correct - stats are the direct values
                timestamp: record.timestamp
            };
        }
    });
}
            
                    
                    cursor.continue();
                } else {
                    const weeksFound = Object.keys(playerData.weeks).length;
                    console.log(`📊 IndexedDB: Found ${weeksFound} weeks for player ${playerId} year ${year}`);
                    
                    if (weeksFound > 0) {
                        resolve(playerData);
                    } else {
                        resolve(null);
                    }
                }
            };
            
            cursorRequest.onerror = () => reject(cursorRequest.error);
        });
        
    } catch (error) {
        console.error(`❌ Error getting player from IndexedDB:`, error);
        return null;
    }
}

    // Check if stats object has any non-zero values
    hasNonZeroStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        return Object.values(stats).some(value => value && value !== 0);
    }

    // REST OF THE METHODS REMAIN THE SAME...
    calculatePlayerAnalytics(playerData, selectedYear = 'ALL', selectedWeek = 'ALL', showFantasyStats = false, scoringRules = {}) {
        console.log(`🧮 Calculating analytics for player data:`, playerData);
        
        const analytics = {
            metadata: {
                playerId: playerData.playerId,
                playerName: playerData.playerName,
                position: playerData.position,
                team: playerData.team,
                selectedYear,
                selectedWeek,
                showFantasyStats,
                lastCalculated: new Date().toISOString()
            },
            stats: {},
            summary: {
                totalGames: 0,
                totalWeeks: 0,
                yearsPlayed: Object.keys(playerData.years).length
            }
        };

        // Collect all relevant game data based on filters
        const gameData = this.collectGameData(playerData, selectedYear, selectedWeek);
        analytics.summary.totalGames = gameData.length;
        analytics.summary.totalWeeks = new Set(gameData.map(g => `${g.year}_${g.week}`)).size;

        if (gameData.length === 0) {
            console.log('⚠️ No game data found for analytics calculation');
            return analytics;
        }

        // Get all possible stats from the data
        const allStatIds = new Set();
        gameData.forEach(game => {
            Object.keys(game.stats).forEach(statId => allStatIds.add(statId));
        });

        // Calculate analytics for each stat
        allStatIds.forEach(statId => {
            const statValues = gameData
                .map(game => game.stats[statId] || 0)
                .filter(value => value !== null && value !== undefined);

            if (statValues.length > 0) {
                const statName = this.getStatName(statId);
                
                analytics.stats[statId] = {
                    statId,
                    statName,
                    rawStats: this.calculateStatMetrics(statValues),
                    fantasyStats: showFantasyStats && scoringRules[statId] ? 
                        this.calculateFantasyStatMetrics(statValues, scoringRules[statId]) : null
                };
            }
        });

        console.log(`✅ Analytics calculated for ${Object.keys(analytics.stats).length} stats`);
        return analytics;
    }

    // Collect game data based on year/week filters
    collectGameData(playerData, selectedYear, selectedWeek) {
        const gameData = [];
        
        const yearsToProcess = selectedYear === 'ALL' ? 
            Object.keys(playerData.years) : [selectedYear];

        yearsToProcess.forEach(year => {
            const yearData = playerData.years[year];
            if (!yearData) return;

            const weeksToProcess = selectedWeek === 'ALL' ? 
                Object.keys(yearData.weeks) : [selectedWeek];

            weeksToProcess.forEach(week => {
                const weekData = yearData.weeks[week];
                if (weekData && weekData.stats && this.hasNonZeroStats(weekData.stats)) {
                    gameData.push({
                        year: parseInt(year),
                        week,
                        stats: weekData.stats,
                        timestamp: weekData.timestamp
                    });
                }
            });
        });

        return gameData.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year; // Most recent year first
            if (a.week === 'total') return -1; // Season totals first
            if (b.week === 'total') return 1;
            return parseInt(b.week) - parseInt(a.week); // Most recent week first
        });
    }

    // Calculate raw stat metrics (median, average, total, min, max)
    calculateStatMetrics(values) {
        const validValues = values.filter(v => v !== 0);
        const total = values.reduce((sum, v) => sum + v, 0);
        
        return {
            total,
            average: validValues.length > 0 ? (total / validValues.length) : 0,
            median: this.calculateMedian(validValues),
            min: validValues.length > 0 ? Math.min(...validValues) : 0,
            max: validValues.length > 0 ? Math.max(...validValues) : 0,
            gamesPlayed: validValues.length,
            totalGames: values.length
        };
    }

    // Calculate fantasy stat metrics
    calculateFantasyStatMetrics(values, scoringRule) {
        const fantasyValues = values.map(value => {
            let points = value * parseFloat(scoringRule.points || 0);
            
            // Add bonus points
            if (scoringRule.bonuses && Array.isArray(scoringRule.bonuses)) {
                scoringRule.bonuses.forEach(bonusRule => {
                    const target = parseFloat(bonusRule.bonus.target || 0);
                    const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
                    
                    if (value >= target && target > 0) {
                        const bonusesEarned = Math.floor(value / target);
                        points += bonusesEarned * bonusPoints;
                    }
                });
            }
            
            return Math.round(points * 100) / 100;
        });

        const validValues = fantasyValues.filter(v => v !== 0);
        const total = fantasyValues.reduce((sum, v) => sum + v, 0);
        
        return {
            total,
            average: validValues.length > 0 ? (total / validValues.length) : 0,
            median: this.calculateMedian(validValues),
            min: validValues.length > 0 ? Math.min(...validValues) : 0,
            max: validValues.length > 0 ? Math.max(...validValues) : 0,
            gamesPlayed: validValues.length,
            totalGames: fantasyValues.length
        };
    }

    // Calculate median value
    calculateMedian(values) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        return sorted.length % 2 === 0 ? 
            (sorted[mid - 1] + sorted[mid]) / 2 : 
            sorted[mid];
    }

    // Get readable stat name from stat ID
    getStatName(statId) {
        return window.STAT_ID_MAPPING ? window.STAT_ID_MAPPING[statId] : `Stat ${statId}`;
    }
}

// Create global instance
window.playerStatsAPI = new PlayerStatsAPI();
