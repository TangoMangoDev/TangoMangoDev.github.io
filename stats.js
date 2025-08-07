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
let currentScoringRules = {};
let tableSort = {
    column: null,
    direction: 'asc'
};
let columnFilters = {};

// Yahoo stat ID mapping
const STAT_ID_MAPPING = {
    "0": "Games Played",
    "1": "Pass Att",
    "2": "Comp",
    "3": "Inc", 
    "4": "Pass Yds",
    "5": "Pass TD",
    "6": "Int",
    "7": "Sack",
    "8": "Rush Att",
    "9": "Rush Yds", 
    "10": "Rush TD",
    "11": "Rec",
    "12": "Rec Yds",
    "13": "Rec TD",
    "14": "Ret Yds",
    "15": "Ret TD",
    "16": "Off Fum Ret TD",
    "17": "2-PT",
    "18": "Fum",
    "19": "Fum Lost",
    "20": "FG",
    "21": "FGM",
    "22": "Pts Allow",
    "23": "Tack Solo",
    "24": "Tack Ast",
    "25": "Pass Def",
    "26": "Sack",
    "27": "Int",
    "28": "Fum Rec",
    "29": "Fum Force",
    "30": "TD",
    "31": "Safe",
    "32": "Blk Kick",
    "33": "Ret Yds",
    "34": "Ret TD",
    "57": "Off Snaps",
    "58": "Off Snap %",
    "59": "Def Snaps", 
    "60": "Def Snap %",
    "61": "ST Snaps",
    "62": "ST Snap %",
    "63": "Games Started",
    "64": "Off Plays",
    "78": "Tack Total",
    "79": "Tack Loss",
    "80": "QB Hits",
    "81": "Hurries"
};

// Convert Yahoo stat IDs to readable names
function convertStatsForDisplay(rawStats) {
    const readableStats = {};
    
    Object.entries(rawStats).forEach(([statId, value]) => {
        const readableName = STAT_ID_MAPPING[statId];
        if (readableName && value != null && value !== 0) {
            readableStats[readableName] = value;
        }
    });

    return readableStats;
}

// Position stat mappings
const positionStats = {
    "QB": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack", "Rush Att", "Rush Yds", "Rush TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "RB": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "WR": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "TE": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "K": ["FG", "FGM"],
    "DST": ["Pts Allow"],
    "LB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "CB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "S": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "DE": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "DT": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "Ret Yds", "Ret TD"]
};

// Key stats for card view
const keyStats = {
    "QB": ["Pass Yds", "Pass TD", "Int", "Rush Yds"],
    "RB": ["Rush Yds", "Rush TD", "Rec", "Rec Yds"],
    "WR": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "TE": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "K": ["FG", "FGM"],
    "DST": ["Pts Allow"],
    "LB": ["Tack Solo", "Sack", "Int", "Fum Force"],
    "CB": ["Tack Solo", "Pass Def", "Int", "TD"],
    "S": ["Tack Solo", "Pass Def", "Int", "TD"],
    "DE": ["Tack Solo", "Sack", "Fum Force", "TD"],
    "DT": ["Tack Solo", "Sack", "Fum Force", "TD"]
};

// Scoring rules functions
async function loadScoringRules(leagueId) {
    if (!leagueId) return {};
    
    try {
        const response = await fetch(`/data/stats/rules?leagueId=${leagueId}`);
        if (!response.ok) throw new Error('Failed to load scoring rules');
        
        const data = await response.json();
        return data.scoringRules || {};
    } catch (error) {
        console.error('Error loading scoring rules:', error);
        return {};
    }
}

// Fantasy data functions
function getFantasyDataFromLocalStorage() {
    try {
        const storedData = localStorage.getItem('fantasyLeagueData');
        return storedData ? JSON.parse(storedData) : null;
    } catch (error) {
        console.error('Error retrieving fantasy data from localStorage:', error);
        return null;
    }
}

function initializeActiveLeague() {
    const fantasyData = getFantasyDataFromLocalStorage();
    if (!fantasyData || !fantasyData.leagues || Object.keys(fantasyData.leagues).length === 0) {
        return null;
    }
    
    let activeLeagueId = localStorage.getItem('activeLeagueId');
    
    if (!activeLeagueId || !fantasyData.leagues[activeLeagueId]) {
        activeLeagueId = Object.keys(fantasyData.leagues)[0];
        localStorage.setItem('activeLeagueId', activeLeagueId);
    }
    
    return activeLeagueId;
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

// Filter controls
function createFilterControls() {
    const fantasyData = getFantasyDataFromLocalStorage();
    const activeLeagueId = currentFilters.league || initializeActiveLeague();
    const activeLeague = fantasyData?.leagues?.[activeLeagueId];
    
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
            
            ${fantasyData?.leagues && Object.keys(fantasyData.leagues).length > 0 ? `
                <div class="filter-group">
                    <label for="league-select">League:</label>
                    <select id="league-select" class="filter-dropdown">
                        ${Object.entries(fantasyData.leagues).map(([leagueId, league]) => `
                            <option value="${leagueId}" ${leagueId === activeLeagueId ? 'selected' : ''}>
                                ${league.leagueName}
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
                    `<span class="record-count">${apiState.totalRecords} total records</span>`
                }
                ${apiState.error ? `<span class="error">${apiState.error}</span>` : ''}
            </div>
        </div>
    `;
}

// Load stats function
async function loadStats(resetPage = true) {
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
        // Convert raw stats to display format ONLY when rendering
       const playersWithReadableStats = data.data.map(player => ({
           ...player,
           stats: convertStatsForDisplay(player.stats) // Convert HERE during render
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
       
       // Load scoring rules if league is selected
       if (currentFilters.league) {
           currentScoringRules = await loadScoringRules(currentFilters.league);
       }
       
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
   // Year filter
   document.getElementById('year-select')?.addEventListener('change', async (e) => {
       currentFilters.year = e.target.value;
       currentFilters.week = 'total'; // Reset week when year changes
       await loadStats(true);
   });
   
   // Week filter  
   document.getElementById('week-select')?.addEventListener('change', async (e) => {
       currentFilters.week = e.target.value;
       saveWeekPreference(e.target.value);
       await loadStats(true);
   });
   
   // League filter
   document.getElementById('league-select')?.addEventListener('change', async (e) => {
       currentFilters.league = e.target.value;
       localStorage.setItem('activeLeagueId', e.target.value);
       
       // Load new scoring rules
       currentScoringRules = await loadScoringRules(e.target.value);
       
       updateFilterControlsUI(); // Update team dropdown
       render(); // Re-render with new scoring rules
   });
   
   // Team filter
   document.getElementById('team-select')?.addEventListener('change', (e) => {
       currentFilters.team = e.target.value;
       render();
   });
   
   // Stats toggle
   document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
       btn.addEventListener('click', (e) => {
           document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
           e.target.classList.add('active');
           showFantasyStats = e.target.dataset.mode === 'fantasy';
           render();
       });
   });
   
   // View toggle buttons
   document.querySelectorAll('.view-btn').forEach(btn => {
       btn.addEventListener('click', (e) => {
           document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
           e.target.classList.add('active');
           currentView = e.target.dataset.view;
           render();
       });
   });

   // Search
   document.getElementById('searchInput').addEventListener('input', (e) => {
       searchQuery = e.target.value.toLowerCase();
       render();
   });
   
   // Position filter buttons
   document.getElementById('positionFilter').addEventListener('click', async (e) => {
       if (e.target.classList.contains('position-btn')) {
           document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
           e.target.classList.add('active');
           currentFilters.position = e.target.dataset.position;
           await loadStats(true);
       }
   });
}

// Update filter controls UI
function updateFilterControlsUI() {
   const filterContainer = document.querySelector('.filter-controls-container');
   if (filterContainer) {
       filterContainer.innerHTML = createFilterControls();
       setupEventListeners();
   }
}

// Get filtered players
function getFilteredPlayers() {
   let filteredPlayers = currentPlayers;
   
   // Apply search filter
   if (searchQuery) {
       filteredPlayers = filteredPlayers.filter(player => {
           return player.name.toLowerCase().includes(searchQuery) ||
                  player.team.toLowerCase().includes(searchQuery);
       });
   }
   
   // Apply column filters for research view
   if (currentView === 'research' && Object.keys(columnFilters).length > 0) {
       filteredPlayers = filteredPlayers.filter(player => {
           return Object.entries(columnFilters).every(([column, filterValue]) => {
               if (!filterValue) return true;
               
               let cellValue;
               if (column === 'name') {
                   cellValue = player.name;
               } else if (column === 'position') {
                   cellValue = player.position;
               } else if (column === 'team') {
                   cellValue = player.team;
               } else {
                   cellValue = getStatValue(player, column);
               }
               
               return cellValue.toString().toLowerCase().includes(filterValue.toLowerCase());
           });
       });
   }
   
   return filteredPlayers;
}

// Fantasy points calculation
function calculateFantasyPoints(statName, statValue) {
   if (!currentScoringRules || statValue === 0) {
       return 0;
   }
   
   // Find the stat ID for the given stat name
   const statId = Object.keys(STAT_ID_MAPPING).find(id => 
       STAT_ID_MAPPING[id] === statName
   );
   
   if (!statId || !currentScoringRules[statId]) {
       return 0;
   }
   
   const rule = currentScoringRules[statId];
   let points = statValue * parseFloat(rule.points || 0);
   
   // Add bonus points if applicable
   if (rule.bonuses && Array.isArray(rule.bonuses)) {
       rule.bonuses.forEach(bonusRule => {
           if (statValue >= parseFloat(bonusRule.bonus.target)) {
               points += parseFloat(bonusRule.bonus.points);
           }
       });
   }
   
   return Math.round(points * 100) / 100;
}

// Get stat value for display
function getStatValue(player, statName) {
   if (showFantasyStats && currentScoringRules) {
       const rawValue = player.stats[statName] || 0;
       const fantasyPoints = calculateFantasyPoints(statName, rawValue);
       return fantasyPoints > 0 ? fantasyPoints : rawValue;
   }
   return player.stats[statName] || 0;
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
   columnFilters = {};
   tableSort = { column: null, direction: 'asc' };
   document.querySelectorAll('.column-filter').forEach(input => {
       input.value = '';
   });
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
       } else {
           aValue = getStatValue(a, tableSort.column);
           bValue = getStatValue(b, tableSort.column);
       }
       
       // Handle numeric vs string comparison
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

   // Apply sorting for research view
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
   
   return `
       <div class="player-card fade-in">
           <div class="player-header">
               <div class="player-info">
                   <h3>${player.name}</h3>
                   <div class="player-meta">
                       <span class="position-badge">${player.position}</span>
                       <span>${player.team}</span>
                   </div>
               </div>
           </div>
           <div class="stat-grid">
               ${stats.map(stat => {
                   const rawValue = player.stats[stat] || 0;
                   const displayValue = getStatValue(player, stat);
                   const isFantasyMode = showFantasyStats && displayValue !== rawValue;
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

function renderResearchView(players) {
   const content = document.getElementById('content');
   const stats = getStatsForPosition(currentFilters.position);
   
   content.innerHTML = `
       <div class="research-container fade-in">
           <div class="research-header">
               <h2>Research Table</h2>
               <div class="research-controls">
                   <button class="clear-filters-btn" onclick="clearAllFilters()">
                       Clear All Filters
                   </button>
               </div>
           </div>
           <div class="research-table-wrapper">
               <table class="research-table">
                   <thead>
                       <tr>
                           <th class="sortable" onclick="sortTable('name')">
                               Player
                               <span class="sort-icon ${tableSort.column === 'name' ? 'sort-' + tableSort.direction : ''}"></span>
                               <input type="text" class="column-filter" placeholder="Filter..." 
                                      onkeyup="filterColumn('name', this.value)">
                           </th>
                           <th class="sortable" onclick="sortTable('position')">
                               Pos
                               <span class="sort-icon ${tableSort.column === 'position' ? 'sort-' + tableSort.direction : ''}"></span>
                               <input type="text" class="column-filter" placeholder="Filter..." 
                                      onkeyup="filterColumn('position', this.value)">
                           </th>
                           <th class="sortable" onclick="sortTable('team')">
                               Team
                               <span class="sort-icon ${tableSort.column === 'team' ? 'sort-' + tableSort.direction : ''}"></span>
                               <input type="text" class="column-filter" placeholder="Filter..." 
                                      onkeyup="filterColumn('team', this.value)">
                           </th>
                           ${stats.map(stat => `
                               <th class="sortable" onclick="sortTable('${stat}')">
                                   ${stat}
                                   <span class="sort-icon ${tableSort.column === stat ? 'sort-' + tableSort.direction : ''}"></span>
                                   <input type="text" class="column-filter" placeholder="Filter..." 
                                          onkeyup="filterColumn('${stat}', this.value)">
                               </th>
                           `).join('')}
                       </tr>
                   </thead>
                   <tbody>
                       ${players.map(player => `
                           <tr>
                               <td class="player-name-cell">${player.name}</td>
                               <td>${player.position}</td>
                               <td>${player.team}</td>
                               ${stats.map(stat => {
                                   const rawValue = player.stats[stat] || 0;
                                   const displayValue = getStatValue(player, stat);
                                   const isFantasyMode = showFantasyStats && displayValue !== rawValue;
                                   const isBest = checkIfBestStat(player, stat);
                                   
                                   return `
                                       <td class="${isBest ? 'stat-best' : ''}">
                                           <span class="${isFantasyMode ? 'fantasy-stat-cell' : ''}">
                                               ${formatStatValue(displayValue, stat, isFantasyMode)}
                                           </span>
                                       </td>
                                   `;
                               }).join('')}
                           </tr>
                       `).join('')}
                   </tbody>
               </table>
           </div>
       </div>
   `;
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
                                       calculateFantasyPoints(stat, l.value) || l.value : 
                                       l.value;
                                   const suffix = showFantasyStats && displayValue !== l.value ? ' pts' : '';
                                   return `${l.name} (${formatStatValue(displayValue, stat, showFantasyStats)}${suffix})`;
                               }).join(', ')}</span>
                           </div>
                       `;
                   }).join('')}
               </div>
           `).join('')}
       </div>
   `;
}

// Column filter function
function filterColumn(column, value) {
   if (value.trim() === '') {
       delete columnFilters[column];
   } else {
       columnFilters[column] = value.trim();
   }
   render();
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

function categorizeStats(stats) {
   const categories = {
       "Passing": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack"],
       "Rushing": ["Rush Att", "Rush Yds", "Rush TD"],
       "Receiving": ["Rec", "Rec Yds", "Rec TD"],
       "Defense": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
       "Special Teams": ["Ret Yds", "Ret TD", "FG", "FGM", "Pts Allow"],
       "Turnovers": ["Fum", "Fum Lost", "Off Fum Ret TD"],
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
       .filter(p => p.stats[stat] !== undefined)
       .map(p => ({ 
           name: p.name, 
           value: p.stats[stat] || 0,
           fantasyValue: showFantasyStats ? calculateFantasyPoints(stat, p.stats[stat] || 0) : null
       }))
       .sort((a, b) => {
           const aValue = showFantasyStats && a.fantasyValue !== null ? a.fantasyValue : a.value;
           const bValue = showFantasyStats && b.fantasyValue !== null ? b.fantasyValue : b.value;
           
           if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
               return aValue - bValue;
           }
           return bValue - aValue;
       })
       .slice(0, limit);
}

function checkIfBestStat(player, stat) {
   const players = getFilteredPlayers().filter(p => p.position === player.position);
   const playerValue = getStatValue(player, stat);
   const values = players.map(p => getStatValue(p, stat));
   
   if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
       return playerValue === Math.min(...values) && playerValue > 0;
   }
   return playerValue === Math.max(...values) && playerValue > 0;
}

function formatStatValue(value, stat, isFantasyMode = false) {
   if (isFantasyMode && value > 0) {
       return `${value} pts`;
   }
   
   if (stat === 'Sack' || stat === 'Pass Def') {
       return value.toFixed(1);
   }
   if (stat === 'FG') {
       return `${value} Att`;
   }
   if (stat === 'FGM') {
       return `${value} Miss`;
   }
   return value.toString();
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
   // Initialize active league
   currentFilters.league = initializeActiveLeague();
   
   // Load saved week preference
   currentFilters.week = getSavedWeek();
   
   // Load scoring rules if league is available
   if (currentFilters.league) {
       currentScoringRules = await loadScoringRules(currentFilters.league);
   }
   
   // Add filter controls to header
   const header = document.querySelector('.header');
   const filterControlsHtml = createFilterControls();
   if (filterControlsHtml && header) {
       const filterContainer = document.createElement('div');
       filterContainer.className = 'filter-controls-container';
       filterContainer.innerHTML = filterControlsHtml;
       header.appendChild(filterContainer);
   }
   
   // Setup event listeners
   setupEventListeners();
   
   // Load initial stats data
   await loadStats(true);
});
