// player-stats-api.js - FIXED version with proper IndexedDB initialization
class PlayerStatsAPI extends StatsAPI {
    constructor() {
        super();
        this.playerDataCache = new Map();
        this.basePlayerUrl = '/data/stats/player'; // New endpoint for player data
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
    async getPlayerCompleteStats(playerId, playerName = null) {
        console.log(`🎯 Getting complete stats for player: ${playerId}`);
        
        try {
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

    // NEW: Get all stats for a player in a specific year from backend + IndexedDB
    async getPlayerStatsForYear(playerId, year) {
        try {
            // First, try to get from IndexedDB
            const cachedData = await this.getPlayerFromIndexedDB(playerId, year);
            
            // Check if cached data is complete (has reasonable number of weeks)
            if (cachedData && cachedData.weeks && Object.keys(cachedData.weeks).length >= 5) {
                console.log(`✅ Using cached data for player ${playerId} year ${year}`);
                return cachedData;
            }

            // If not in cache or incomplete, fetch from backend
            console.log(`🌐 Fetching player ${playerId} year ${year} from backend...`);
            const backendData = await this.fetchPlayerFromBackend(playerId, year);
            
            if (backendData) {
                // Store in IndexedDB for future use
                await this.storePlayerInIndexedDB(backendData);
                
                // Convert to expected format
                return {
                    playerId: backendData.playerId,
                    year: parseInt(year),
                    playerName: backendData.name,
                    position: backendData.position,
                    team: backendData.team,
                    rank: backendData.rank,
                    weeks: this.convertWeeklyStatsToWeeksFormat(backendData.weeklyStats)
                };
            }

            return null;
            
        } catch (error) {
            console.error(`❌ Error getting player stats for year ${year}:`, error);
            return null;
        }
    }

    // NEW: Fetch player data from backend
    async fetchPlayerFromBackend(playerId, year) {
        try {
            const params = new URLSearchParams({
                playerId,
                year
            });

            const url = `${this.basePlayerUrl}?${params}`;
            console.log(`🌐 Fetching player data: ${url}`);

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
                console.log(`⚠️ No data returned for player ${playerId} year ${year}`);
                return null;
            }

            console.log(`✅ Fetched player data for ${playerId} (${data.weeksFound} weeks)`);
            return data.data;
            
        } catch (error) {
            console.error(`❌ Error fetching player from backend:`, error);
            throw error;
        }
    }

    // NEW: Get player data from IndexedDB
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

    // NEW: Store player data in IndexedDB
    async storePlayerInIndexedDB(playerData) {
        try {
            await this.ensureInitialized();
            
            const { playerId, year, name, position, team, rank, weeklyStats } = playerData;
            
            // Create the player record in the format expected by IndexedDB
            const playerRecord = {
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

            const transaction = this.cache.db.transaction([this.cache.playersStore], 'readwrite');
            const store = transaction.objectStore(this.cache.playersStore);
            
            return new Promise((resolve, reject) => {
                const request = store.put(playerRecord);
                request.onsuccess = () => {
                    console.log(`✅ Stored player ${playerId} in IndexedDB`);
                    resolve();
                };
                request.onerror = () => reject(request.error);
            });
            
        } catch (error) {
            console.error(`❌ Error storing player in IndexedDB:`, error);
        }
    }

    // Helper: Convert backend weeklyStats format to weeks format
    convertWeeklyStatsToWeeksFormat(weeklyStats) {
        const weeks = {};
        
        Object.entries(weeklyStats).forEach(([week, stats]) => {
            if (stats && this.hasNonZeroStats(stats)) {
                weeks[week] = {
                    week,
                    stats,
                    timestamp: new Date().toISOString()
                };
            }
        });
        
        return weeks;
    }

    // Check if stats object has any non-zero values
    hasNonZeroStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        return Object.values(stats).some(value => value && value !== 0);
    }

    // Rest of the methods remain the same...
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
}

// Create global instance
window.playerStatsAPI = new PlayerStatsAPI();
<td class="stat-median">${this.formatStatValue(displayStats.median)}${suffix}</td>
                                   <td class="stat-max">${this.formatStatValue(displayStats.max)}${suffix}</td>
                                   <td class="stat-games">${displayStats.gamesPlayed}/${displayStats.totalGames}</td>
                               </tr>
                           `;
                       }).join('')}
                   </tbody>
               </table>
           </div>
       `;

       container.innerHTML = tableHTML;
       container.style.display = 'block';
       this.hideLoading();
   }

   formatStatValue(value) {
       if (typeof value !== 'number') return '0';
       if (value === 0) return '0';
       if (value % 1 === 0) return value.toString();
       return value.toFixed(1);
   }

   showLoading() {
       document.getElementById('loadingState').style.display = 'block';
       document.getElementById('playerStatsContainer').style.display = 'none';
       document.getElementById('errorState').style.display = 'none';
   }

   hideLoading() {
       document.getElementById('loadingState').style.display = 'none';
   }

   showError(message) {
       document.getElementById('errorMessage').textContent = message;
       document.getElementById('errorState').style.display = 'block';
       document.getElementById('loadingState').style.display = 'none';
       document.getElementById('playerStatsContainer').style.display = 'none';
   }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
   // Ensure the global STAT_ID_MAPPING is available
   if (!window.STAT_ID_MAPPING) {
       window.STAT_ID_MAPPING = {
           0: "Games Played", 1: "Pass Att", 2: "Comp", 3: "Inc", 4: "Pass Yds",
           5: "Pass TD", 6: "Int", 7: "Sack", 8: "Rush Att", 9: "Rush Yds",
           10: "Rush TD", 11: "Rec", 12: "Rec Yds", 13: "Rec TD", 14: "Ret Yds",
           15: "Ret TD", 16: "Off Fum Ret TD", 17: "2-PT", 18: "Fum", 19: "Fum Lost",
           20: "FG", 21: "FGM", 22: "Pts Allow", 23: "Tack Solo", 24: "Tack Ast",
           25: "Pass Def", 26: "Sack", 27: "Int", 28: "Fum Rec", 29: "Fum Force",
           30: "TD", 31: "Safe", 32: "Blk Kick", 33: "Ret Yds", 34: "Ret TD",
           57: "Off Snaps", 58: "Off Snap %", 59: "Def Snaps", 60: "Def Snap %",
           61: "ST Snaps", 62: "ST Snap %", 63: "Games Started", 64: "Off Plays",
           78: "Tack Total", 79: "Tack Loss", 80: "Rec 1st Downs", 81: "Rush 1st Downs"
       };
   }

   // Ensure statsAPI is available
   if (!window.statsAPI) {
       console.error('❌ statsAPI not found. Make sure stats-api.js is loaded first.');
       return;
   }

   const playerPage = new PlayerDetailPage();
   await playerPage.init();
});
