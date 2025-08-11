// stats.js - Enhanced Dashboard with new player-centric data retrieval
// Global state and variables
let currentFilters = {
    league: null,
    team: 'ALL',
    week: 'total',
    position: 'ALL',
    year: '2024'
};

let apiState = {
    loading: false,
    error: null,
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    hasMore: false
};

let currentPlayers = [];
let currentView = 'cards';
let searchQuery = '';
let showFantasyStats = false;
let currentScoringRules = {}; // ONLY store the active league's rules
let userLeagues = {};
let tableSort = {
    column: null,
    direction: 'asc'
};
let eventListenersSetup = false;

// Updated stats conversion function
window.convertStatsForDisplay = function(rawStats) {
    if (!rawStats || typeof rawStats !== 'object') {
        return {};
    }
    
    const displayStats = {};
    
    for (const [statId, statValue] of Object.entries(rawStats)) {
        const statName = STAT_ID_MAPPING[statId];
        if (statName && statValue !== null && statValue !== undefined && statValue !== 0) {
            displayStats[statName] = statValue;
        }
    }
    
    return displayStats;
};
// Backend API functions
async function loadUserLeagues() {
    try {
        console.log('🔄 Loading ALL user leagues...');
        const response = await fetch('/data/stats/rules');
        
        if (!response.ok) {
            console.warn('⚠️ Failed to load leagues, using empty defaults');
            return setEmptyDefaults();
        }
        
        const data = await response.json();
        console.log('📊 Backend response received:', data);
        
        if (data.needsImport) {
            console.log('⚠️ User needs to import leagues first');
            return setEmptyDefaults();
        }
        
        if (data.leagues && data.scoringRules) {
            userLeagues = data.leagues;
            console.log(`✅ Loaded ${Object.keys(userLeagues).length} leagues:`, Object.keys(userLeagues));
            
            // STORE ALL SCORING RULES IN INDEXDB
            for (const [leagueId, scoringRules] of Object.entries(data.scoringRules)) {
                if (scoringRules && Object.keys(scoringRules).length > 0) {
                    console.log(`💾 Storing ${Object.keys(scoringRules).length} scoring rules for league ${leagueId}`);
                    await window.statsAPI.cache.setScoringRules(leagueId, scoringRules);
                }
            }
            
            // Set default league (first one or the one specified by backend)
            const defaultLeagueId = data.defaultLeagueId || Object.keys(userLeagues)[0];
            
            if (defaultLeagueId) {
                currentFilters.league = defaultLeagueId;
                localStorage.setItem('activeLeagueId', defaultLeagueId);
                
                // Load scoring rules for default league
                if (data.scoringRules[defaultLeagueId]) {
                    currentScoringRules = data.scoringRules[defaultLeagueId];
                    console.log(`✅ Set default league ${defaultLeagueId} with ${Object.keys(currentScoringRules).length} scoring rules`);
                }
            }
            
            // Cache the leagues data
            localStorage.setItem('userLeagues', JSON.stringify({
                leagues: userLeagues,
                timestamp: Date.now()
            }));
            
            return userLeagues;
        }
        
        return setEmptyDefaults();
        
    } catch (error) {
        console.error('❌ Error loading leagues:', error);
        return setEmptyDefaults();
    }
}

function setEmptyDefaults() {
    userLeagues = {};
    currentScoringRules = {};
    currentFilters.league = null;
    
    const cached = localStorage.getItem('userLeagues');
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 3600000) {
            userLeagues = parsed.leagues;
            return userLeagues;
        }
    }
    return {};
}

// FIXED: Load scoring rules and extract the correct nested structure
async function loadScoringRulesForActiveLeague(leagueId) {
    if (!leagueId) {
        console.log('❌ No league ID provided for scoring rules');
        currentScoringRules = {};
        return;
    }
    
    console.log(`🔄 Loading scoring rules for league: ${leagueId}`);
    
    try {
        // Get from IndexedDB via StatsAPI (which checks cache first)
        const rulesData = await window.statsAPI.getScoringRules(leagueId);
        
        console.log(`📊 Received rules data:`, rulesData);
        
        if (rulesData && rulesData[leagueId]) {
            currentScoringRules = rulesData[leagueId];
            console.log(`✅ Loaded ${Object.keys(currentScoringRules).length} scoring rules from IndexedDB for league ${leagueId}`);
            
            // Trigger fresh data load for this league
            await loadStats(true);
        } else {
            console.log(`⚠️ No scoring rules found for league ${leagueId}`);
            currentScoringRules = {};
        }
        
    } catch (error) {
        console.error(`❌ Error loading scoring rules for league ${leagueId}:`, error);
        currentScoringRules = {};
    }
}

function getSavedWeek() {
    const savedWeek = localStorage.getItem('selectedWeek');
    if (savedWeek && savedWeek !== 'current') {
        return savedWeek === 'total' ? 'total' : parseInt(savedWeek);
    }
    return 'total';
}

function saveWeekPreference(week) {
    if (week) {
        localStorage.setItem('selectedWeek', week.toString());
    } else {
        localStorage.setItem('selectedWeek', 'total');
    }
}

function initializeActiveLeague() {
    let activeLeagueId = localStorage.getItem('activeLeagueId');
    
    if (!activeLeagueId || !userLeagues[activeLeagueId]) {
        const leagueIds = Object.keys(userLeagues);
        if (leagueIds.length > 0) {
            activeLeagueId = leagueIds[0];
            localStorage.setItem('activeLeagueId', activeLeagueId);
        }
    }
    
    return activeLeagueId;
}

// Filter controls
function createFilterControls() {
    const activeLeagueId = currentFilters.league || initializeActiveLeague();
    const activeLeague = userLeagues[activeLeagueId];
    
    return `
        <div class="filter-controls">
            <div class="filter-group">
                <label for="year-select">Year:</label>
                <select id="year-select" class="filter-dropdown">
                    <option value="2024" ${currentFilters.year === '2024' ? 'selected' : ''}>2024</option>
                    <option value="2023" ${currentFilters.year === '2023' ? 'selected' : ''}>2023</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label for="week-select">Week:</label>
                <select id="week-select" class="filter-dropdown">
                    <option value="total" ${currentFilters.week === 'total' ? 'selected' : ''}>Season Total</option>
                    ${Array.from({length: 18}, (_, i) => i + 1).map(week => `
                        <option value="${week}" ${currentFilters.week === week.toString() ? 'selected' : ''}>
                            Week ${week}
                        </option>
                    `).join('')}
                </select>
            </div>
            
            ${Object.keys(userLeagues).length > 0 ? `
                <div class="filter-group">
                    <label for="league-select">League:</label>
                    <select id="league-select" class="filter-dropdown">
                        ${Object.entries(userLeagues).map(([leagueId, league]) => `
                            <option value="${leagueId}" ${leagueId === activeLeagueId ? 'selected' : ''}>
                                ${league.leagueName || `League ${leagueId}`}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="filter-group">
                    <label for="team-select">Team:</label>
                    <select id="team-select" class="filter-dropdown">
                        <option value="ALL">All Teams</option>
                        ${activeLeague && activeLeague.teams ? activeLeague.teams.map(team => `
                            <option value="${team.teamId}" ${team.teamId === currentFilters.team ? 'selected' : ''}>
                                ${team.teamName}
                            </option>
                        `).join('') : ''}
                    </select>
                </div>
            ` : ''}
            
            <div class="stats-toggle">
                <button class="stats-toggle-btn ${!showFantasyStats ? 'active' : ''}" data-mode="raw">
                    Raw Stats
                </button>
                <button class="stats-toggle-btn ${showFantasyStats ? 'active' : ''}" data-mode="fantasy">
                    Fantasy Stats
                </button>
            </div>
        </div>
    `;
}
// ENHANCED: Load stats using new player-centric approach
async function loadStats(resetPage = true) {
    if (apiState.loading) {
        console.log('🚫 Already loading stats, ignoring duplicate call');
        return;
    }

    if (resetPage) {
        apiState.currentPage = 1;
        currentPlayers = [];
    }

    apiState.loading = true;
    apiState.error = null;
    
    updateFilterControlsUI();
    
    try {
        console.log(`🎯 Loading stats for: ${currentFilters.year}, ${currentFilters.week}, ${currentFilters.position}`);
        
        // Calculate how many players to load (50 per page)
        const playersToLoad = apiState.currentPage * 50;        
        // Use new getPlayersForDisplay method
        const playersData = await window.statsAPI.getPlayersForDisplay(
            currentFilters.year,
            currentFilters.week,
            currentFilters.position,
            playersToLoad
        );
        
        if (!playersData.success || !playersData.data) {
            throw new Error('Failed to load players data');
        }
        
        console.log(`📊 Received ${playersData.data.length} players from new system`);
        
        currentPlayers = playersData.data;
        
        // Calculate fantasy points if needed
        if (showFantasyStats && currentScoringRules && Object.keys(currentScoringRules).length > 0) {
            currentPlayers = currentPlayers.map(player => ({
                ...player,
                fantasyPoints: calculateTotalFantasyPoints(player)
            }));
            
            // Sort by fantasy points for fantasy mode
            currentPlayers.sort((a, b) => (b.fantasyPoints || 0) - (a.fantasyPoints || 0));
        }
        
        // Set pagination info
        apiState.totalRecords = Math.max(currentPlayers.length, playersToLoad);
        apiState.hasMore = playersData.data.length >= playersToLoad; // Assume more if we got exactly what we asked for
        apiState.totalPages = Math.ceil(apiState.totalRecords / 50);
        apiState.loading = false;
        
        console.log(`✅ Successfully loaded ${currentPlayers.length} players`);
        
    } catch (error) {
        console.error('Failed to load stats:', error);
        apiState.error = error.message;
        apiState.loading = false;
        currentPlayers = [];
    }
    
    updateFilterControlsUI();
    await render();
}

// COMPLETE setupEventListeners function
function setupEventListeners() {
    if (eventListenersSetup) {
        return;
    }

    // Year selector - IMPORTANT: This triggers full year reload
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', async (e) => {
            const newYear = e.target.value;
            console.log(`🔄 Year changed to: ${newYear}`);
            
            currentFilters.year = newYear;
            currentFilters.week = 'total'; // Reset to season totals
            
            // Clear year data to force reload
            window.statsAPI.yearDataLoaded.delete(newYear);
            
            await loadStats(true);
        });
    }
    
    // Week selector
    const weekSelect = document.getElementById('week-select');
    if (weekSelect) {
        weekSelect.addEventListener('change', async (e) => {
            currentFilters.week = e.target.value;
            saveWeekPreference(e.target.value);
            await loadStats(true);
        });
    }
    
    // League selector
    const leagueSelect = document.getElementById('league-select');
    if (leagueSelect) {
        leagueSelect.addEventListener('change', async (e) => {
            const newLeagueId = e.target.value;
            console.log(`🔄 League switched to: ${newLeagueId}`);
            
            currentFilters.league = newLeagueId;
            localStorage.setItem('activeLeagueId', newLeagueId);
            
            await loadScoringRulesForActiveLeague(newLeagueId);
            updateFilterControlsUI();
        });
    }
    
    // Team selector
    const teamSelect = document.getElementById('team-select');
    if (teamSelect) {
        teamSelect.addEventListener('change', async (e) => {
            currentFilters.team = e.target.value;
            await render();
        });
    }
    
    // Stats mode toggle
    document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            showFantasyStats = e.target.dataset.mode === 'fantasy';
            await render();
        });
    });
    
    // Load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            if (apiState.hasMore && !apiState.loading) {
                apiState.currentPage++;
                await loadStats(false);
            }
        });
    }
    
    // View toggle buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            await render();
        });
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            searchQuery = e.target.value.toLowerCase();
            await render();
        });
    }
    
    // Position filter
    const positionFilter = document.getElementById('positionFilter');
    if (positionFilter) {
        positionFilter.addEventListener('click', async (e) => {
            if (e.target.classList.contains('position-btn')) {
                if (e.target.classList.contains('active')) {
                    return;
                }
                
                document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                currentFilters.position = e.target.dataset.position;
                await loadStats(true);
            }
        });
    }

    eventListenersSetup = true;
}

function updateFilterControlsUI() {
    const filterContainer = document.querySelector('.filter-controls-container');
    if (filterContainer) {
        filterContainer.innerHTML = createFilterControls();
        eventListenersSetup = false;
        setupEventListeners();
    }
}

// Get filtered players for display
function getFilteredPlayers() {
    let filteredPlayers = [...currentPlayers];

    if (searchQuery) {
        filteredPlayers = filteredPlayers.filter(player => {
            return player.name.toLowerCase().includes(searchQuery) ||
                   player.team.toLowerCase().includes(searchQuery);
        });
    }
    
    return filteredPlayers;
}

// Replace the positionStats and keyStats objects with:
const positionStats = window.STATS_CONFIG.POSITION_STATS;
const keyStats = window.STATS_CONFIG.POSITION_KEY_STATS;

// Update the calculateFantasyPoints function:
function calculateFantasyPoints(statName, rawStatValue) {
    if (!showFantasyStats || !rawStatValue || rawStatValue === 0) {
        return rawStatValue || 0;
    }
    
    if (!currentScoringRules || Object.keys(currentScoringRules).length === 0) {
        return rawStatValue || 0;
    }
    
    // Find the stat ID for the given stat name
    const statId = Object.keys(window.STATS_CONFIG.STAT_ID_MAPPING).find(id => 
        window.STATS_CONFIG.STAT_ID_MAPPING[id].name === statName
    );
    
    if (!statId || !currentScoringRules[statId]) {
        return rawStatValue || 0;
    }
    
    return window.STATS_CONFIG.calculateFantasyPoints(statId, rawStatValue, currentScoringRules[statId]);
}

// Calculate total fantasy points for a player
function calculateTotalFantasyPoints(player) {
    if (!showFantasyStats || !player.rawStats) {
        return 0;
    }
    
    if (!currentScoringRules || Object.keys(currentScoringRules).length === 0) {
        return 0;
    }
    
    let totalPoints = 0;
    
    try {
        Object.entries(player.rawStats).forEach(([statId, statValue]) => {
            if (currentScoringRules[statId] && statValue !== 0) {
                const rule = currentScoringRules[statId];
                
                // Base points
                let points = statValue * parseFloat(rule.points || 0);
                
                // Add bonuses
                if (rule.bonuses && Array.isArray(rule.bonuses)) {
                    rule.bonuses.forEach(bonusRule => {
                        const target = parseFloat(bonusRule.bonus.target || 0);
                        const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
                        
                        if (statValue >= target && target > 0) {
                            const bonusesEarned = Math.floor(statValue / target);
                            points += bonusesEarned * bonusPoints;
                        }
                    });
                }
                
                if (points !== 0) {
                    totalPoints += points;
                }
            }
        });
        
        return Math.round(totalPoints * 100) / 100;
    } catch (error) {
        console.error(`Error calculating total fantasy points for ${player.name}:`, error);
        return 0;
    }
}

// Get stat value for display - PROPER conversion
function getStatValue(player, statName) {
    const rawValue = player.stats[statName] || 0;
    
    if (!showFantasyStats) {
        return rawValue;
    }
    
    // SAFE: If no scoring rules, show raw values
    if (!currentScoringRules || Object.keys(currentScoringRules).length === 0) {
        return rawValue;
    }
    
    try {
        return calculateFantasyPoints(statName, rawValue);
    } catch (error) {
        console.error(`Error calculating fantasy points for ${statName}:`, error);
        return rawValue;
    }
}

// NEW: Function to check if a column should be hidden (all zeros)
function shouldHideColumn(players, stat) {
    return players.every(player => {
        const value = player.stats[stat] || 0;
        return value === 0;
    });
}

// NEW: Function to get visible stats (non-zero columns only)
function getVisibleStats(players, allStats) {
    return allStats.filter(stat => !shouldHideColumn(players, stat));
}

// Research table functions
function sortTable(column) {
    if (tableSort.column === column) {
        tableSort.direction = tableSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        tableSort.column = column;
        tableSort.direction = 'asc';
    }
    render();
}

function clearAllFilters() {
    tableSort = { column: null, direction: 'asc' };
    render();
}

// Get sorted players with bonus column sorting
function getSortedPlayers(players) {
    if (!tableSort.column) return players;
    
    return [...players].sort((a, b) => {
        let aValue, bValue;
        
        if (tableSort.column === 'name') {
            aValue = a.name;
            bValue = b.name;
        } else if (tableSort.column === 'position') {
            aValue = a.position;
            bValue = b.position;
        } else if (tableSort.column === 'team') {
            aValue = a.team;
            bValue = b.team;
        } else if (tableSort.column === 'overallRank') {
            aValue = a.overallRank || 999999;
            bValue = b.overallRank || 999999;
        } else if (tableSort.column === 'positionRank') {
            aValue = a.positionRank || 999999;
            bValue = b.positionRank || 999999;
        } else if (tableSort.column === 'fantasyPoints') {
            aValue = a.fantasyPoints || calculateTotalFantasyPoints(a);
            bValue = b.fantasyPoints || calculateTotalFantasyPoints(b);
        } else if (tableSort.column.endsWith('_bonus')) {
            // Handle bonus column sorting
            const statName = tableSort.column.replace('_bonus', '');
            aValue = getBonusPoints(a, statName);
            bValue = getBonusPoints(b, statName);
        } else {
            aValue = getStatValue(a, tableSort.column);
            bValue = getStatValue(b, tableSort.column);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return tableSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
            if (tableSort.direction === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        }
    });
}

// Render functions
async function render() {
    const content = document.getElementById('content');
    let filteredPlayers = getFilteredPlayers();

    if (!Array.isArray(filteredPlayers)) {
        console.error('❌ filteredPlayers is not an array:', filteredPlayers);
        filteredPlayers = [];
    }

    if (filteredPlayers.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏈</div>
                <h3>No players found</h3>
                <p>Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }
   
    console.log(`🎯 RENDERING ${filteredPlayers.length} players`);

    // Calculate fantasy points if needed
    if (showFantasyStats && currentScoringRules && Object.keys(currentScoringRules).length > 0) {
        filteredPlayers = filteredPlayers.map(player => {
            if (!player.fantasyPoints && player.rawStats) {
                player.fantasyPoints = calculateTotalFantasyPoints(player);
            }
            return player;
        });
    }

if (currentView === 'research') {
       filteredPlayers = getSortedPlayers(filteredPlayers);
   }

   switch (currentView) {
       case 'cards':
           renderCardsView(filteredPlayers);
           break;
       case 'research':
           renderResearchView(filteredPlayers);
           break;
       case 'stats':
           renderStatsView(filteredPlayers);
           break;
   }
}

function renderCardsView(players) {
   const content = document.getElementById('content');
   content.innerHTML = `
       <div class="player-grid">
           ${players.map(player => renderPlayerCard(player)).join('')}
       </div>
   `;
}

// Enhanced player card with rankings
function renderPlayerCard(player) {
   const stats = keyStats[player.position] || [];
   const totalFantasyPoints = player.fantasyPoints || calculateTotalFantasyPoints(player);
   
   return `
       <div class="player-card fade-in" onclick="navigateToPlayer('${player.id}')">
           <div class="player-header">
               <div class="player-info">
                   <h3>${player.name}</h3>
                   <div class="player-meta">
                       <span class="position-badge">${player.position}</span>
                       <span>${player.team}</span>
                       ${showFantasyStats && totalFantasyPoints > 0 ? 
                           `<span class="fantasy-total">${totalFantasyPoints} pts</span>` : ''
                       }
                       ${showFantasyStats && player.overallRank ? 
                           `<span class="rank-badge">Overall: #${player.overallRank}</span>` : ''
                       }
                       ${showFantasyStats && player.positionRank ? 
                           `<span class="position-rank-badge">${player.position}: #${player.positionRank}</span>` : ''
                       }
                   </div>
               </div>
           </div>
           <div class="stat-grid">
               ${stats.map(stat => {
                   const rawValue = player.stats[stat] || 0;
                   const displayValue = getStatValue(player, stat);
                   const isFantasyMode = showFantasyStats && displayValue !== rawValue && displayValue > 0;
                   const isBest = checkIfBestStat(player, stat);
                   
                   return `
                       <div class="stat-item ${isBest ? 'stat-best' : ''}">
                           <span class="stat-value ${isFantasyMode ? 'fantasy-points' : ''}">
                               ${formatStatValue(displayValue, stat, isFantasyMode)}
                           </span>
                           <span class="stat-label">${stat}</span>
                       </div>
                   `;
               }).join('')}
           </div>
       </div>
   `;
}

// Render research view with ALL fantasy stats and bonus columns
function renderResearchView(players) {
    const content = document.getElementById('content');
    const allStats = getStatsForPosition(currentFilters.position);
    
    // Filter out columns that are all zeros
    const visibleStats = getVisibleStats(players, allStats);
    const bonusStats = showFantasyStats ? visibleStats.filter(stat => hasBonusRule(stat)) : [];
    
    content.innerHTML = `
        <div class="research-container fade-in">
            <div class="research-header">
                <h2>Research Table - ${showFantasyStats ? 'Fantasy Points' : 'Raw Stats'}</h2>
                <div class="research-controls">
                    ${showFantasyStats ? '<span class="bonus-note">Fantasy stats with bonus targets</span>' : '<span class="stats-note">Raw statistics</span>'}
                    <span class="player-count">Showing ${players.length} players</span>
                    ${apiState.hasMore ? '<button id="load-more-btn" class="clear-filters-btn">Load More Players</button>' : ''}
                </div>
            </div>
            <div class="research-table-wrapper">
                <table class="research-table">
                    <thead>
                        <tr>
                            <th class="sortable">Player</th>
                            <th class="sortable">Pos</th>
                            <th class="sortable">Team</th>
                            ${showFantasyStats ? '<th class="sortable">Overall Rank</th>' : ''}
                            ${showFantasyStats ? '<th class="sortable">Pos Rank</th>' : ''}
                            ${showFantasyStats ? '<th class="sortable">Total Fantasy Pts</th>' : ''}
                            ${visibleStats.map(stat => `
                                <th class="sortable">${stat}</th>
                            `).join('')}
                            ${bonusStats.map(stat => {
                                const target = getBonusTarget(stat);
                                return `<th class="bonus-header sortable">${stat} ${target}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => {
                            return `
                                <tr class="clickable-row" onclick="navigateToPlayer('${player.id}')">
                                    <td>${player.name}</td>
                                    <td>${player.position}</td>
                                    <td>${player.team}</td>
                                    ${showFantasyStats ? `<td class="rank-cell">#${player.overallRank || '-'}</td>` : ''}
                                    ${showFantasyStats ? `<td class="rank-cell">#${player.positionRank || '-'}</td>` : ''}
                                    ${showFantasyStats ? `
                                        <td class="fantasy-stat-cell total-points">
                                            ${player.fantasyPoints ? player.fantasyPoints + ' pts' : calculateTotalFantasyPoints(player) + ' pts'}
                                        </td>
                                    ` : ''}
                                    ${visibleStats.map(stat => {
                                        const rawValue = player.stats[stat] || 0;
                                        const displayValue = showFantasyStats ? getStatValue(player, stat) : rawValue;
                                        const isFantasyMode = showFantasyStats && displayValue !== rawValue;
                                        
                                        return `
                                            <td>
                                                <span class="${isFantasyMode ? 'fantasy-stat-cell' : ''}">
                                                    ${formatStatValue(displayValue, stat, isFantasyMode)}
                                                </span>
                                            </td>
                                        `;
                                    }).join('')}
                                    ${bonusStats.map(stat => {
                                        const bonusPoints = getBonusPoints(player, stat);
                                        return `
                                            <td class="bonus-cell">
                                                ${bonusPoints}
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Add event listener for load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            if (apiState.hasMore && !apiState.loading) {
                apiState.currentPage++;
                await loadStats(false);
            }
        });
    }
    
    // 🔥 INITIALIZE TABLE SORTING AFTER RENDERING
    setTimeout(() => {
        if (window.tableSorter) {
            window.tableSorter.initializeSorting();
        }
    }, 100);
}

function getStatAbbreviation(statName) {
   const abbreviations = {
       "Pass Yds": "PY",
       "Pass TD": "PTD",
       "Rush Yds": "RY", 
       "Rush TD": "RTD",
       "Rec Yds": "ReY",
       "Rec TD": "ReTD",
       "Rec": "Rec",
       "FG": "FG",
       "Tack Solo": "Solo",
       "Sack": "Sack",
       "Int": "Int"
   };
   
   return abbreviations[statName] || statName.slice(0, 3);
}

function getBonusTarget(statName) {
   if (!currentScoringRules) return '';
   
   const statId = Object.keys(STAT_ID_MAPPING).find(id => 
       STAT_ID_MAPPING[id] === statName
   );
   
   if (!statId || !currentScoringRules[statId]) return '';
   
   const rule = currentScoringRules[statId];
   if (!rule.bonuses || !Array.isArray(rule.bonuses) || rule.bonuses.length === 0) return '';
   
   return rule.bonuses[0].bonus.target || '';
}

// Function to get bonus points for a specific stat
function getBonusPoints(player, statName) {
   if (!showFantasyStats || !currentScoringRules || !player.rawStats) {
       return 0;
   }
   
   // Find the stat ID that matches this stat name
   const statId = Object.keys(STAT_ID_MAPPING).find(id => 
       STAT_ID_MAPPING[id] === statName
   );
   
   if (!statId || !currentScoringRules[statId]) {
       return 0;
   }
   
   const rule = currentScoringRules[statId];
   const rawValue = player.rawStats[statId] || 0;
   
   if (!rule.bonuses || !Array.isArray(rule.bonuses) || rawValue === 0) {
       return 0;
   }
   
   let totalBonusPoints = 0;
   
   rule.bonuses.forEach((bonusRule, index) => {
       const target = parseFloat(bonusRule.bonus.target || 0);
       const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
       
       if (target > 0 && rawValue >= target) {
           const bonusesEarned = Math.floor(rawValue / target);
           totalBonusPoints += bonusesEarned * bonusPoints;
       }
   });
   
   return Math.round(totalBonusPoints * 100) / 100;
}

// Get stats that have bonus rules for position
function getBonusStatsForPosition(position) {
   const stats = getStatsForPosition(position);
   return stats.filter(stat => hasBonusRule(stat));
}

// Helper function to check if a stat has bonus rules
function hasBonusRule(statName) {
   if (!currentScoringRules) return false;
   
   const statId = Object.keys(STAT_ID_MAPPING).find(id => 
       STAT_ID_MAPPING[id] === statName
   );
   
   if (!statId || !currentScoringRules[statId]) return false;
   
   const rule = currentScoringRules[statId];
   return rule.bonuses && Array.isArray(rule.bonuses) && rule.bonuses.length > 0;
}

function renderStatsView(players) {
   const content = document.getElementById('content');
   const stats = getStatsForPosition(currentFilters.position);
   const statCategories = categorizeStats(stats);
   
   content.innerHTML = `
       <div class="stats-overview fade-in">
           <h2>Leaders ${showFantasyStats ? '(Fantasy Points)' : '(Raw Stats)'}</h2>
           ${Object.entries(statCategories).map(([category, categoryStats]) => `
               <div class="stat-category">
                   <div class="stat-category-title">${category}</div>
                   ${categoryStats.map(stat => {
                       const leaders = getStatLeaders(players, stat, 3);
                       return `
                           <div class="stat-row">
                               <span>${stat}</span>
                               <span>${leaders.map(l => {
                                   const displayValue = showFantasyStats ? 
                                       getStatValue({stats: {[stat]: l.value}}, stat) : l.value;
                                   const suffix = showFantasyStats && displayValue !== l.value && displayValue > 0 ? ' pts' : '';
                                   return `${l.name} (${formatStatValue(displayValue, stat, showFantasyStats && displayValue !== l.value)}${suffix})`;
                               }).join(', ')}</span>
                           </div>
                       `;
                   }).join('')}
               </div>
           `).join('')}
       </div>
   `;
}

// Helper functions
function getStatsForPosition(position) {
   if (position === 'ALL') {
       const allStats = new Set();
       Object.values(positionStats).forEach(stats => {
           stats.forEach(stat => allStats.add(stat));
       });
       return Array.from(allStats);
   }
   return positionStats[position] || [];
}

// Helper function to check if a player received bonus points for a stat
function hasBonusApplied(player, statName) {
   if (!showFantasyStats || !currentScoringRules || !player.rawStats) return false;
   
   const statId = Object.keys(STAT_ID_MAPPING).find(id => 
       STAT_ID_MAPPING[id] === statName
   );
   
   if (!statId || !currentScoringRules[statId]) return false;
   
   const rule = currentScoringRules[statId];
   const rawValue = player.rawStats[statId] || 0;
   
   if (!rule.bonuses || !Array.isArray(rule.bonuses) || rawValue === 0) return false;
   
   // Check if any bonus threshold is met
   return rule.bonuses.some(bonusRule => {
       const target = parseFloat(bonusRule.bonus.target || 0);
       return rawValue >= target;
   });
}

function categorizeStats(stats) {
   const categories = {
       "Passing": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack"],
       "Rushing": ["Rush Att", "Rush Yds", "Rush TD"],
       "Receiving": ["Rec", "Rec Yds", "Rec TD"],
       "Kicking": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49", "FG 50+", "XP Made", "XP Miss"],
       "Defense": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick"],
       "Special Teams": ["Ret Yds", "Ret TD", "Kick Ret TD", "Punt Ret TD"],
       "Team Defense": ["Pts Allow 0", "Pts Allow 1-6", "Pts Allow 7-13", "Pts Allow 14-20", "Pts Allow 21-27", "Pts Allow 28-34", "Pts Allow 35+"],
       "Turnovers": ["Fum", "Fum Rec", "Off Fum Ret TD"],
       "Scoring": ["2-PT"]
   };

   const result = {};
   stats.forEach(stat => {
       for (const [category, categoryStats] of Object.entries(categories)) {
           if (categoryStats.includes(stat)) {
               if (!result[category]) result[category] = [];
               result[category].push(stat);
               break;
           }
       }
   });
   return result;
}

function getStatLeaders(players, stat, limit = 3) {
   return players
       .filter(p => p.stats[stat] !== undefined && p.stats[stat] > 0)
       .map(p => ({ 
           name: p.name, 
           value: p.stats[stat] || 0,
           rawStats: p.rawStats
       }))
       .sort((a, b) => {
           const aValue = showFantasyStats ? getStatValue({stats: {[stat]: a.value}}, stat) : a.value;
           const bValue = showFantasyStats ? getStatValue({stats: {[stat]: b.value}}, stat) : b.value;
           
           // For negative stats, sort ascending (lower is better)
           if (stat.includes('Miss') || stat.includes('Allow') || stat === 'Int' || stat === 'Fum') {
               return aValue - bValue;
           }
           return bValue - aValue;
       })
       .slice(0, limit);
}

function checkIfBestStat(player, stat) {
   const players = getFilteredPlayers().filter(p => p.position === player.position);
   const playerValue = getStatValue(player, stat);
   const values = players.map(p => getStatValue(p, stat)).filter(v => v > 0);
   
   if (values.length === 0) return false;
   
   // For negative stats, best is lowest
   if (stat.includes('Miss') || stat.includes('Allow') || stat === 'Int' || stat === 'Fum') {
       return playerValue === Math.min(...values) && playerValue > 0;
   }
   return playerValue === Math.max(...values) && playerValue > 0;
}

function formatStatValue(value, stat, isFantasyMode = false) {
   if (isFantasyMode && value > 0) {
       return `${value} pts`;
   }
   
   if (typeof value === 'number') {
       if (value % 1 !== 0) {
           return value.toFixed(1);
       }
   }
   
   return value.toString();
}

// Navigation function to player detail page
function navigateToPlayer(playerId) {
   const url = `player.html?id=${encodeURIComponent(playerId)}`;
   window.location.href = url;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
   console.log('🚀 Initializing Fantasy Football Dashboard with new player-centric system...');
   
   // Clear old cache data
   localStorage.removeItem('allScoringRules');
   
   const header = document.querySelector('.header');
   const filterControlsHtml = createFilterControls();
   if (filterControlsHtml && header) {
       const filterContainer = document.createElement('div');
       filterContainer.className = 'filter-controls-container';
       filterContainer.innerHTML = filterControlsHtml;
       header.appendChild(filterContainer);
   }
   
   setupEventListeners();
   
   console.log('🔄 Loading leagues and scoring rules first...');
   try {
       await loadUserLeagues();
       console.log('✅ Leagues and scoring rules loaded');
       
       updateFilterControlsUI();
   } catch (error) {
       console.warn('⚠️ Leagues failed to load, continuing with raw stats only');
   }
   
   console.log('📊 Loading initial stats data with new system...');
   await loadStats(true);
   
   console.log('🎉 Dashboard initialization complete with new player-centric IndexedDB schema!');
});
