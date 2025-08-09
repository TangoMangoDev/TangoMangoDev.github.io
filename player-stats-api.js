// player-stats-api.js - Extended API for detailed player statistics
class PlayerStatsAPI extends StatsAPI {
    constructor() {
        super();
        this.playerDataCache = new Map(); // In-memory cache for computed stats
    }

    // Main method to get ALL data for a specific player across years/weeks
    async getPlayerCompleteStats(playerId, playerName = null) {
        console.log(`🎯 Getting complete stats for player: ${playerId}`);
        
        try {
            await this.cache.init();
            
            const allPlayerData = {
                playerId,
                playerName: playerName || 'Unknown Player',
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

    // Get all stats for a player in a specific year
    async getPlayerStatsForYear(playerId, year) {
        try {
            const transaction = this.cache.db.transaction([this.cache.playersStore], 'readonly');
            const store = transaction.objectStore(this.playersStore);
            const yearIndex = store.index('year');
            
            return new Promise((resolve, reject) => {
                const playerData = {
                    playerId,
                    year: parseInt(year),
                    playerName: null,
                    position: null,
                    team: null,
                    weeks: {},
                    seasonTotal: null,
                    rank: null
                };

                // Use cursor to find all records for this player in this year
                const cursorRequest = yearIndex.openCursor(IDBKeyRange.only(parseInt(year)));
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        const record = cursor.value;
                        
                        // Check if this record belongs to our player
                        if (record.playerId === playerId) {
                            // Update player metadata
                            if (!playerData.playerName) {
                                playerData.playerName = record.name;
                                playerData.position = record.position;
                                playerData.team = record.team;
                                playerData.rank = record.rank;
                            }
                            
                            // Add all weekly stats from this record
                            if (record.weeklyStats) {
                                Object.entries(record.weeklyStats).forEach(([week, stats]) => {
                                    if (stats && this.hasNonZeroStats(stats)) {
                                        playerData.weeks[week] = {
                                            week,
                                            stats,
                                            timestamp: record.timestamp
                                        };
                                    }
                                });
                            }
                        }
                        
                        cursor.continue();
                    } else {
                        // Finished processing all records
                        console.log(`✅ Found ${Object.keys(playerData.weeks).length} weeks of data for ${playerId} in ${year}`);
                        resolve(playerData.weeks && Object.keys(playerData.weeks).length > 0 ? playerData : null);
                    }
                };
                
                cursorRequest.onerror = () => reject(cursorRequest.error);
            });
            
        } catch (error) {
            console.error(`❌ Error getting player stats for year ${year}:`, error);
            return null;
        }
    }

    // Check if stats object has any non-zero values
    hasNonZeroStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        return Object.values(stats).some(value => value && value !== 0);
    }

    // Calculate player statistics with median, average, and totals
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
        // Use the existing STAT_ID_MAPPING from stats.js
        return window.STAT_ID_MAPPING ? window.STAT_ID_MAPPING[statId] : `Stat ${statId}`;
    }

    // Batch load player data for performance
    async batchLoadPlayerData(playerIds, year = '2024') {
        console.log(`🚀 Batch loading ${playerIds.length} players for year ${year}`);
        
        const results = new Map();
        const batchSize = 50; // Process in batches to avoid blocking UI
        
        for (let i = 0; i < playerIds.length; i += batchSize) {
            const batch = playerIds.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (playerId) => {
                try {
                    const playerData = await this.getPlayerStatsForYear(playerId, year);
                    if (playerData) {
                        results.set(playerId, playerData);
                    }
                } catch (error) {
                    console.error(`Error loading player ${playerId}:`, error);
                }
            });
            
            await Promise.all(batchPromises);
            
            // Allow UI to breathe between batches
            if (i + batchSize < playerIds.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        console.log(`✅ Batch loaded ${results.size} players`);
        return results;
    }
}

// Create global instance
window.playerStatsAPI = new PlayerStatsAPI();
