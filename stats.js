// stats.js - COPIED FROM WORKING PLAYER PAGE APPROACH
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
let userLeagues = {};

// 🔥 COPIED FROM PLAYER.JS - SIMPLE WORKING SORT 🔥
let tableSort = {
    column: null,
    direction: 'desc'
};

let eventListenersSetup = false;

// Enhanced mobile scroll handler (keep existing)
let lastScrollY = 0;
let scrollTimeout;
let isScrollingDown = false;

function handleMobileScroll() {
    if (window.innerWidth > 768) return;
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY;
        const header = document.querySelector('.header');
        const filterContainer = document.querySelector('.filter-controls-container');
        
        if (currentScrollY > lastScrollY && currentScrollY > 50) {
            if (!isScrollingDown) {
                isScrollingDown = true;
                header.classList.add('scroll-hidden');
                if (filterContainer) {
                    filterContainer.classList.add('scroll-hidden');
                }
                document.body.classList.add('header-hidden');
            }
        } else if (currentScrollY < lastScrollY - 10) {
            if (isScrollingDown) {
                isScrollingDown = false;
                header.classList.remove('scroll-hidden');
                if (filterContainer) {
                    filterContainer.classList.remove('scroll-hidden');
                }
                document.body.classList.remove('header-hidden');
            }
        }
        
        lastScrollY = currentScrollY;
    }, 10);
}

if (typeof window !== 'undefined') {
    window.addEventListener('scroll', handleMobileScroll, { passive: true });
}

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

// 🔥 COPIED EXACT SORT FUNCTION FROM PLAYER.JS 🔥
function sortTable(column) {
    console.log(`🔄 Sorting table by: ${column}`);
    
    const table = document.querySelector('.research-table');
    if (!table) {
        console.error('❌ Research table not found');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    let direction = 'desc';
    if (tableSort.column === column) {
        direction = tableSort.direction === 'desc' ? 'asc' : 'desc';
    }
    
    tableSort = { column, direction };
    
    const sortedRows = rows.sort((a, b) => {
        let aValue, bValue;
        
        switch(column) {
            case 'overallRank':
                aValue = parseFloat(a.cells[0].textContent.replace(/[^\d.-]/g, '')) || 999999;
                bValue = parseFloat(b.cells[0].textContent.replace(/[^\d.-]/g, '')) || 999999;
                break;
            case 'positionRank':
                aValue = parseFloat(a.cells[1].textContent.replace(/[^\d.-]/g, '')) || 999999;
                bValue = parseFloat(b.cells[1].textContent.replace(/[^\d.-]/g, '')) || 999999;
                break;
            case 'name':
                aValue = a.cells[2].textContent.trim();
                bValue = b.cells[2].textContent.trim();
                break;
            case 'fantasyPoints':
                // Fantasy points column is at index 3 when showing fantasy stats
                const fantasyIndex = showFantasyStats ? 3 : -1;
                if (fantasyIndex > -1) {
                    aValue = parseFloat(a.cells[fantasyIndex].textContent.replace(/[^\d.-]/g, '')) || 0;
                    bValue = parseFloat(b.cells[fantasyIndex].textContent.replace(/[^\d.-]/g, '')) || 0;
                } else {
                    return 0;
                }
                break;
            default:
                // For stat columns, find the right cell index
                const headers = Array.from(table.querySelectorAll('th'));
                const columnIndex = headers.findIndex(th => th.textContent.includes(getShortStatName(column)) || th.onclick?.toString().includes(column));
                
                if (columnIndex > -1 && a.cells[columnIndex] && b.cells[columnIndex]) {
                    aValue = parseFloat(a.cells[columnIndex].textContent.replace(/[^\d.-]/g, '')) || 0;
                    bValue = parseFloat(b.cells[columnIndex].textContent.replace(/[^\d.-]/g, '')) || 0;
                } else {
                    return 0;
                }
                break;
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return direction === 'asc' ? aValue - bValue : bValue - aValue;
        } else {
            aValue = aValue.toString().toLowerCase();
            bValue = bValue.toString().toLowerCase();
            if (direction === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        }
    });
    
    sortedRows.forEach(row => tbody.appendChild(row));
    updateTableSortIndicators(table, column, direction);
    
    console.log(`✅ Sorted table by ${column} (${direction})`);
}

// 🔥 COPIED FROM PLAYER.JS 🔥
function updateTableSortIndicators(table, activeColumn, direction) {
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const existingIndicator = th.querySelector('.sort-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    });
    
    // Find the header that matches the active column
    const headers = Array.from(table.querySelectorAll('th'));
    let activeHeader = null;
    
    headers.forEach((th, index) => {
        const thText = th.textContent.toLowerCase();
        const columnLower = activeColumn.toLowerCase();
        
        if (thText.includes(columnLower) || 
            th.onclick?.toString().includes(activeColumn) ||
            (activeColumn === 'overallRank' && index === 0) ||
            (activeColumn === 'positionRank' && index === 1) ||
            (activeColumn === 'name' && index === 2) ||
            (activeColumn === 'fantasyPoints' && thText.includes('fantasy'))) {
            activeHeader = th;
        }
    });
    
    if (activeHeader) {
        activeHeader.classList.add(`sort-${direction}`);
        
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = direction === 'asc' ? ' ▲' : ' ▼';
        activeHeader.appendChild(indicator);
    }
}

// Make sortTable globally available
window.sortTable = sortTable;

// All existing backend functions (keep unchanged)
async function loadUserLeagues() {
    try {
        console.log('🔄 Loading user leagues...');
        
        const cached = localStorage.getItem('userLeagues');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 3600000) {
                userLeagues = parsed.leagues;
                console.log(`✅ Using cached leagues`);
                
                const defaultLeagueId = Object.keys(userLeagues)[0];
                if (defaultLeagueId) {
                    currentFilters.league = defaultLeagueId;
                    localStorage.setItem('activeLeagueId', defaultLeagueId);
                    
                    const rulesData = await window.statsAPI.getScoringRules(defaultLeagueId);
                    if (rulesData && rulesData[defaultLeagueId]) {
                        currentScoringRules = rulesData[defaultLeagueId];
                    }
                }
                
                return userLeagues;
            }
        }
        
        const response = await fetch('/data/stats/rules');
        
        if (!response.ok) {
            console.warn('⚠️ Failed to load leagues');
            return setEmptyDefaults();
        }
        
        const data = await response.json();
        
        if (data.needsImport) {
            return setEmptyDefaults();
        }
        
        if (data.leagues && data.scoringRules) {
            userLeagues = data.leagues;
            
            Object.keys(userLeagues).forEach(leagueId => {
                if (userLeagues[leagueId].teams) {
                    delete userLeagues[leagueId].teams;
                }
            });
            
            for (const [leagueId, scoringRules] of Object.entries(data.scoringRules)) {
                if (scoringRules && Object.keys(scoringRules).length > 0) {
                    await window.statsAPI.cache.setScoringRules(leagueId, scoringRules);
                }
            }
            
            if (data.rosters) {
                for (const [leagueId, leagueRosters] of Object.entries(data.rosters)) {
                    if (leagueRosters && typeof leagueRosters === 'object') {
                        for (const [week, rosterData] of Object.entries(leagueRosters)) {
                            if (rosterData && rosterData.rosters) {
                                await window.statsAPI.cache.setRosters(leagueId, week, rosterData);
                            }
                        }
                    }
                }
            }
            
            const defaultLeagueId = data.defaultLeagueId || Object.keys(userLeagues)[0];
            
            if (defaultLeagueId) {
                currentFilters.league = defaultLeagueId;
                localStorage.setItem('activeLeagueId', defaultLeagueId);
                
                if (data.scoringRules[defaultLeagueId]) {
                    currentScoringRules = data.scoringRules[defaultLeagueId];
                }
            }
            
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
    return {};
}

async function loadScoringRulesForActiveLeague(leagueId) {
    if (!leagueId) {
        currentScoringRules = {};
        return;
    }
    
    try {
        const rulesData = await window.statsAPI.getScoringRules(leagueId);
        
        if (rulesData && rulesData[leagueId]) {
            currentScoringRules = rulesData[leagueId];
            await loadStats(true);
        } else {
            currentScoringRules = {};
        }
        
    } catch (error) {
        console.error(`❌ Error loading scoring rules:`, error);
        currentScoringRules = {};
    }
}

function createFilterControls() {
    const activeLeagueId = currentFilters.league || initializeActiveLeague();
    
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

async function loadStats(resetPage = true) {
    if (apiState.loading) {
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
        const playersToLoad = apiState.currentPage * 50;        
        const playersData = await window.statsAPI.getPlayersForDisplay(
            currentFilters.year,
            currentFilters.week,
            currentFilters.position,
            playersToLoad
        );
        
        if (!playersData.success || !playersData.data) {
            throw new Error('Failed to load players data');
        }
        
        currentPlayers = playersData.data;
        
        if (showFantasyStats && currentScoringRules && Object.keys(currentScoringRules).length > 0) {
            currentPlayers = currentPlayers.map(player => ({
                ...player,
                fantasyPoints: calculateTotalFantasyPoints(player)
            }));
        }
        
        apiState.totalRecords = Math.max(currentPlayers.length, playersToLoad);
        apiState.hasMore = playersData.data.length >= playersToLoad;
        apiState.totalPages = Math.ceil(apiState.totalRecords / 50);
        apiState.loading = false;
        
    } catch (error) {
        console.error('Failed to load stats:', error);
        apiState.error = error.message;
        apiState.loading = false;
        currentPlayers = [];
    }
    
    updateFilterControlsUI();
    await render();
}

function setupEventListeners() {
    if (eventListenersSetup) {
        return;
    }

    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
        yearSelect.addEventListener('change', async (e) => {
            const newYear = e.target.value;
            currentFilters.year = newYear;
            currentFilters.week = 'total';
            window.statsAPI.yearDataLoaded.delete(newYear);
            await loadStats(true);
        });
    }
    
    const weekSelect = document.getElementById('week-select');
    if (weekSelect) {
        weekSelect.addEventListener('change', async (e) => {
            currentFilters.week = e.target.value;
            await loadStats(true);
        });
    }
    
    const leagueSelect = document.getElementById('league-select');
    if (leagueSelect) {
        leagueSelect.addEventListener('change', async (e) => {
            const newLeagueId = e.target.value;
            currentFilters.league = newLeagueId;
            localStorage.setItem('activeLeagueId', newLeagueId);
            await loadScoringRulesForActiveLeague(newLeagueId);
            updateFilterControlsUI();
        });
    }
    
    document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
            const mode = e.target.dataset.mode;
            document.querySelectorAll(`[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));
            showFantasyStats = mode === 'fantasy';
            await render();
        });
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            await render();
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            searchQuery = e.target.value.toLowerCase();
            await render();
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
    let filteredPlayers = [...currentPlayers];

    if (searchQuery) {
        filteredPlayers = filteredPlayers.filter(player => {
            return player.name.toLowerCase().includes(searchQuery) ||
                   player.team.toLowerCase().includes(searchQuery);
        });
    }
    
    return filteredPlayers;
}

const positionStats = window.STATS_CONFIG.POSITION_STATS;
const keyStats = window.STATS_CONFIG.POSITION_KEY_STATS;

function calculateFantasyPoints(statName, rawStatValue) {
    if (!showFantasyStats || !rawStatValue || rawStatValue === 0) {
        return rawStatValue || 0;
    }
    
    if (!currentScoringRules || Object.keys(currentScoringRules).length === 0) {
        return rawStatValue || 0;
    }
    
    const statId = Object.keys(window.STATS_CONFIG.STAT_ID_MAPPING).find(id => 
        window.STATS_CONFIG.STAT_ID_MAPPING[id].name === statName
    );
    
    if (!statId || !currentScoringRules[statId]) {
        return rawStatValue || 0;
    }
    
    return window.STATS_CONFIG.calculateFantasyPoints(statId, rawStatValue, currentScoringRules[statId]);
}

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
                
                let points = statValue * parseFloat(rule.points || 0);
                
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
        console.error(`Error calculating total fantasy points:`, error);
        return 0;
    }
}

function getStatValue(player, statName) {
    const rawValue = player.stats[statName] || 0;
    
    if (!showFantasyStats) {
        return rawValue;
    }
    
    if (!currentScoringRules || Object.keys(currentScoringRules).length === 0) {
        return rawValue;
    }
    
    try {
        return calculateFantasyPoints(statName, rawValue);
    } catch (error) {
        console.error(`Error calculating fantasy points:`, error);
        return rawValue;
    }
}

function shouldHideColumn(players, stat) {
    return players.every(player => {
        const value = player.stats[stat] || 0;
        return value === 0;
    });
}

function getVisibleStats(players, allStats) {
    return allStats.filter(stat => !shouldHideColumn(players, stat));
}

async function render() {
    const content = document.getElementById('content');
    let filteredPlayers = getFilteredPlayers();

    if (!Array.isArray(filteredPlayers)) {
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

    if (showFantasyStats && currentScoringRules && Object.keys(currentScoringRules).length > 0) {
        filteredPlayers = filteredPlayers.map(player => {
            if (!player.fantasyPoints && player.rawStats) {
                player.fantasyPoints = calculateTotalFantasyPoints(player);
            }
            return player;
        });
    }

    let mobileStatsToggle = document.querySelector('.mobile-stats-toggle');
    if (window.innerWidth <= 768 && !mobileStatsToggle) {
        createMobileStatsToggle();
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

function createMobileStatsToggle() {
    const viewToggle = document.querySelector('.view-toggle');
    if (viewToggle && !document.querySelector('.mobile-stats-toggle')) {
        const mobileToggle = document.createElement('div');
        mobileToggle.className = 'mobile-stats-toggle';
        mobileToggle.innerHTML = `
            <div class="stats-toggle">
                <button class="stats-toggle-btn ${!showFantasyStats ? 'active' : ''}" data-mode="raw">
                    Raw Stats
                </button>
                <button class="stats-toggle-btn ${showFantasyStats ? 'active' : ''}" data-mode="fantasy">
                    Fantasy Stats
                </button>
            </div>
        `;
        
        viewToggle.parentNode.insertBefore(mobileToggle, viewToggle.nextSibling);
        
        mobileToggle.querySelectorAll('.stats-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
                const mode = e.target.dataset.mode;
                document.querySelectorAll(`[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));
                showFantasyStats = mode === 'fantasy';
                await render();
            });
        });
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
                    
                    return `
                        <div class="stat-item">
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
    const allStats = getStatsForPosition(currentFilters.position);
    const visibleStats = getVisibleStats(players, allStats);
    
    console.log(`🎯 Rendering research view with ${players.length} players`);
    
    content.innerHTML = `
        <div class="research-container fade-in">
            <div class="research-header">
                <h2>Research Table - ${showFantasyStats ? 'Fantasy Points' : 'Raw Stats'}</h2>
                <div class="research-controls">
                    ${showFantasyStats ? '<span class="bonus-note">Fantasy stats with scoring rules applied</span>' : '<span class="stats-note">Raw statistics</span>'}
                    <span class="player-count">Showing ${players.length} players</span>
                    ${apiState.hasMore ? '<button id="load-more-btn">Load More Players</button>' : ''}
                </div>
            </div>
            <div class="research-table-wrapper">
                <table class="research-table">
                    <thead>
                        <tr>
                            <th onclick="sortTable('overallRank')" class="sortable">
                                Overall Rank
                            </th>
                            <th onclick="sortTable('positionRank')" class="sortable">
                                Pos Rank
                            </th>
                            <th onclick="sortTable('name')" class="sortable">
                                Player
                            </th>
                            ${showFantasyStats ? `
                                <th onclick="sortTable('fantasyPoints')" class="sortable">
                                    Total Fantasy Pts
                                </th>
                            ` : ''}
                            ${visibleStats.map(stat => `
                                <th onclick="sortTable('${stat}')" class="sortable">
                                    ${getShortStatName(stat)}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => {
                            return `
                                <tr class="clickable-row" onclick="navigateToPlayer('${player.id}')">
                                    <td class="rank-cell">#${player.overallRank || '-'}</td>
                                    <td class="rank-cell">#${player.positionRank || '-'}</td>
                                    <td class="player-name-cell">
                                        <div class="player-name-with-info">
                                            <div class="player-name">${player.name}</div>
                                            <div class="player-meta-info">
                                                <span class="position-tag">${player.position}</span>
                                                <span class="team-tag">${player.team}</span>
                                           </div>
                                       </div>
                                   </td>
                                   ${showFantasyStats ? `
                                       <td class="fantasy-stat-cell total-points">
                                           ${player.fantasyPoints ? player.fantasyPoints.toFixed(1) : calculateTotalFantasyPoints(player).toFixed(1)} pts
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
                               </tr>
                           `;
                       }).join('')}
                   </tbody>
               </table>
           </div>
       </div>
   `;
   
   const loadMoreBtn = document.getElementById('load-more-btn');
   if (loadMoreBtn) {
       loadMoreBtn.addEventListener('click', async () => {
           if (apiState.hasMore && !apiState.loading) {
               apiState.currentPage++;
               await loadStats(false);
           }
       });
   }
}

function getShortStatName(statName) {
   const abbreviations = {
       "Pass Att": "ATT",
       "Pass Yds": "YDS", 
       "Pass TD": "TD",
       "Rush Att": "ATT",
       "Rush Yds": "YDS",
       "Rush TD": "TD",
       "Rec Yds": "YDS",
       "Rec TD": "TD",
       "FG 0-19": "0-19",
       "FG 20-29": "20-29",
       "FG 30-39": "30-39",
       "FG 40-49": "40-49",
       "FG 50+": "50+",
       "Tack Solo": "SOLO",
       "Tack Ast": "AST",
       "Pass Def": "PD",
       "Fum Force": "FF",
       "Fum Rec": "FR"
   };
   
   return abbreviations[statName] || statName;
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

function categorizeStats(stats) {
   const categories = {
       "Passing": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack"],
       "Rushing": ["Rush Att", "Rush Yds", "Rush TD"],
       "Receiving": ["Rec", "Rec Yds", "Rec TD", "Targets"],
       "Kicking": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49", "FG 50+", "PAT Made", "PAT Miss"],
       "Defense": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
       "Special Teams": ["Ret Yds", "Ret TD"],
       "Team Defense": ["Pts Allow 0", "Pts Allow 1-6", "Pts Allow 7-13", "Pts Allow 14-20", "Pts Allow 21-27", "Pts Allow 28-34", "Pts Allow 35+"],
       "Turnovers": ["Fum", "Fum Lost"]
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
           
           if (stat.includes('Miss') || stat.includes('Allow') || stat === 'Int' || stat === 'Fum') {
               return aValue - bValue;
           }
           return bValue - aValue;
       })
       .slice(0, limit);
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

function navigateToPlayer(playerId) {
   const url = `player.html?id=${encodeURIComponent(playerId)}`;
   window.location.href = url;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
   console.log('🚀 Initializing Fantasy Football Dashboard with working sort...');
   
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
   
   try {
       await loadUserLeagues();
       updateFilterControlsUI();
   } catch (error) {
       console.warn('⚠️ Leagues failed to load, continuing with raw stats only');
   }
   
   await loadStats(true);
   console.log('🎉 Dashboard initialization complete with working sort!');
});
