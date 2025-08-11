// player-stats-api.js - ENHANCED with Year-over-Year tracking
class PlayerStatsAPI extends StatsAPI {
    constructor() {
        super();
        this.playerDataCache = new Map();
        this.baseMissingWeeksUrl = '/data/stats/player/missing-weeks';
        this.allWeeks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'];
    }

    // EXISTING METHODS REMAIN THE SAME...
    async ensureInitialized() {
        if (!this.cache.db) {
            console.log('🔄 Initializing IndexedDB for player stats...');
            await this.cache.init();
        }
        return this.cache.db;
    }

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

            const availableYears = ['2024', '2023'];
            
            for (const year of availableYears) {
                console.log(`📊 Processing year ${year} for player ${playerId}`);
                const yearData = await this.getPlayerStatsForYear(playerId, year);
                
                if (yearData && Object.keys(yearData.weeks).length > 0) {
                    allPlayerData.years[year] = yearData;
                    
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

    // REST OF EXISTING METHODS REMAIN THE SAME...
    async getPlayerStatsForYear(playerId, year) {
        try {
            console.log(`📊 Getting player ${playerId} stats for year ${year}`);
            
            const cachedData = await this.getPlayerFromIndexedDB(playerId, year);
            const existingWeeks = cachedData ? Object.keys(cachedData.weeks) : [];
            
            console.log(`📋 Found ${existingWeeks.length} weeks in IndexedDB:`, existingWeeks);
            
            const missingWeeks = this.allWeeks.filter(week => !existingWeeks.includes(week));
            
            console.log(`❌ Missing ${missingWeeks.length} weeks:`, missingWeeks);
            
            if (missingWeeks.length > 0) {
                console.log(`🌐 Fetching ${missingWeeks.length} missing weeks from backend...`);
                const missingData = await this.fetchMissingWeeksFromBackend(playerId, year, missingWeeks);
                
                if (missingData) {
                    await this.storeMissingWeeksInIndexedDB(missingData, existingWeeks);
                    
                    const updatedData = await this.getPlayerFromIndexedDB(playerId, year);
                    if (updatedData) {
                        console.log(`✅ Updated player data with ${Object.keys(updatedData.weeks).length} total weeks`);
                        return updatedData;
                    }
                }
            }
            
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

    // NEW: Calculate Year-over-Year percentage change
    calculateYearOverYearChange(current2024Value, previous2023Value) {
        //console.log(`🧮 YOY CALCULATION: 2024=${current2024Value}, 2023=${previous2023Value}`);
        
        // Handle edge cases
        if (previous2023Value === 0 || previous2023Value === null || previous2023Value === undefined) {
            if (current2024Value > 0) {
                //console.log(`📈 YOY: NEW STAT - 2023 was 0, 2024 is ${current2024Value} = +∞% (showing as NEW)`);
                return { percentage: null, isNew: true };
            }
            //console.log(`📊 YOY: NO CHANGE - Both years are 0`);
            return { percentage: null, isNew: false };
        }
        
        if (current2024Value === null || current2024Value === undefined) {
            current2024Value = 0;
        }
        
        // Calculate YOY percentage: ((Current - Previous) / Previous) × 100
        const yoyPercentage = ((current2024Value - previous2023Value) / previous2023Value) * 100;
        const roundedPercentage = Math.round(yoyPercentage * 10) / 10; // Round to 1 decimal place
        
        //console.log(`📊 YOY RESULT: ${roundedPercentage}% change from ${previous2023Value} to ${current2024Value}`);
        
        return { percentage: roundedPercentage, isNew: false };
    }

    // NEW: Get stat totals for a specific year
    getStatTotalsForYear(playerData, year, selectedWeek, showFantasyStats, scoringRules) {
        const yearData = playerData.years[year];
        if (!yearData) {
            console.log(`⚠️ No data found for year ${year}`);
            return {};
        }

        // Collect game data for the year
        const gameData = this.collectGameDataForYear(yearData, selectedWeek);
        if (gameData.length === 0) {
            console.log(`⚠️ No game data found for year ${year}, week filter: ${selectedWeek}`);
            return {};
        }

        // Calculate totals for each stat
        const statTotals = {};
        const allStatIds = new Set();
        
        gameData.forEach(game => {
            Object.keys(game.stats).forEach(statId => {
                if (statId !== '0') { // Skip games played stat ID
                    allStatIds.add(statId);
                }
            });
        });

        allStatIds.forEach(statId => {
            const statValues = gameData
                .map(game => game.stats[statId] || 0)
                .filter(value => value !== null && value !== undefined);

            if (statValues.length > 0) {
                const rawTotal = statValues.reduce((sum, v) => sum + v, 0);
                
                // Calculate fantasy total if in fantasy mode
                let fantasyTotal = null;
                if (showFantasyStats && scoringRules[statId]) {
                    fantasyTotal = statValues.reduce((sum, rawValue) => {
                        const points = window.STATS_CONFIG.calculateFantasyPoints(statId, rawValue, scoringRules[statId]);
                        return sum + points;
                    }, 0);
                    fantasyTotal = Math.round(fantasyTotal * 100) / 100;
                }

                statTotals[statId] = {
                    rawTotal,
                    fantasyTotal
                };
            }
        });

        console.log(`📊 Calculated stat totals for ${year}:`, Object.keys(statTotals).length, 'stats');
        return statTotals;
    }

    // NEW: Helper to collect game data for a specific year
    collectGameDataForYear(yearData, selectedWeek) {
        const gameData = [];
        const weeksData = yearData.gameplayWeeks || yearData.weeks;
        const weeksToProcess = selectedWeek === 'ALL' ? 
            Object.keys(weeksData) : [selectedWeek];

        weeksToProcess.forEach(week => {
            const weekData = weeksData[week];
            if (weekData && weekData.stats && this.hasGameplay(weekData.stats)) {
                gameData.push({
                    week,
                    stats: weekData.stats,
                    timestamp: weekData.timestamp
                });
            }
        });

        return gameData;
    }

    // ENHANCED: Calculate Player Analytics with Year-over-Year tracking
calculatePlayerAnalytics(playerData, selectedYear = 'ALL', selectedWeek = 'ALL', showFantasyStats = false, scoringRules = {}) {
    console.log(`🔍 ANALYTICS FILTERS: Year=${selectedYear}, Week=${selectedWeek}, Fantasy=${showFantasyStats}`);
    
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
        },
        advancedAnalytics: null,
        yearOverYear: null
    };

    // Use gameplayWeeks if available, otherwise use weeks
    const gameData = this.collectGameData(playerData, selectedYear, selectedWeek);
    analytics.summary.totalGames = gameData.length;
    analytics.summary.totalWeeks = new Set(gameData.map(g => `${g.year}_${g.week}`)).size;

    if (gameData.length === 0) {
        console.log('⚠️ No game data found for analytics calculation');
        return analytics;
    }

    // Calculate advanced analytics if in fantasy mode
    if (showFantasyStats && Object.keys(scoringRules).length > 0) {
        const fantasyPoints = this.calculateFantasyPointsForGames(gameData, scoringRules);
        if (fantasyPoints.length > 0) {
            analytics.advancedAnalytics = this.calculateAdvancedAnalytics(
                fantasyPoints, gameData, playerData.position, scoringRules
            );
        }
    }

    // Calculate total games played and possible games for Starts calculation
    const gamesPlayed = gameData.length;
    const totalPossibleGames = selectedYear === 'ALL' ? 
        Object.keys(playerData.years).length * 18 : 18;
    const gamesPlayedPercentage = Math.round((gamesPlayed / totalPossibleGames) * 100);

    // Store starts info for header display (don't add to stats table)
    analytics.startsInfo = {
        gamesPlayed,
        totalPossibleGames,
        percentage: gamesPlayedPercentage,
        displayText: `${gamesPlayed}/${totalPossibleGames} (${gamesPlayedPercentage}%)`
    };

    // NEW: Calculate Year-over-Year changes if viewing 2024 and we have 2023 data
    let yearOverYearData = null;
    if (selectedYear === '2024' && playerData.years['2023'] && playerData.years['2024']) {
        const totals2024 = this.getStatTotalsForYear(playerData, '2024', selectedWeek, showFantasyStats, scoringRules);
        const totals2023 = this.getStatTotalsForYear(playerData, '2023', selectedWeek, showFantasyStats, scoringRules);
        
        yearOverYearData = {};
        
        // Calculate YOY for all stats that appear in either year
        const allYoyStatIds = new Set([...Object.keys(totals2024), ...Object.keys(totals2023)]);
        
        allYoyStatIds.forEach(statId => {
            const stat2024 = totals2024[statId];
            const stat2023 = totals2023[statId];
            
            const current2024 = showFantasyStats ? 
                (stat2024?.fantasyTotal || 0) : (stat2024?.rawTotal || 0);
            const previous2023 = showFantasyStats ? 
                (stat2023?.fantasyTotal || 0) : (stat2023?.rawTotal || 0);
            
            const yoyResult = this.calculateYearOverYearChange(current2024, previous2023);
            
            if (yoyResult.percentage !== null || yoyResult.isNew) {
                yearOverYearData[statId] = yoyResult;
            }
        });
        
        analytics.yearOverYear = yearOverYearData;
    }

    // Get position-relevant stats from config
    const positionRelevantStats = window.STATS_CONFIG.getStatsForPosition(playerData.position);

    // Get all possible stats from the data (excluding games played)
    const allStatIds = new Set();
    gameData.forEach(game => {
        Object.keys(game.stats).forEach(statId => {
            if (statId !== '0') { // Skip games played stat ID
                allStatIds.add(statId);
            }
        });
    });

    // Calculate analytics for each stat with POSITION-AWARE filtering
    allStatIds.forEach(statId => {
        const statValues = gameData
            .map(game => game.stats[statId] || 0)
            .filter(value => value !== null && value !== undefined);

        if (statValues.length > 0) {
            const statName = this.getStatName(statId);
            const rawStats = this.calculateStatMetricsWithLow(statValues);
            
            // PROPER FANTASY CALCULATION USING SHARED CONFIG
            let fantasyStats = null;
            if (showFantasyStats && scoringRules[statId]) {
                const fantasyValues = statValues.map(rawValue => {
                    return window.STATS_CONFIG.calculateFantasyPoints(statId, rawValue, scoringRules[statId]);
                });
                
                fantasyStats = this.calculateStatMetricsWithLow(fantasyValues);
            }

            // IMPROVED FILTERING: Position-relevant stats get priority
            const isPositionRelevant = positionRelevantStats.includes(statName);
            const hasRawData = rawStats.total > 0;
            const hasFantasyData = fantasyStats && fantasyStats.total !== 0;
            const hasVariation = rawStats.min !== rawStats.max || rawStats.total > rawStats.gamesPlayed;
            
            // POSITION-AWARE INCLUSION LOGIC
            let shouldInclude = false;
            
            if (showFantasyStats) {
                // In fantasy mode: show if has fantasy data OR is position-relevant with any data
                shouldInclude = hasFantasyData || (isPositionRelevant && hasRawData);
            } else {
                // In raw mode: show if position-relevant with data OR has significant variation
                shouldInclude = (isPositionRelevant && hasRawData) || (hasRawData && hasVariation);
            }
            
            if (shouldInclude) {
                analytics.stats[statId] = {
                    statId,
                    statName,
                    rawStats,
                    fantasyStats
                };
            }
        }
    });

    console.log(`✅ Analytics calculated for ${Object.keys(analytics.stats).length} stats`);
    return analytics;
}

    // NEW: Calculate stat metrics with proper low value (excluding 0s unless they played)
calculateStatMetricsWithLow(values) {
    const nonZeroValues = values.filter(v => v !== 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    // Calculate proper low value: lowest non-zero value, or 0 if all are 0
    let lowGameValue = 0;
    if (nonZeroValues.length > 0) {
        lowGameValue = Math.min(...nonZeroValues);
    }
    
    return {
        total,
        average: nonZeroValues.length > 0 ? (total / nonZeroValues.length) : 0,
        median: this.calculateMedian(nonZeroValues),
        min: nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0,
        max: nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0,
        lowGameValue, // NEW: Proper low value for display
        gamesPlayed: nonZeroValues.length,
        totalGames: values.length
    };
}

    // REST OF EXISTING METHODS REMAIN UNCHANGED...
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

    // ENHANCED: Store ALL weeks including games not played (0:0) but don't include them in calculations
    async storeMissingWeeksInIndexedDB(missingWeeksData, existingWeeks) {
    try {
        await this.ensureInitialized();
        
        const { playerId, year, name, position, team, rank, weeklyStats } = missingWeeksData;
        
        const existingRecord = await this.getPlayerRecordFromIndexedDB(playerId, year);
        
        let playerRecord;
        
        if (existingRecord) {
            playerRecord = {
                ...existingRecord,
                weeklyStats: {
                    ...existingRecord.weeklyStats,
                    ...weeklyStats  // Store ALL weeks including 0:0 games
                },
                timestamp: new Date().toISOString()
            };
            console.log(`🔄 Merging missing weeks with existing record for player ${playerId}`);
        } else {
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
                weeklyStats,  // Store ALL weeks including 0:0 games
                timestamp: new Date().toISOString()
            };
            console.log(`🆕 Creating new record for player ${playerId}`);
        }

        // CRITICAL: Log and store ALL weeks including 0:0 to prevent re-fetching
        console.log(`💾 STORING ALL WEEKS FOR ${playerId}:`, Object.keys(weeklyStats).map(week => {
            const gamesPlayed = weeklyStats[week]['0'] || 0;
            return `Week ${week}: ${gamesPlayed === 0 ? '0:0 (DID NOT PLAY - STORED)' : 'PLAYED'}`;
        }));

        const transaction = this.cache.db.transaction([this.cache.playersStore], 'readwrite');
        const store = transaction.objectStore(this.cache.playersStore);
        
        return new Promise((resolve, reject) => {
            const request = store.put(playerRecord);
            request.onsuccess = () => {
                console.log(`✅ SUCCESSFULLY STORED player ${playerId} with ALL ${Object.keys(weeklyStats).length} weeks in IndexedDB`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
        
    } catch (error) {
        console.error(`❌ Error storing missing weeks in IndexedDB:`, error);
    }
}

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

    // ENHANCED: Get player data but mark ALL weeks as existing (even 0:0 games) to prevent re-fetching
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
                    rank: null,
                    allWeeksStored: [], // Track ALL weeks we've stored (including 0:0)
                    gameplayWeeks: {},  // Only weeks where they actually played
                    totalGamesPlayed: 0,
                    totalPossibleGames: 18
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
                                
                                if (record.yearRank) {
                                    const rankPart = record.yearRank.split('_')[1];
                                    playerData.rank = parseInt(rankPart);
                                }
                            }
                            
                            if (record.weeklyStats) {
                                Object.entries(record.weeklyStats).forEach(([week, stats]) => {
                                    // Track ALL weeks we have stored (including 0:0)
                                    if (week !== 'total') {
                                        playerData.allWeeksStored.push(week);
                                        
                                        // Check if they actually played this week
                                        if (stats && this.hasGameplay(stats)) {
                                            playerData.gameplayWeeks[week] = {
                                                week: parseInt(week),
                                                stats,
                                                timestamp: record.timestamp
                                            };
                                            playerData.totalGamesPlayed++;
                                        } else {
                                            console.log(`📋 Week ${week}: DID NOT PLAY (0:0)`);
                                        }
                                    }
                                });
                            }
                        }
                        
                        cursor.continue();
                    } else {
                        const weeksFound = Object.keys(playerData.gameplayWeeks).length;
                        const allWeeksStored = playerData.allWeeksStored.length;
                        console.log(`📊 IndexedDB: Found ${weeksFound} gameplay weeks out of ${allWeeksStored} total weeks stored for player ${playerId} year ${year}`);
                        console.log(`🏈 Games Played: ${playerData.totalGamesPlayed}/${playerData.totalPossibleGames} (${Math.round((playerData.totalGamesPlayed/playerData.totalPossibleGames)*100)}%)`);
                        
                        // Return structure that prevents re-fetching of stored weeks
                        if (allWeeksStored > 0) {
                            const result = { ...playerData };
                            // Mark ALL stored weeks as "existing" to prevent re-fetch
                            result.weeks = {};
                            playerData.allWeeksStored.forEach(week => {
                                result.weeks[week] = true; // Mark as existing to prevent re-fetch
                            });
                            resolve(result);
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

    // NEW: Check if stats represent actual gameplay (not a 0:0 game)
    hasGameplay(stats) {
        if (!stats || typeof stats !== 'object') return false;
        // If games played (stat ID 0) is 0, this is not a gameplay week
        return stats['0'] && stats['0'] > 0;
    }

    // EXISTING: Check if stats object has any non-zero values
    hasNonZeroStats(stats) {
        if (!stats || typeof stats !== 'object') return false;
        return Object.values(stats).some(value => value && value !== 0);
    }

    // ENHANCED: Collect game data using gameplayWeeks when available
    collectGameData(playerData, selectedYear, selectedWeek) {
        const gameData = [];
        
        const yearsToProcess = selectedYear === 'ALL' ? 
            Object.keys(playerData.years) : [selectedYear];

        yearsToProcess.forEach(year => {
            const yearData = playerData.years[year];
            if (!yearData) return;

            // Use gameplayWeeks if available (filtered weeks), otherwise use weeks
            const weeksData = yearData.gameplayWeeks || yearData.weeks;
            const weeksToProcess = selectedWeek === 'ALL' ? 
                Object.keys(weeksData) : [selectedWeek];

            weeksToProcess.forEach(week => {
                const weekData = weeksData[week];
                if (weekData && weekData.stats && this.hasGameplay(weekData.stats)) {
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
            if (a.year !== b.year) return b.year - a.year;
            if (a.week === 'total') return -1;
            if (b.week === 'total') return 1;
            return parseInt(b.week) - parseInt(a.week);
        });
    }

    // REST OF EXISTING METHODS REMAIN EXACTLY THE SAME...
    calculateFantasyStatMetrics(values, scoringRule) {
        const fantasyValues = values.map(value => {
            if (!value || value === 0) return 0;
            
            // Use the shared config for consistent calculation
            const statId = scoringRule.statId || Object.keys(window.STATS_CONFIG.STAT_ID_MAPPING).find(id => 
                window.STATS_CONFIG.STAT_ID_MAPPING[id].name === scoringRule.statName
            );
            
            if (statId) {
                return window.STATS_CONFIG.calculateFantasyPoints(statId, value, scoringRule);
            }
            
            // Fallback to basic calculation
            let points = value * parseFloat(scoringRule.points || 0);
            
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

calculateFantasyPointsForGames(gameData, scoringRules) {
    return gameData.map(game => {
        let totalPoints = 0;
        
        Object.entries(game.stats).forEach(([statId, value]) => {
            if (scoringRules[statId] && value !== 0) { // Allow negative values
                const points = window.STATS_CONFIG.calculateFantasyPoints(statId, value, scoringRules[statId]);
                totalPoints += points;
            }
        });
        
        return Math.round(totalPoints * 100) / 100;
    });
}

 calculateAdvancedAnalytics(fantasyPoints, gameData, position, scoringRules) {
    if (fantasyPoints.length === 0) return {};

    const validPoints = fantasyPoints.filter(p => p > 0);
    const mean = validPoints.reduce((sum, p) => sum + p, 0) / validPoints.length;
    const median = this.calculateMedian(validPoints);
    const standardDev = this.calculateStandardDeviation(validPoints, mean);
    
    const consistencyScore = mean > 0 ? Math.round((median / mean) * 100) : 0;
    const volatilityIndex = mean > 0 ? Math.round((standardDev / mean) * 100) / 100 : 0;
    
    const boomThreshold = mean * 1.2;
    const boomGames = fantasyPoints.filter(p => p > boomThreshold).length;
    const boomRate = Math.round((boomGames / fantasyPoints.length) * 100);
    
    const bustThresholds = {
        'QB': 12, 'RB': 8, 'WR': 8, 'TE': 6, 'K': 4, 'DST': 5
    };
    const bustThreshold = bustThresholds[position] || 8;
    const bustGames = fantasyPoints.filter(p => p < bustThreshold).length;
    const bustRate = Math.round((bustGames / fantasyPoints.length) * 100);
    
    const tdDependency = this.calculateTdDependency(gameData, scoringRules, fantasyPoints);
    const { opportunityEfficiency, firstDownRate } = this.calculateOpportunityMetrics(
        gameData, fantasyPoints, position
    );
    
    const sortedPoints = [...validPoints].sort((a, b) => a - b);
    const floor = this.calculatePercentile(sortedPoints, 10);
    const ceiling = this.calculatePercentile(sortedPoints, 90);

    return {
        consistencyScore,
        volatilityIndex,
        boomRate,
        bustRate,
        tdDependency,
        opportunityEfficiency,
        firstDownRate,
        floorCeiling: { floor: Math.round(floor * 10) / 10, ceiling: Math.round(ceiling * 10) / 10 },
        mean: Math.round(mean * 10) / 10,
        median: Math.round(median * 10) / 10,
        standardDev: Math.round(standardDev * 10) / 10
    };
}
   calculateTdDependency(gameData, scoringRules, fantasyPoints) {
       let totalTDs = 0;
       const totalFantasyPoints = fantasyPoints.reduce((sum, p) => sum + p, 0);
       
       gameData.forEach(game => {
           const tdStatIds = ['5', '10', '13', '15', '16', '30'];
           tdStatIds.forEach(statId => {
               if (game.stats[statId]) {
                   totalTDs += game.stats[statId];
               }
           });
       });
       
       if (totalFantasyPoints === 0) return 0;
       const tdPoints = totalTDs * 6;
       return Math.round((tdPoints / totalFantasyPoints) * 100);
   }

   calculateOpportunityMetrics(gameData, fantasyPoints, position) {
       let totalOpportunities = 0;
       let totalFirstDowns = 0;
       let totalTouches = 0;
       
       gameData.forEach(game => {
           let gameOpportunities = 0;
           let gameFirstDowns = 0;
           let gameTouches = 0;
           
           if (position === 'QB') {
               gameOpportunities = (game.stats['1'] || 0) + (game.stats['8'] || 0);
               gameTouches = gameOpportunities;
           } else if (['RB', 'WR', 'TE'].includes(position)) {
               gameOpportunities = (game.stats['8'] || 0) + (game.stats['11'] || 0);
               gameTouches = gameOpportunities;
               gameFirstDowns = (game.stats['80'] || 0) + (game.stats['81'] || 0);
           }
           
           totalOpportunities += gameOpportunities;
           totalFirstDowns += gameFirstDowns;
           totalTouches += gameTouches;
       });
       
       const totalFantasyPoints = fantasyPoints.reduce((sum, p) => sum + p, 0);
       const opportunityEfficiency = totalOpportunities > 0 ? 
           Math.round((totalFantasyPoints / totalOpportunities) * 100) / 100 : 0;
       const firstDownRate = totalTouches > 0 ? 
           Math.round((totalFirstDowns / totalTouches) * 100) : 0;
       
       return { opportunityEfficiency, firstDownRate };
   }

   calculateStandardDeviation(values, mean) {
       if (values.length === 0) return 0;
       const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
       const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
       return Math.sqrt(avgSquaredDiff);
   }

   calculatePercentile(sortedValues, percentile) {
       if (sortedValues.length === 0) return 0;
       const index = (percentile / 100) * (sortedValues.length - 1);
       const lower = Math.floor(index);
       const upper = Math.ceil(index);
       const weight = index % 1;
       
       if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
       return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
   }

   calculateStatMetrics(values) {
       const nonZeroValues = values.filter(v => v !== 0);
       const total = values.reduce((sum, v) => sum + v, 0);
       
       return {
           total,
           average: nonZeroValues.length > 0 ? (total / nonZeroValues.length) : 0,
           median: this.calculateMedian(nonZeroValues),
           min: nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0,
           max: nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0,
           gamesPlayed: nonZeroValues.length,
           totalGames: values.length
       };
   }

   calculateMedian(values) {
       if (values.length === 0) return 0;
       
       const sorted = [...values].sort((a, b) => a - b);
       const mid = Math.floor(sorted.length / 2);
       
       return sorted.length % 2 === 0 ? 
           (sorted[mid - 1] + sorted[mid]) / 2 : 
           sorted[mid];
   }

   getStatName(statId) {
       return window.STATS_CONFIG.getStatName(statId);
   }
}

window.playerStatsAPI = new PlayerStatsAPI();
