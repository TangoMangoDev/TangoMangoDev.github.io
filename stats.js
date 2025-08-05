// Get saved week preference 
function getSavedWeek() {
  const savedWeek = localStorage.getItem('selectedWeek');
  if (savedWeek && savedWeek !== 'current') {
    return parseInt(savedWeek);
  }
  return null; // null means current week
}

// Save week preference
function saveWeekPreference(week) {
  if (week) {
    localStorage.setItem('selectedWeek', week.toString());
  } else {
    localStorage.setItem('selectedWeek', 'current');
  }
}

// Update the loadFantasyRosters function
async function loadFantasyRosters(leagueId, week = null, forceRefresh = false) {
    try {
        // If no week specified, use saved preference
        if (week === null && !forceRefresh) {
            week = getSavedWeek();
        }
        
        const storageKey = `fantasyRosters_${leagueId}${week ? `_week${week}` : '_current'}`;
        
        // Check if we already have recent roster data
        if (!forceRefresh) {
            const existingData = localStorage.getItem(storageKey);
            if (existingData) {
                const parsed = JSON.parse(existingData);
                // 24 hours cache for rosters
                const dataAge = new Date() - new Date(parsed.lastUpdated);
                if (dataAge < 24 * 60 * 60 * 1000) {
                    console.log(`✅ Using cached roster data for league: ${leagueId}, week: ${week || 'current'}`);
                    return parsed;
                }
            }
        }
        
        console.log(`📋 Fetching fresh roster data for league: ${leagueId}, week: ${week || 'current'}...`);
        
        const requestBody = { leagueId };
        if (week) {
            requestBody.week = week;
        }
        
        const response = await fetch('/data/fantasy/rosters', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.needsAuth) {
                console.error('Yahoo authentication required');
                throw new Error('Authentication required');
            }
            throw new Error(`Failed to fetch rosters: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Structure data for storage
        const rostersData = {
            leagueId: data.leagueId,
            week: data.week,
            rostersJson: data.rostersJson,
            totalTeams: data.totalTeams,
            totalPlayers: data.totalPlayers,
            lastUpdated: new Date().toISOString(),
            // Process for easier frontend use
            teams: [],
            playersByTeam: {},
            allPlayers: [],
            teamNameToId: {}
        };
        
        // Get team names from stored league data
        const fantasyData = getFantasyDataFromLocalStorage();
        const leagueInfo = fantasyData?.leagues?.[leagueId];
        
        // Process the roster JSON
        Object.entries(data.rostersJson).forEach(([teamId, players]) => {
            // Find team name from league data
            const teamInfo = leagueInfo?.teams?.find(t => t.teamId === teamId);
            const teamName = teamInfo?.teamName || `Team ${teamId}`;
            
            rostersData.teams.push({
                teamId: teamId,
                teamName: teamName,
                rosterCount: players.length,
                players: players
            });
            
            rostersData.teamNameToId[teamName] = teamId;
            rostersData.playersByTeam[teamId] = players;
            
            // Add to all players list
            players.forEach(player => {
                rostersData.allPlayers.push({
                    ...player,
                    fantasyTeamId: teamId,
                    fantasyTeamName: teamName
                });
            });
        });
        
        localStorage.setItem(storageKey, JSON.stringify(rostersData));
        console.log(`✅ Stored rosters for week ${data.week}: ${data.totalTeams} teams, ${data.totalPlayers} players`);
        
        return rostersData;
        
    } catch (error) {
        console.error('Error loading fantasy rosters:', error);
        
        // Try to return cached data if available
        const storageKey = `fantasyRosters_${leagueId}${week ? `_week${week}` : '_current'}`;
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData) {
            console.log('⚠️ Using stale cached data due to error');
            return JSON.parse(cachedData);
        }
        
        return null;
    }
}

// Update the createFilterControls function to use saved week
function createFilterControls() {
    const fantasyData = getFantasyDataFromLocalStorage();
    if (!fantasyData || !fantasyData.leagues || Object.keys(fantasyData.leagues).length === 0) {
        return '';
    }
    
    const activeLeagueId = currentFilters.league || initializeActiveLeague();
    const activeLeague = fantasyData.leagues[activeLeagueId];
    const savedWeek = getSavedWeek();
    
    // Set current filter week if not set
    if (currentFilters.week === undefined) {
        currentFilters.week = savedWeek;
    }
    
    return `
        <div class="filter-controls">
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
            
            <div class="filter-group">
                <label for="week-select">Week:</label>
                <select id="week-select" class="filter-dropdown">
                    <option value="" ${!savedWeek ? 'selected' : ''}>Current</option>
                    ${Array.from({length: 18}, (_, i) => i + 1).map(week => `
                        <option value="${week}" ${week === savedWeek ? 'selected' : ''}>
                            Week ${week}
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;
}


// Get roster data from cache
function getCachedRosterData(leagueId, week = null) {
    const storageKey = `fantasyRosters_${leagueId}${week ? `_week${week}` : ''}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
}

// Initialize or update active league
function initializeActiveLeague() {
    const fantasyData = getFantasyDataFromLocalStorage();
    if (!fantasyData || !fantasyData.leagues || Object.keys(fantasyData.leagues).length === 0) {
        return null;
    }
    
    let activeLeagueId = localStorage.getItem('activeLeagueId');
    
    // If no active league or the active league doesn't exist in stored data
    if (!activeLeagueId || !fantasyData.leagues[activeLeagueId]) {
        // Use the first available league
        activeLeagueId = Object.keys(fantasyData.leagues)[0];
        localStorage.setItem('activeLeagueId', activeLeagueId);
    }
    
    return activeLeagueId;
}

// Global state for current filters
let currentFilters = {
    league: null,
    team: 'ALL',
    week: null,
    position: 'ALL'
};

// Update the setupEventListeners function
function setupEventListeners() {
    // League filter
    document.getElementById('league-select')?.addEventListener('change', async (e) => {
        currentFilters.league = e.target.value;
        localStorage.setItem('activeLeagueId', e.target.value);
        
        // Load rosters for new league
        await loadRostersForActiveLeague();
        
        // Update the filter controls and re-render
        updateFilterControls();
        render();
    });
    
    // Team filter
    document.getElementById('team-select')?.addEventListener('change', (e) => {
        currentFilters.team = e.target.value;
        render();
    });
    
    // Week filter
    document.getElementById('week-select')?.addEventListener('change', async (e) => {
        currentFilters.week = e.target.value || null;
        
        // Load rosters for selected week
        await loadRostersForActiveLeague();
        render();
    });
    
    // Position filter
    document.getElementById('positionFilter').addEventListener('click', (e) => {
        if (e.target.classList.contains('position-btn')) {
            document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentFilters.position = e.target.dataset.position;
            currentPosition = currentFilters.position; // Keep backward compatibility
            render();
        }
    });

    // View toggle
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
}

// Load rosters for the active league
async function loadRostersForActiveLeague() {
    const activeLeagueId = currentFilters.league || initializeActiveLeague();
    if (!activeLeagueId) return;
    
    try {
        const rosterData = await loadFantasyRosters(activeLeagueId, currentFilters.week);
        console.log(`Loaded rosters for league ${activeLeagueId}:`, rosterData);
        
        // You can update global state here if needed
        window.currentRosterData = rosterData;
    } catch (error) {
        console.error('Failed to load rosters:', error);
    }
}

// Update filter controls without full page reload
function updateFilterControls() {
    const filterContainer = document.querySelector('.filter-controls-container');
    if (filterContainer) {
        filterContainer.innerHTML = createFilterControls();
        
        // Re-attach event listeners for the new controls
        document.getElementById('team-select')?.addEventListener('change', (e) => {
            currentFilters.team = e.target.value;
            render();
        });
        
        document.getElementById('week-select')?.addEventListener('change', async (e) => {
            currentFilters.week = e.target.value || null;
            await loadRostersForActiveLeague();
            render();
        });
    }
}

// Replace the existing DOMContentLoaded event listener with this updated version
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize active league
    currentFilters.league = initializeActiveLeague();
    
    // Load saved week preference
    currentFilters.week = getSavedWeek();
    
    // Load NFL player data first
    await loadNFLPlayersData();
    
    // Load rosters for active league and saved week
    if (currentFilters.league) {
        await loadRostersForActiveLeague();
    }
    // Then convert to display format
    samplePlayers = convertStoredPlayersToDisplayFormat();
    
    // Add filter controls to header
    const header = document.querySelector('.header');
    const filterControlsHtml = createFilterControls();
    if (filterControlsHtml && header) {
        const filterContainer = document.createElement('div');
        filterContainer.className = 'filter-controls-container';
        filterContainer.innerHTML = filterControlsHtml;
        header.appendChild(filterContainer);
    }
    
    setupEventListeners();
    render();
});

// Update styles for the new filter controls
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .filter-controls {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        padding: 12px;
        background: rgba(255,255,255,0.1);
        border-radius: 8px;
        flex-wrap: wrap;
    }
    
    .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .filter-group label {
        font-weight: 500;
        color: rgba(255,255,255,0.9);
        font-size: 14px;
    }
    
    .filter-dropdown {
        padding: 8px 12px;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        min-width: 120px;
    }
    
    .filter-dropdown option {
        background: #2a5298;
        color: white;
    }
    
    .filter-controls-container {
        width: 100%;
    }
    
    @media (max-width: 768px) {
        .filter-controls {
            gap: 12px;
        }
        
        .filter-group {
            flex: 1;
            min-width: calc(50% - 6px);
        }
        
        .filter-dropdown {
            width: 100%;
            min-width: 0;
        }
    }
`;
document.head.appendChild(additionalStyles);

// Optional: Add a function to display roster info alongside sample data
function getRosterInfoForPlayer(playerId) {
    if (!window.currentRosterData) return null;
    
    const player = window.currentRosterData.allPlayers.find(p => 
        p.playerId === playerId || p.playerKey.includes(`.p.${playerId}`)
    );
    
    return player ? {
        fantasyTeam: player.fantasyTeamName,
        position: player.selectedPosition
    } : null;
}

// Update getFilteredPlayers to respect team filter when roster data is available
const originalGetFilteredPlayers = getFilteredPlayers;
function getFilteredPlayers() {
    let players = originalGetFilteredPlayers.call(this);
    
    // Apply team filter if roster data is available and team is selected
    if (currentFilters.team !== 'ALL' && window.currentRosterData) {
        const teamPlayers = window.currentRosterData.playersByTeam[currentFilters.team];
        if (teamPlayers) {
            const teamPlayerIds = teamPlayers.map(p => p.playerId);
            players = players.filter(player => 
                teamPlayerIds.includes(player.id?.toString())
            );
        }
    }
    
    return players;
}

// Stat ID to stat name mapping based on the stats table
const statIdMapping = {
    1: "Pass Att",
    2: "Comp",
    3: "Inc",
    4: "Pass Yds",
    5: "Pass TD",
    6: "Int",
    7: "Sack",
    8: "Rush Att",
    9: "Rush Yds",
    10: "Rush TD",
    11: "Rec",
    12: "Rec Yds",
    13: "Rec TD",
    14: "Ret Yds",
    15: "Ret TD",
    16: "Off Fum Ret TD",
    17: "2-PT",
    18: "Fum",
    19: "Fum Lost",
    20: "FG",
    21: "FGM",
    22: "Pts Allow",
    23: "Tack Solo",
    24: "Tack Ast",
    25: "Pass Def",
    26: "Sack",
    27: "Int",
    28: "Fum Rec",
    29: "Fum Force",
    30: "TD",
    31: "Safe",
    32: "Blk Kick",
    33: "Ret Yds",
    34: "Ret TD"
};
// Fetch and store NFL players on page load
async function loadNFLPlayersData() {
    try {
        // Check if we already have recent player data
        const existingData = localStorage.getItem('nflPlayersByPosition');
        if (existingData) {
            const parsed = JSON.parse(existingData);
            // If data is less than 24 hours old, use it
            const dataAge = new Date() - new Date(parsed.lastUpdated);
            if (dataAge < 24 * 60 * 60 * 1000) {
                console.log('✅ Using cached NFL player data');
                return;
            }
        }
        
        console.log('🏈 Fetching fresh NFL player data...');
        
        const response = await fetch('/data/fantasy/players', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch players: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Store in localStorage
        localStorage.setItem('nflPlayersByPosition', JSON.stringify({
            playersByPosition: data.playersByPosition,
            totalPlayers: data.totalPlayers,
            positionCounts: data.positionCounts,
            lastUpdated: data.lastUpdated
        }));
        
        console.log(`✅ Stored ${data.totalPlayers} NFL players grouped by position`);
        console.log('Position counts:', data.positionCounts);
        
    } catch (error) {
        console.error('Error loading NFL players:', error);
        // Continue with sample data if fetch fails
    }
}

// Get players by position from localStorage
function getPlayersByPosition(position = null) {
    try {
        const storedData = localStorage.getItem('nflPlayersByPosition');
        if (!storedData) return null;
        
        const data = JSON.parse(storedData);
        
        if (position && position !== 'ALL') {
            return data.playersByPosition[position] || [];
        }
        
        return data.playersByPosition;
    } catch (error) {
        console.error('Error retrieving players from localStorage:', error);
        return null;
    }
}

// Convert stored players to display format with sample stats
function convertStoredPlayersToDisplayFormat() {
    const playersByPosition = getPlayersByPosition();
    
    if (!playersByPosition) {
        console.log('No stored player data, using default sample data');
        return getDefaultSamplePlayers();
    }
    
    // For now, take top players by rank and add sample stats
    const displayPlayers = [];
    const maxPerPosition = {
        QB: 3,
        RB: 4,
        WR: 4,
        TE: 2,
        K: 2,
        DST: 2,
        LB: 2,
        CB: 2,
        S: 1,
        DE: 1,
        DT: 1
    };
    
    Object.entries(maxPerPosition).forEach(([position, max]) => {
        const positionPlayers = playersByPosition[position] || [];
        const topPlayers = positionPlayers
            .sort((a, b) => a.overallRank - b.overallRank)
            .slice(0, max);
        
        topPlayers.forEach(player => {
            displayPlayers.push({
                id: player.id, // Preserve player ID
                playerKey: player.playerKey,
                name: player.name,
                team: player.team,
                position: player.position,
                overallRank: player.overallRank,
                stats: generateSampleStatsForPosition(player.position)
            });
        });
    });
    
    console.log(`✅ Prepared ${displayPlayers.length} players for display`);
    return displayPlayers;
}

// Quick lookup function to get player by ID and position
function getPlayerById(playerId, position = null) {
    const playersByPosition = getPlayersByPosition();
    if (!playersByPosition) return null;
    
    if (position) {
        // Search in specific position
        const players = playersByPosition[position] || [];
        return players.find(p => p.id === playerId);
    }
    
    // Search all positions
    for (const [pos, players] of Object.entries(playersByPosition)) {
        const found = players.find(p => p.id === playerId);
        if (found) return found;
    }
    
    return null;
}

// Keep the existing generateSampleStatsForPosition function
function generateSampleStatsForPosition(position) {
    const statTemplates = {
        QB: {
            "Pass Att": Math.floor(Math.random() * 200) + 400,
            "Comp": Math.floor(Math.random() * 150) + 250,
            "Inc": 0, // Will be calculated
            "Pass Yds": Math.floor(Math.random() * 2000) + 3000,
            "Pass TD": Math.floor(Math.random() * 20) + 20,
            "Int": Math.floor(Math.random() * 10) + 5,
            "Sack": Math.floor(Math.random() * 30) + 10,
            "Rush Att": Math.floor(Math.random() * 50) + 20,
            "Rush Yds": Math.floor(Math.random() * 300) + 100,
            "Rush TD": Math.floor(Math.random() * 5),
            "Off Fum Ret TD": 0,
            "2-PT": Math.floor(Math.random() * 3),
            "Fum": Math.floor(Math.random() * 5),
            "Fum Lost": Math.floor(Math.random() * 3)
        },
        RB: {
            "Rush Att": Math.floor(Math.random() * 100) + 150,
            "Rush Yds": Math.floor(Math.random() * 500) + 800,
            "Rush TD": Math.floor(Math.random() * 8) + 5,
            "Rec": Math.floor(Math.random() * 40) + 20,
            "Rec Yds": Math.floor(Math.random() * 300) + 200,
            "Rec TD": Math.floor(Math.random() * 4),
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": Math.floor(Math.random() * 2),
            "Fum": Math.floor(Math.random() * 3),
            "Fum Lost": Math.floor(Math.random() * 2)
        },
        WR: {
            "Rush Att": Math.floor(Math.random() * 5),
            "Rush Yds": Math.floor(Math.random() * 30),
            "Rush TD": 0,
            "Rec": Math.floor(Math.random() * 50) + 50,
            "Rec Yds": Math.floor(Math.random() * 600) + 800,
            "Rec TD": Math.floor(Math.random() * 8) + 4,
            "Ret Yds": Math.floor(Math.random() * 100),
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": Math.floor(Math.random() * 1),
            "Fum": Math.floor(Math.random() * 2),
            "Fum Lost": Math.floor(Math.random() * 1)
        },
        TE: {
            "Rush Att": 0,
            "Rush Yds": 0,
            "Rush TD": 0,
            "Rec": Math.floor(Math.random() * 40) + 40,
            "Rec Yds": Math.floor(Math.random() * 400) + 500,
            "Rec TD": Math.floor(Math.random() * 6) + 2,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": Math.floor(Math.random() * 1),
            "Fum": Math.floor(Math.random() * 2),
            "Fum Lost": Math.floor(Math.random() * 1)
        },
        K: {
            "FG": Math.floor(Math.random() * 15) + 25,
            "FGM": Math.floor(Math.random() * 5)
        },
        DST: {
            "Pts Allow": Math.floor(Math.random() * 100) + 200
        },
        LB: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": Math.floor(Math.random() * 60) + 50,
            "Tack Ast": Math.floor(Math.random() * 30) + 20,
            "Pass Def": Math.floor(Math.random() * 8) + 2,
            "Sack": Math.floor(Math.random() * 10) + 2,
            "Int": Math.floor(Math.random() * 3),
            "Fum Rec": Math.floor(Math.random() * 2),
            "Fum Force": Math.floor(Math.random() * 3),
            "TD": Math.floor(Math.random() * 1),
            "Safe": 0,
            "Blk Kick": 0
        },
        CB: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": Math.floor(Math.random() * 40) + 30,
            "Tack Ast": Math.floor(Math.random() * 20) + 10,
            "Pass Def": Math.floor(Math.random() * 15) + 5,
            "Sack": 0,
            "Int": Math.floor(Math.random() * 5) + 1,
            "Fum Rec": Math.floor(Math.random() * 1),
            "Fum Force": Math.floor(Math.random() * 2),
            "TD": Math.floor(Math.random() * 1),
            "Safe": 0,
            "Blk Kick": 0
        },
        S: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": Math.floor(Math.random() * 50) + 40,
            "Tack Ast": Math.floor(Math.random() * 25) + 15,
            "Pass Def": Math.floor(Math.random() * 10) + 3,
            "Sack": Math.floor(Math.random() * 3),
            "Int": Math.floor(Math.random() * 4) + 1,
            "Fum Rec": Math.floor(Math.random() * 1),
            "Fum Force": Math.floor(Math.random() * 2),
            "TD": Math.floor(Math.random() * 1),
            "Safe": 0,
            "Blk Kick": 0
        },
        DE: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": Math.floor(Math.random() * 30) + 20,
            "Tack Ast": Math.floor(Math.random() * 20) + 10,
            "Pass Def": Math.floor(Math.random() * 6) + 2,
            "Sack": Math.floor(Math.random() * 10) + 5,
            "Int": 0,
            "Fum Rec": Math.floor(Math.random() * 2),
            "Fum Force": Math.floor(Math.random() * 5) + 2,
            "TD": Math.floor(Math.random() * 1),
            "Safe": Math.floor(Math.random() * 1),
            "Blk Kick": 0
        },
        DT: {
            "Tack Solo": Math.floor(Math.random() * 25) + 15,
            "Tack Ast": Math.floor(Math.random() * 20) + 10,
            "Pass Def": Math.floor(Math.random() * 4),
            "Sack": Math.floor(Math.random() * 6) + 1,
            "Int": 0,
            "Fum Rec": Math.floor(Math.random() * 1),
            "Fum Force": Math.floor(Math.random() * 2),
            "TD": 0,
            "Safe": 0,
            "Blk Kick": 0,
            "Ret Yds": 0,
            "Ret TD": 0
        }
    };
    
    const template = statTemplates[position];
    if (template && template.Comp && template["Pass Att"]) {
        template.Inc = template["Pass Att"] - template.Comp;
    }
    
    return template || {};
}

// Update the initialization
/////let samplePlayers = [];

// Modified DOMContentLoaded to load player data first
document.addEventListener('DOMContentLoaded', async () => {
    // Load NFL player data first
    await loadNFLPlayersData();
    
    // Then convert to display format
    samplePlayers = convertStoredPlayersToDisplayFormat();
    
    // Add league selector to header if data exists
    const header = document.querySelector('.header');
    const leagueSelectorHtml = createLeagueSelector();
    if (leagueSelectorHtml && header) {
        const selectorDiv = document.createElement('div');
        selectorDiv.innerHTML = leagueSelectorHtml;
        header.insertBefore(selectorDiv.firstChild, header.querySelector('.position-filter'));
        
        document.getElementById('league-select')?.addEventListener('change', (e) => {
            localStorage.setItem('activeLeagueId', e.target.value);
            samplePlayers = convertStoredPlayersToDisplayFormat();
            render();
        });
    }
    
    setupEventListeners();
    render();
});

// Update getFilteredPlayers to work with position-grouped data
function getFilteredPlayers() {
    if (currentPosition !== 'ALL' && searchQuery === '') {
        // Fast path: get directly from position group
        const playersByPosition = getPlayersByPosition();
        if (playersByPosition && playersByPosition[currentPosition]) {
            // Convert to display format with stats
            return playersByPosition[currentPosition]
                .slice(0, 20) // Limit for performance
                .map(player => ({
                    id: player.id,
                    playerKey: player.playerKey,
                    name: player.name,
                    team: player.team,
                    position: player.position,
                    overallRank: player.overallRank,
                    stats: generateSampleStatsForPosition(player.position)
                }));
        }
    }
    
    // Use the sample players for filtering
    return samplePlayers.filter(player => {
        const matchesPosition = currentPosition === 'ALL' || player.position === currentPosition;
        const matchesSearch = searchQuery === '' || 
            player.name.toLowerCase().includes(searchQuery) ||
            player.team.toLowerCase().includes(searchQuery);
        return matchesPosition && matchesSearch;
    });
}

// Data Management Functions
function getFantasyDataFromLocalStorage() {
    try {
        const storedData = localStorage.getItem('fantasyLeagueData');
        if (!storedData) {
            console.log('No fantasy data found in localStorage');
            return null;
        }
        
        const data = JSON.parse(storedData);
        console.log('✅ Retrieved fantasy data from localStorage:', data);
        return data;
    } catch (error) {
        console.error('Error retrieving fantasy data from localStorage:', error);
        return null;
    }
}

function getActiveLeagueData() {
    const fantasyData = getFantasyDataFromLocalStorage();
    if (!fantasyData || !fantasyData.leagues) {
        return null;
    }
    
    // Get the active league ID from localStorage or use the first available
    let activeLeagueId = localStorage.getItem('activeLeagueId');
    
    if (!activeLeagueId || !fantasyData.leagues[activeLeagueId]) {
        // Use the first league if no active league is set
        const leagueIds = Object.keys(fantasyData.leagues);
        if (leagueIds.length === 0) {
            return null;
        }
        activeLeagueId = leagueIds[0];
        localStorage.setItem('activeLeagueId', activeLeagueId);
    }
    
    return fantasyData.leagues[activeLeagueId];
}

function convertStoredDataToSampleFormat() {
    const leagueData = getActiveLeagueData();
    if (!leagueData) {
        console.log('No active league data found, using default sample data');
        return getDefaultSamplePlayers();
    }
    
    // For now, we'll return the sample data but with the actual scoring rules from the imported league
    // In a real implementation, you would fetch actual player data from Yahoo or your backend
    const samplePlayers = getDefaultSamplePlayers();
    
    // Store the actual scoring rules globally
    window.activeLeagueScoringRules = {};
    if (leagueData.scoringSettings && Array.isArray(leagueData.scoringSettings)) {
        leagueData.scoringSettings.forEach(setting => {
            window.activeLeagueScoringRules[setting.name] = {
                points: setting.points,
                bonuses: setting.bonuses
            };
        });
    }
    
    console.log('✅ Using scoring rules from league:', leagueData.leagueName);
    console.log('Scoring rules:', window.activeLeagueScoringRules);
    
    return samplePlayers;
}

function getDefaultSamplePlayers() {
    // Return the original sample data
    return [
        {
            id: 1,
            name: "Patrick Mahomes",
            team: "KC",
            position: "QB",
            stats: {
                "Pass Att": 648,
                "Comp": 435,
                "Inc": 213,
                "Pass Yds": 5250,
                "Pass TD": 41,
                "Int": 12,
                "Sack": 26,
                "Rush Att": 61,
                "Rush Yds": 389,
                "Rush TD": 2,
                "Off Fum Ret TD": 0,
                "2-PT": 1,
                "Fum": 5,
                "Fum Lost": 3
            }
        },
        {
            id: 2,
            name: "Josh Allen",
            team: "BUF",
            position: "QB",
            stats: {
                "Pass Att": 599,
                "Comp": 385,
                "Inc": 214,
                "Pass Yds": 4407,
                "Pass TD": 35,
                "Int": 14,
                "Sack": 33,
                "Rush Att": 124,
                "Rush Yds": 762,
                "Rush TD": 7,
                "Off Fum Ret TD": 0,
                "2-PT": 2,
                "Fum": 8,
                "Fum Lost": 4
            }
        },
        {
            id: 3,
            name: "Christian McCaffrey",
            team: "SF",
            position: "RB",
            stats: {
                "Rush Att": 272,
                "Rush Yds": 1459,
                "Rush TD": 14,
                "Rec": 67,
                "Rec Yds": 564,
                "Rec TD": 5,
                "Ret Yds": 0,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 1,
                "Fum": 2,
                "Fum Lost": 1
            }
        },
        {
            id: 4,
            name: "Austin Ekeler",
            team: "LAC",
            position: "RB",
            stats: {
                "Rush Att": 204,
                "Rush Yds": 915,
                "Rush TD": 13,
                "Rec": 107,
                "Rec Yds": 722,
                "Rec TD": 5,
                "Ret Yds": 0,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 0,
                "Fum": 3,
                "Fum Lost": 2
            }
        },
        {
            id: 5,
            name: "Tyreek Hill",
            team: "MIA",
            position: "WR",
            stats: {
                "Rush Att": 6,
                "Rush Yds": 47,
                "Rush TD": 0,
                "Rec": 119,
                "Rec Yds": 1710,
                "Rec TD": 7,
                "Ret Yds": 26,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 0,
                "Fum": 1,
                "Fum Lost": 0
            }
        },
        {
            id: 6,
            name: "CeeDee Lamb",
            team: "DAL",
            position: "WR",
            stats: {
                "Rush Att": 2,
                "Rush Yds": 16,
                "Rush TD": 0,
                "Rec": 107,
                "Rec Yds": 1359,
                "Rec TD": 9,
                "Ret Yds": 0,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 1,
                "Fum": 2,
                "Fum Lost": 1
            }
        },
        {
            id: 7,
            name: "Travis Kelce",
            team: "KC",
            position: "TE",
            stats: {
                "Rush Att": 0,
                "Rush Yds": 0,
                "Rush TD": 0,
                "Rec": 110,
                "Rec Yds": 1338,
                "Rec TD": 12,
                "Ret Yds": 0,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 0,
                "Fum": 1,
                "Fum Lost": 0
            }
        },
        {
            id: 8,
            name: "T.J. Hockenson",
            team: "MIN",
            position: "TE",
            stats: {
                "Rush Att": 0,
                "Rush Yds": 0,
                "Rush TD": 0,
                "Rec": 86,
                "Rec Yds": 914,
                "Rec TD": 6,
                "Ret Yds": 0,
                "Ret TD": 0,
                "Off Fum Ret TD": 0,
                "2-PT": 0,
                "Fum": 0,
                "Fum Lost": 0
            }
        },
        {
            id: 9,
            name: "Justin Tucker",
            team: "BAL",
            position: "K",
            stats: {
                "FG": 37,
                "FGM": 2
            }
        },
        {
            id: 10,
            name: "Harrison Butker",
            team: "KC",
            position: "K",
            stats: {
                "FG": 38,
                "FGM": 3
            }
        },
        {
            id: 11,
            name: "49ers Defense",
            team: "SF",
            position: "DST",
            stats: {
                "Pts Allow": 278
            }
        },
        {
            id: 12,
            name: "Ravens Defense",
            team: "BAL",
            position: "DST",
            stats: {
                "Pts Allow": 255
            }
        },
        {
            id: 13,
            name: "T.J. Watt",
            team: "PIT",
            position: "DE",
            stats: {
                "Ret Yds": 0,
                "Ret TD": 0,
                "Tack Solo": 48,
                "Tack Ast": 19,
                "Pass Def": 8,
                "Sack": 19,
                "Int": 0,
                "Fum Rec": 2,
                "Fum Force": 8,
                "TD": 0,
                "Safe": 1,
                "Blk Kick": 0
            }
        },
        {
            id: 14,
            name: "Roquan Smith",
            team: "BAL",
            position: "LB",
            stats: {
                "Ret Yds": 14,
                "Ret TD": 0,
                "Tack Solo": 112,
                "Tack Ast": 46,
                "Pass Def": 4,
                "Sack": 4.5,
                "Int": 1,
                "Fum Rec": 0,
                "Fum Force": 1,
                "TD": 0,
                "Safe": 0,
                "Blk Kick": 0
            }
        },
        {
            id: 15,
            name: "Sauce Gardner",
            team: "NYJ",
            position: "CB",
            stats: {
                "Ret Yds": 0,
                "Ret TD": 0,
                "Tack Solo": 60,
                "Tack Ast": 8,
                "Pass Def": 16,
                "Sack": 0,
                "Int": 2,
                "Fum Rec": 0,
                "Fum Force": 1,
                "TD": 0,
                "Safe": 0,
                "Blk Kick": 0
            }
        }
    ];
}

// Initialize the players data from localStorage or use sample data
let samplePlayers = convertStoredDataToSampleFormat();

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

// State
let currentPosition = 'ALL';
let currentView = 'cards';
let searchQuery = '';

// Fantasy Points Calculation Function - Updated to use dynamic scoring rules
function calculateFantasyPoints(statName, statValue) {
    // Use the active league's scoring rules if available
    const scoringRules = window.activeLeagueScoringRules || {};
    
    // Find the stat ID for the given stat name
    const statId = Object.keys(statIdMapping).find(id => statIdMapping[id] === statName);
    
    if (!statId || !scoringRules[statId] || statValue === 0) {
        return 0;
    }
    
    const rule = scoringRules[statId];
    let points = statValue * rule.points;
    
    // Add bonus points if applicable
    if (rule.bonuses && Array.isArray(rule.bonuses)) {
        rule.bonuses.forEach(bonusRule => {
            if (statValue >= bonusRule.bonus.target) {
                points += parseFloat(bonusRule.bonus.points);
            }
        });
    }
    
    return Math.round(points * 100) / 100; // Round to 2 decimal places
}

// Add league selector functionality
function createLeagueSelector() {
    const fantasyData = getFantasyDataFromLocalStorage();
    if (!fantasyData || !fantasyData.leagues || Object.keys(fantasyData.leagues).length === 0) {
        return '';
    }
    
    const activeLeagueId = localStorage.getItem('activeLeagueId') || Object.keys(fantasyData.leagues)[0];
    
    return `
        <div class="league-selector">
            <label for="league-select">Active League: </label>
            <select id="league-select" class="league-dropdown">
                ${Object.entries(fantasyData.leagues).map(([leagueId, league]) => `
                    <option value="${leagueId}" ${leagueId === activeLeagueId ? 'selected' : ''}>
                        ${league.leagueName}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add league selector to header if data exists
    const header = document.querySelector('.header');
    const leagueSelectorHtml = createLeagueSelector();
    if (leagueSelectorHtml && header) {
        const selectorDiv = document.createElement('div');
        selectorDiv.innerHTML = leagueSelectorHtml;
        header.insertBefore(selectorDiv.firstChild, header.querySelector('.position-filter'));
        
        // Add event listener for league change
        document.getElementById('league-select')?.addEventListener('change', (e) => {
            localStorage.setItem('activeLeagueId', e.target.value);
            // Reload the data with new league
            samplePlayers = convertStoredDataToSampleFormat();
            render();
        });
    }
    
    setupEventListeners();
    render();
});

function setupEventListeners() {
    // Position filter
    document.getElementById('positionFilter').addEventListener('click', (e) => {
        if (e.target.classList.contains('position-btn')) {
            document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentPosition = e.target.dataset.position;
            render();
        }
    });

    // View toggle
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
}

function getFilteredPlayers() {
    return samplePlayers.filter(player => {
        const matchesPosition = currentPosition === 'ALL' || player.position === currentPosition;
        const matchesSearch = searchQuery === '' || 
            player.name.toLowerCase().includes(searchQuery) ||
            player.team.toLowerCase().includes(searchQuery);
        return matchesPosition && matchesSearch;
    });
}

function render() {
    const content = document.getElementById('content');
    const filteredPlayers = getFilteredPlayers();

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

    switch (currentView) {
        case 'cards':
            renderCardsView(filteredPlayers);
            break;
        case 'comparison':
            renderComparisonView(filteredPlayers);
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
                    const value = player.stats[stat] || 0;
                    const fantasyPoints = calculateFantasyPoints(stat, value);
                    const isBest = checkIfBestStat(player, stat);
                    return `
                        <div class="stat-item ${isBest ? 'stat-best' : ''}">
                            <span class="stat-value">${formatStatValue(value, stat)}</span>
                            <span class="stat-label">${stat}</span>
                            ${fantasyPoints > 0 ? `<div class="fantasy-points">${fantasyPoints} pts</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderComparisonView(players) {
    const content = document.getElementById('content');
    const stats = getStatsForPosition(currentPosition);
    
    content.innerHTML = `
        <div class="comparison-container fade-in">
            <div class="comparison-header">
                <h2>Player Comparison</h2>
            </div>
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            ${stats.map(stat => `<th>${stat}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => `
                            <tr>
                                <td class="player-name-cell">${player.name}</td>
                                ${stats.map(stat => {
                                    const value = player.stats[stat] || 0;
                                    const fantasyPoints = calculateFantasyPoints(stat, value);
                                    const isBest = checkIfBestStat(player, stat);
                                    return `
                                        <td ${isBest ? 'style="color: #2e7d32; font-weight: 600;"' : ''}>
                                            ${formatStatValue(value, stat)}
                                            ${fantasyPoints > 0 ? `<br><span style="font-size: 12px; color: #2a5298;">${fantasyPoints} pts</span>` : ''}
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
    const stats = getStatsForPosition(currentPosition);
    const statCategories = categorizeStats(stats);
    
    content.innerHTML = `
        <div class="stats-overview fade-in">
            <h2>Leaders</h2>
            ${Object.entries(statCategories).map(([category, categoryStats]) => `
                <div class="stat-category">
                    <div class="stat-category-title">${category}</div>
                    ${categoryStats.map(stat => {
                        const leaders = getStatLeaders(players, stat, 3);
                        return `
                            <div class="stat-row">
                                <span>${stat}</span>
                                <span>${leaders.map(l => {
                                    const fantasyPoints = calculateFantasyPoints(stat, l.value);
                                    return `${l.name} (${formatStatValue(l.value, stat)}${fantasyPoints > 0 ? `, ${fantasyPoints} pts` : ''})`;
                                }).join(', ')}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function getStatsForPosition(position) {
    if (position === 'ALL') {
        // When ALL is selected, show ALL possible stats from all positions
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
        .map(p => ({ name: p.name, value: p.stats[stat] || 0 }))
        .sort((a, b) => {
            // For stats where lower is better
            if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
                return a.value - b.value;
            }
            return b.value - a.value;
        })
        .slice(0, limit);
}

function checkIfBestStat(player, stat) {
    const players = getFilteredPlayers().filter(p => p.position === player.position);
    const values = players.map(p => p.stats[stat] || 0);
    const playerValue = player.stats[stat] || 0;
    
    if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
        return playerValue === Math.min(...values) && playerValue > 0;
    }
    return playerValue === Math.max(...values) && playerValue > 0;
}

function formatStatValue(value, stat) {
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

// Add touch interactions for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    if (Math.abs(swipeDistance) < 50) return;

    const viewBtns = Array.from(document.querySelectorAll('.view-btn'));
    const currentIndex = viewBtns.findIndex(btn => btn.classList.contains('active'));

    if (swipeDistance > 0 && currentIndex > 0) {
        // Swipe right - go to previous view
        viewBtns[currentIndex - 1].click();
    } else if (swipeDistance < 0 && currentIndex < viewBtns.length - 1) {
        // Swipe left - go to next view
        viewBtns[currentIndex + 1].click();
    }
}

// Add styles for the league selector
const style = document.createElement('style');
style.textContent = `
    .league-selector {
        margin-bottom: 12px;
        padding: 12px;
        background: rgba(255,255,255,0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .league-selector label {
        font-weight: 500;
        color: rgba(255,255,255,0.9);
    }
    
    .league-dropdown {
        flex: 1;
        padding: 8px 12px;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        color: white;
        font-size: 14px;
        cursor: pointer;
    }
    
    .league-dropdown option {
        background: #2a5298;
        color: white;
    }
    
    .fantasy-points {
        font-size: 11px;
        color: #2a5298;
        margin-top: 2px;
        font-weight: 600;
    }
    
    .comparison-table-wrapper {
        overflow-x: auto;
    }
`;
document.head.appendChild(style);
