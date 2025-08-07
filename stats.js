// stats.js - Enhanced Dashboard with Research Table
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

// COMPLETE Yahoo stat ID mapping - ALL STATS FROM YOUR SCORING RULES
const STAT_ID_MAPPING = {
    "0": "Games Played",
    "1": "Pass Att",
    "2": "Comp",
    "3": "Inc", 
    "4": "Pass Yds",
    "5": "Pass TD",
    "6": "Int",
    "7": "Sacks Taken", // Offensive sacks (negative)
    "8": "Rush Att",
    "9": "Rush Yds", 
    "10": "Rush TD",
    "11": "Rec",
    "12": "Rec Yds",
    "13": "Rec TD",
    "14": "Ret Yds",
    "15": "Ret TD",
    "16": "Off Fum Ret TD",
    "17": "Fum Lost", // Usually negative
    "18": "Fum", // Fumbles (negative)
    "19": "Fum Rec",
    "20": "FG 0-19",
    "21": "FG 20-29",
    "22": "FG 30-39",
    "23": "FG 40-49",
    "24": "FG 50+", // Your data shows negative - missed kicks?
    "25": "FG Miss 0-19",
    "26": "FG Miss 20-29", 
    "27": "FG Miss 30-39",
    "28": "FG Miss 40-49",
    "29": "FG Miss 50+",
    "30": "XP Made",
    "31": "XP Miss",
    "32": "Pts Allow 0",
    "33": "Pts Allow 1-6", 
    "34": "Pts Allow 7-13",
    "35": "Pts Allow 14-20",
    "36": "Pts Allow 21-27",
    "37": "Pts Allow 28-34",
    "38": "Pts Allow 35+",
    "39": "Tack Solo",
    "40": "Tack Ast",
    "41": "Sack", // Defensive sacks (positive)
    "42": "Int", // Defensive interceptions (positive)
    "43": "Fum Force",
    "44": "Fum Rec TD",
    "45": "Int TD",
    "46": "Blk Kick",
    "47": "Safe",
    "48": "Pass Def",
    "49": "Kick Ret TD",
    "50": "Punt Ret TD",
    "51": "FG Ret TD",
    "52": "Blk FG TD",
    "53": "Blk Punt TD",
    "54": "Blk PAT TD",
    "55": "Fum Ret TD",
    "56": "Int Ret TD",
    "57": "Off Snaps",
    "58": "Off Snap %",
    "59": "Def Snaps", 
    "60": "Def Snap %",
    "61": "ST Snaps",
    "62": "ST Snap %",
    "63": "Games Started",
    "64": "Off Plays",
    "65": "Yds Allow 0-99",
    "66": "Yds Allow 100-199",
    "67": "Yds Allow 200-299",
    "68": "Yds Allow 300-399",
    "69": "Yds Allow 400-499",
    "70": "Yds Allow 500+",
    "71": "Rush Yds Allow 0-99",
    "72": "Rush Yds Allow 100-149", 
    "73": "Rush Yds Allow 150+",
    "74": "Pass Yds Allow 0-199",
    "75": "Pass Yds Allow 200-299",
    "76": "Pass Yds Allow 300+",
    "77": "Tack Total",
    "78": "Tack Total Alt",
    "79": "Tack Loss",
    "80": "QB Hits",
    "81": "Hurries",
    "82": "Def TD",
    "83": "ST TD",
    "84": "4th Down Stops"
};

// Convert Yahoo stat IDs to readable names
function convertStatsForDisplay(rawStats) {
    const readableStats = {};
    
    Object.entries(rawStats).forEach(([statId, value]) => {
        const readableName = STAT_ID_MAPPING[statId];
        if (readableName && value != null) {
            readableStats[readableName] = value;
        }
    });

    return readableStats;
}

// Position stat mappings
const positionStats = {
    "QB": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack", "Rush Att", "Rush Yds", "Rush TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Rec"],
    "RB": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Rec"],
    "WR": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Rec"],
    "TE": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Rec"],
    "K": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49", "FG 50+", "FG Miss 0-19", "FG Miss 20-29", "FG Miss 30-39", "FG Miss 40-49", "FG Miss 50+", "XP Made", "XP Miss"],
    "DST": ["Pts Allow 0", "Pts Allow 1-6", "Pts Allow 7-13", "Pts Allow 14-20", "Pts Allow 21-27", "Pts Allow 28-34", "Pts Allow 35+", "Sack", "Int", "Fum Rec", "Safe", "Def TD", "ST TD"],
    "LB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick"],
    "CB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick"],
    "S": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick"],
    "DE": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick"],
    "DT": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "Def TD", "Safe", "Blk Kick", "Ret Yds", "Ret TD"]
};

// Key stats for card view
const keyStats = {
    "QB": ["Pass Yds", "Pass TD", "Int", "Rush Yds"],
    "RB": ["Rush Yds", "Rush TD", "Rec", "Rec Yds"],
    "WR": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "TE": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "K": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49"],
    "DST": ["Pts Allow 0", "Sack", "Int", "Def TD"],
    "LB": ["Tack Solo", "Sack", "Int", "Fum Force"],
    "CB": ["Tack Solo", "Pass Def", "Int", "Def TD"],
    "S": ["Tack Solo", "Pass Def", "Int", "Def TD"],
    "DE": ["Tack Solo", "Sack", "Fum Force", "Def TD"],
    "DT": ["Tack Solo", "Sack", "Fum Force", "Def TD"]
};

// Backend API functions
async function loadUserLeagues() {
    try {
        const response = await fetch('/data/stats/rules'); // NO leagueId parameter
        if (!response.ok) throw new Error('Failed to load leagues');
        
        const data = await response.json();
        
        // Handle the NEW response format
        if (data.leagues && data.defaultLeagueId && data.scoringRules) {
            userLeagues = data.leagues;
            
            // Set the default league and its scoring rules immediately
            const defaultLeagueId = data.defaultLeagueId;
            currentScoringRules = data.scoringRules[defaultLeagueId] || {};
            
            // Store active league in localStorage
            localStorage.setItem('activeLeagueId', defaultLeagueId);
            currentFilters.league = defaultLeagueId;
            
            console.log(`✅ Loaded ${Object.keys(userLeagues).length} leagues`);
            console.log(`🎯 Set default league: ${defaultLeagueId} with ${Object.keys(currentScoringRules).length} scoring rules`);
            
            // Store in localStorage
            localStorage.setItem('userLeagues', JSON.stringify({
                leagues: userLeagues,
                timestamp: Date.now()
            }));
            
            return userLeagues;
        }
        
        // Fallback to old format
        userLeagues = data.leagues || {};
        
        localStorage.setItem('userLeagues', JSON.stringify({
            leagues: userLeagues,
            timestamp: Date.now()
        }));
        
        return userLeagues;
    } catch (error) {
        console.error('Error loading leagues:', error);
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
}

// FIXED: Load scoring rules and extract the correct nested structure
async function loadScoringRulesForActiveLeague(leagueId) {
    if (!leagueId) {
        console.log('❌ No league ID provided for scoring rules');
        currentScoringRules = {};
        return;
    }
    
    try {
        console.log(`🔄 Loading scoring rules for league: ${leagueId}`);
        
        const rulesData = await window.statsAPI.getScoringRules(leagueId);
        
        if (rulesData && typeof rulesData === 'object') {
            // FIXED: Extract the correct structure - rules are nested by leagueId
            if (rulesData[leagueId]) {
                currentScoringRules = rulesData[leagueId];
                console.log(`✅ Loaded ${Object.keys(currentScoringRules).length} scoring rules for league ${leagueId}`);
            } else {
                console.log(`⚠️ No scoring rules found for league ${leagueId}`);
                currentScoringRules = {};
            }
        } else {
            console.log(`⚠️ No scoring rules data found for league ${leagueId}`);
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
        
        <div class="api-status">
            <div class="api-info">
                ${apiState.loading ? 
                    '<span class="loading">Loading...</span>' : 
                    `<span class="record-count">${apiState.totalRecords} total records | ${showFantasyStats ? 'Fantasy Mode (' + Object.keys(currentScoringRules).length + ' rules)' : 'Raw Stats'}</span>`
                }
                ${apiState.error ? `<span class="error">${apiState.error}</span>` : ''}
            </div>
            
            ${apiState.totalPages > 1 ? `
                <div class="pagination-info">
                    Page ${apiState.currentPage} of ${apiState.totalPages}
                    ${apiState.hasMore ? '<button id="load-more-btn" class="load-more-btn">Load More</button>' : ''}
                </div>
            ` : ''}
        </div>
    `;
}

// Load stats function
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
        const data = await window.statsAPI.getPlayersData(
            currentFilters.year,
            currentFilters.week,
            currentFilters.position,
            apiState.currentPage
        );
        
        const playersWithReadableStats = data.data.map(player => ({
            ...player,
            rawStats: player.stats, // Keep original raw stats
            stats: convertStatsForDisplay(player.stats) // Readable stats for display
        }));
        
        if (resetPage) {
            currentPlayers = playersWithReadableStats;
        } else {
            currentPlayers = [...currentPlayers, ...playersWithReadableStats];
        }
        
        apiState.totalPages = data.pagination.totalPages;
        apiState.totalRecords = data.pagination.totalRecords;
        apiState.hasMore = data.pagination.hasNext;
        apiState.loading = false;
        
        console.log(`✅ Loaded ${data.count} players, total: ${currentPlayers.length}`);
        
    } catch (error) {
        console.error('Failed to load stats:', error);
        apiState.error = error.message;
        apiState.loading = false;
    }
    
    updateFilterControlsUI();
    render();
}

// Event listeners
function setupEventListeners() {
    if (eventListenersSetup) {
        return;
    }

    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', async (e) => {
            currentFilters.year = e.target.value;
            currentFilters.week = 'total';
            await loadStats(true);
        });
    }
    
    const weekSelect = document.getElementById('week-select');
    if (weekSelect) {
        weekSelect.addEventListener('change', async (e) => {
            currentFilters.week = e.target.value;
            saveWeekPreference(e.target.value);
            await loadStats(true);
        });
    }
    
    const leagueSelect = document.getElementById('league-select');
    if (leagueSelect) {
        leagueSelect.addEventListener('change', async (e) => {
            currentFilters.league = e.target.value;
            localStorage.setItem('activeLeagueId', e.target.value);
            
            // Load scoring rules for the new league ONLY
            await loadScoringRulesForActiveLeague(e.target.value);
            
            updateFilterControlsUI();
            render();
        });
    }
    
    const teamSelect = document.getElementById('team-select');
    if (teamSelect) {
        teamSelect.addEventListener('change', (e) => {
            currentFilters.team = e.target.value;
            render();
        });
    }
    
    document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            showFantasyStats = e.target.dataset.mode === 'fantasy';
            console.log(`🔄 Switched to ${showFantasyStats ? 'Fantasy' : 'Raw'} stats mode`);
            render();
        });
    });
    
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            if (apiState.hasMore && !apiState.loading) {
                apiState.currentPage++;
                await loadStats(false);
            }
        });
    }
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            render();
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            render();
        });
    }
    
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

function getFilteredPlayers() {
    let filteredPlayers = currentPlayers;
    
    if (searchQuery) {
        filteredPlayers = filteredPlayers.filter(player => {
            return player.name.toLowerCase().includes(searchQuery) ||
                   player.team.toLowerCase().includes(searchQuery);
        });
    }
    
    return filteredPlayers;
}

// FIXED Fantasy points calculation - SIMPLE MULTIPLICATION
function calculateFantasyPoints(statName, rawStatValue) {
    if (!showFantasyStats || !currentScoringRules || !rawStatValue || rawStatValue === 0) {
        return rawStatValue || 0;
    }
    
    // Find the stat ID for the given stat name
    const statId = Object.keys(STAT_ID_MAPPING).find(id => 
        STAT_ID_MAPPING[id] === statName
    );
    
    if (!statId || !currentScoringRules[statId]) {
        return rawStatValue || 0;
    }
    
    const rule = currentScoringRules[statId];
    
    // Base points calculation
    let points = rawStatValue * parseFloat(rule.points || 0);
    
    // FIXED: Add bonus points if applicable
    if (rule.bonuses && Array.isArray(rule.bonuses)) {
        rule.bonuses.forEach(bonusRule => {
            const target = parseFloat(bonusRule.bonus.target || 0);
            const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
            
            if (rawStatValue >= target) {
                points += bonusPoints;
                console.log(`🎯 BONUS: ${statName} ${rawStatValue} >= ${target}, adding ${bonusPoints} pts`);
            }
        });
    }
    
    const finalPoints = Math.round(points * 100) / 100;
    console.log(`💰 ${statName} (${statId}): ${rawStatValue} * ${rule.points} + bonuses = ${finalPoints} pts`);
    
    return finalPoints;
}

// Calculate total fantasy points for a player
function calculateTotalFantasyPoints(player) {
    if (!showFantasyStats || !currentScoringRules || !player.rawStats) {
        return 0;
    }
    
    let totalPoints = 0;
    let calculationBreakdown = [];
    
    // Use RAW stats for calculation
    Object.entries(player.rawStats).forEach(([statId, statValue]) => {
        if (currentScoringRules[statId] && statValue > 0) {
            const statName = STAT_ID_MAPPING[statId];
            const rule = currentScoringRules[statId];
            
            // Base points
            let points = statValue * parseFloat(rule.points || 0);
            
            // Add bonuses
            if (rule.bonuses && Array.isArray(rule.bonuses)) {
                rule.bonuses.forEach(bonusRule => {
                    const target = parseFloat(bonusRule.bonus.target || 0);
                    const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
                    
                    if (statValue >= target) {
                        points += bonusPoints;
                        calculationBreakdown.push(`${statName}: +${bonusPoints} bonus (${statValue} >= ${target})`);
                    }
                });
            }
            
            if (points !== 0) {
                totalPoints += points;
                calculationBreakdown.push(`${statName}: ${statValue} * ${rule.points} = ${points}`);
            }
        }
    });
    
    const finalTotal = Math.round(totalPoints * 100) / 100;
    
    // Log breakdown for debugging
    if (calculationBreakdown.length > 0) {
        console.log(`🏈 ${player.name} total: ${finalTotal} pts`, calculationBreakdown.slice(0, 5));
    }
    
    return finalTotal;
}

// FIXED: Get stat value for display - PROPER conversion
function getStatValue(player, statName) {
    const rawValue = player.stats[statName] || 0;
    
    if (!showFantasyStats || !currentScoringRules || rawValue === 0) {
        return rawValue;
    }
    
    // Find the stat ID for fantasy calculation
    const statId = Object.keys(STAT_ID_MAPPING).find(id => 
        STAT_ID_MAPPING[id] === statName
    );
    
    if (statId && currentScoringRules[statId]) {
        return calculateFantasyPoints(statName, rawValue);
    }
    
    return rawValue;
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
        } else if (tableSort.column === 'totalPts') {
            aValue = calculateTotalFantasyPoints(a);
            bValue = calculateTotalFantasyPoints(b);
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
function render() {
    const content = document.getElementById('content');
    let filteredPlayers = getFilteredPlayers();

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

function renderPlayerCard(player) {
    const stats = keyStats[player.position] || [];
    const totalFantasyPoints = calculateTotalFantasyPoints(player);
    
    return `
        <div class="player-card fade-in">
            <div class="player-header">
                <div class="player-info">
                    <h3>${player.name}</h3>
                    <div class="player-meta">
                        <span class="position-badge">${player.position}</span>
                        <span>${player.team}</span>
                        ${showFantasyStats && totalFantasyPoints > 0 ? `<span class="fantasy-total">${totalFantasyPoints} pts</span>` : ''}
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

// FIXED: Render research view with separate bonus columns visible
function renderResearchView(players) {
    const content = document.getElementById('content');
    const stats = getStatsForPosition(currentFilters.position);
    const bonusStats = getBonusStatsForPosition(currentFilters.position);
    
    content.innerHTML = `
        <div class="research-container fade-in">
            <div class="research-header">
                <h2>Research Table - ${showFantasyStats ? 'Fantasy Points' : 'Raw Stats'}</h2>
                <div class="research-controls">
                    <button class="clear-filters-btn" onclick="clearAllFilters()">
                        Clear Sort
                    </button>
                    ${showFantasyStats ? '<span class="bonus-note">Bonus columns show bonus points earned</span>' : ''}
                </div>
            </div>
            <div class="research-table-wrapper">
                <table class="research-table">
                    <thead>
                        <tr>
                            <th class="sortable" onclick="sortTable('name')">Player</th>
                            <th class="sortable" onclick="sortTable('position')">Pos</th>
                            <th class="sortable" onclick="sortTable('team')">Team</th>
                            ${showFantasyStats ? '<th class="sortable" onclick="sortTable(\'totalPts\')">Total Pts</th>' : ''}
                            ${stats.map(stat => `
                                <th class="sortable" onclick="sortTable('${stat}')">${stat}</th>
                                ${showFantasyStats && hasBonusRule(stat) ? `
                                    <th class="sortable bonus-header" onclick="sortTable('${stat}_bonus')">${stat} Bonus</th>
                                ` : ''}
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => {
                            const totalFantasyPoints = calculateTotalFantasyPoints(player);
                            return `
                                <tr>
                                    <td class="player-name-cell">${player.name}</td>
                                    <td>${player.position}</td>
                                    <td>${player.team}</td>
                                    ${showFantasyStats ? `
                                        <td class="fantasy-stat-cell">
                                            ${totalFantasyPoints > 0 ? totalFantasyPoints + ' pts' : '0 pts'}
                                        </td>
                                    ` : ''}
                                    ${stats.map(stat => {
                                        const rawValue = player.stats[stat] || 0;
                                        const displayValue = getStatValue(player, stat);
                                        const bonusPoints = getBonusPoints(player, stat);
                                        const isFantasyMode = showFantasyStats && displayValue !== rawValue;
                                        const isBest = checkIfBestStat(player, stat);
                                        
                                        return `
                                            <td class="${isBest ? 'stat-best' : ''}">
                                                <span class="${isFantasyMode ? 'fantasy-stat-cell' : ''}">
                                                    ${formatStatValue(displayValue, stat, isFantasyMode)}
                                                </span>
                                            </td>
                                            ${showFantasyStats && hasBonusRule(stat) ? `
                                                <td class="bonus-cell">
                                                    ${bonusPoints > 0 ? '+' + bonusPoints + ' pts' : '0'}
                                                </td>
                                            ` : ''}
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
}

// NEW: Function to get bonus points for a specific stat
function getBonusPoints(player, statName) {
    if (!showFantasyStats || !currentScoringRules || !player.rawStats) return 0;
    
    const statId = Object.keys(STAT_ID_MAPPING).find(id => 
        STAT_ID_MAPPING[id] === statName
    );
    
    if (!statId || !currentScoringRules[statId]) return 0;
    
    const rule = currentScoringRules[statId];
    const rawValue = player.rawStats[statId] || 0;
    
    if (!rule.bonuses || !Array.isArray(rule.bonuses) || rawValue === 0) return 0;
    
    let totalBonusPoints = 0;
    rule.bonuses.forEach(bonusRule => {
        const target = parseFloat(bonusRule.bonus.target || 0);
        const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
        
        if (rawValue >= target) {
            totalBonusPoints += bonusPoints;
        }
    });
    
    return Math.round(totalBonusPoints * 100) / 100;
}

// NEW: Get stats that have bonus rules for position
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing Fantasy Football Dashboard...');
  
  // Clear any old localStorage scoring rules
  localStorage.removeItem('allScoringRules');
  
  await loadUserLeagues();
  
  currentFilters.league = initializeActiveLeague();
  console.log('🎯 Active league:', currentFilters.league);
  
  currentFilters.week = getSavedWeek();
  
  // Load scoring rules ONLY for the active league from IndexedDB
  if (currentFilters.league) {
      await loadScoringRulesForActiveLeague(currentFilters.league);
  }
  
  const header = document.querySelector('.header');
  const filterControlsHtml = createFilterControls();
  if (filterControlsHtml && header) {
      const filterContainer = document.createElement('div');
      filterContainer.className = 'filter-controls-container';
      filterContainer.innerHTML = filterControlsHtml;
      header.appendChild(filterContainer);
  }
  
  setupEventListeners();
  
  console.log('📊 Loading initial stats data...');
  await loadStats(true);
  
  console.log('🎉 Dashboard initialization complete!');
});
