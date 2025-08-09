// player.js - Player detail page logic with optimized performance
class PlayerDetailPage {
    constructor() {
        this.playerId = null;
        this.playerName = null;
        this.currentFilters = {
            year: '2024',
            week: 'ALL',
            showFantasyStats: false
        };
        this.playerData = null;
        this.currentAnalytics = null;
        this.scoringRules = {};
        this.isLoading = false;
        this.loadingQueue = [];
    }

    async init() {
        console.log('🚀 Initializing Player Detail Page...');
        
        // Get player info from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.playerId = urlParams.get('id');
        this.playerName = urlParams.get('name');
        
        if (!this.playerId) {
            this.showError('No player ID provided');
            return;
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Load scoring rules first (for fantasy calculations)
        await this.loadScoringRules();
        
        // Start loading player data
        await this.loadPlayerData();
    }

    setupEventListeners() {
        // Stats toggle (Raw vs Fantasy)
        document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.stats-toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const newMode = e.target.dataset.mode === 'fantasy';
                if (newMode !== this.currentFilters.showFantasyStats) {
                    this.currentFilters.showFantasyStats = newMode;
                    this.recalculateAndRender();
                }
            });
        });

        // Year filter
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.currentFilters.year = e.target.value;
                this.recalculateAndRender();
            });
        }

        // Week filter
        const weekSelect = document.getElementById('week-select');
        if (weekSelect) {
            weekSelect.addEventListener('change', (e) => {
                this.currentFilters.week = e.target.value;
                this.recalculateAndRender();
            });
        }
    }

    async loadScoringRules() {
        try {
            const activeLeagueId = localStorage.getItem('activeLeagueId');
            if (activeLeagueId && window.statsAPI) {
                const rulesData = await window.statsAPI.getScoringRules(activeLeagueId);
                if (rulesData && rulesData[activeLeagueId]) {
                    this.scoringRules = rulesData[activeLeagueId];
                    console.log(`✅ Loaded ${Object.keys(this.scoringRules).length} scoring rules for fantasy calculations`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load scoring rules, fantasy stats will be unavailable:', error);
        }
    }

    async loadPlayerData() {
        if (this.isLoading) {
            console.log('⏳ Already loading player data, queuing request...');
            return new Promise((resolve) => {
                this.loadingQueue.push(resolve);
            });
        }

        this.isLoading = true;
        this.showLoading();

        try {
            console.log(`📊 Loading complete player data for: ${this.playerId}`);
            
            // Priority loading: Current year first for immediate display
            const currentYearData = await this.loadPlayerDataForYear(this.currentFilters.year);
            
            if (currentYearData) {
                // Show current year data immediately
                this.playerData = {
                    playerId: this.playerId,
                    playerName: this.playerName || currentYearData.playerName,
                    position: currentYearData.position,
                    team: currentYearData.team,
                    years: { [this.currentFilters.year]: currentYearData }
                };

                this.updatePlayerHeader();
                this.recalculateAndRender();
            }

            // Background loading: Other years (don't block UI)
            this.loadOtherYearsInBackground();

        } catch (error) {
            console.error('❌ Error loading player data:', error);
            this.showError(`Failed to load player data: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.processLoadingQueue();
        }
    }

    async loadPlayerDataForYear(year) {
        try {
            return await window.playerStatsAPI.getPlayerStatsForYear(this.playerId, year);
        } catch (error) {
            console.error(`❌ Error loading player data for year ${year}:`, error);
            return null;
        }
    }

    async loadOtherYearsInBackground() {
        // Load other available years in background
        const currentYear = parseInt(this.currentFilters.year);
        const otherYears = ['2024', '2023'].filter(year => parseInt(year) !== currentYear);

        // Use setTimeout to ensure this doesn't block UI
        setTimeout(async () => {
            for (const year of otherYears) {
                try {
                    const yearData = await this.loadPlayerDataForYear(year);
                    if (yearData && yearData.weeks && Object.keys(yearData.weeks).length > 0) {
                        this.playerData.years[year] = yearData;
                        console.log(`✅ Background loaded year ${year} for player ${this.playerId}`);
                        
                        // Re-render if we're currently viewing this year or all years
                        if (this.currentFilters.year === year || this.currentFilters.year === 'ALL') {
                            this.recalculateAndRender();
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load year ${year} in background:`, error);
                }
                
                // Small delay between years to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }, 50);
    }

    processLoadingQueue() {
        while (this.loadingQueue.length > 0) {
            const resolve = this.loadingQueue.shift();
            resolve();
        }
    }

    recalculateAndRender() {
        if (!this.playerData) {
            console.warn('⚠️ No player data available for calculation');
            return;
        }

        console.log(`🧮 Recalculating analytics with filters:`, this.currentFilters);

        // Calculate analytics based on current filters
        this.currentAnalytics = window.playerStatsAPI.calculatePlayerAnalytics(
            this.playerData,
            this.currentFilters.year,
            this.currentFilters.week,
            this.currentFilters.showFantasyStats,
            this.scoringRules
        );

        this.renderStatsTable();
    }

    updatePlayerHeader() {
        const headerInfo = document.getElementById('playerHeaderInfo');
        if (headerInfo && this.playerData) {
            const rank = this.playerData.years[this.currentFilters.year]?.rank || '';
            const rankDisplay = rank ? `#${rank} Overall` : '';
            
            headerInfo.innerHTML = `
                <div class="player-title">
                    <h1>${this.playerData.playerName}</h1>
                    <div class="player-meta">
                        <span class="position-badge">${this.playerData.position}</span>
                        <span class="team-badge">${this.playerData.team}</span>
                        ${rankDisplay ? `<span class="rank-badge">${rankDisplay}</span>` : ''}
                    </div>
                </div>
            `;
        }
    }

    renderStatsTable() {
        const container = document.getElementById('playerStatsContainer');
        if (!container || !this.currentAnalytics) {
            console.warn('⚠️ Cannot render stats table - missing container or analytics');
            return;
        }

        const { stats, summary } = this.currentAnalytics;
        const statsEntries = Object.entries(stats);

        if (statsEntries.length === 0) {
            container.innerHTML = `
                <div class="no-stats-message">
                    <h3>No stats available</h3>
                    <p>No statistics found for the selected filters.</p>
                </div>
            `;
            container.style.display = 'block';
            this.hideLoading();
            return;
        }

        const tableHTML = `
            <div class="stats-summary">
                <div class="summary-item">
                    <span class="summary-label">Games Played:</span>
                    <span class="summary-value">${summary.totalGames}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Weeks:</span>
                    <span class="summary-value">${summary.totalWeeks}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Years:</span>
                    <span class="summary-value">${summary.yearsPlayed}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Mode:</span>
                    <span class="summary-value">${this.currentFilters.showFantasyStats ? 'Fantasy Points' : 'Raw Stats'}</span>
                </div>
            </div>

            <div class="stats-table-container">
                <table class="player-stats-table">
                    <thead>
                        <tr>
                            <th class="stat-name-col">Statistic</th>
                            <th class="stat-value-col">Total</th>
                            <th class="stat-value-col">Average</th>
                            <th class="stat-value-col">Median</th>
                            <th class="stat-value-col">Best</th>
                            <th class="stat-value-col">Games</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statsEntries.map(([statId, statData]) => {
                            const displayStats = this.currentFilters.showFantasyStats && statData.fantasyStats ? 
                                statData.fantasyStats : statData.rawStats;
                            
                            const suffix = this.currentFilters.showFantasyStats && statData.fantasyStats ? ' pts' : '';
                            
                            return `
                                <tr class="stat-row">
                                    <td class="stat-name">${statData.statName}</td>
                                    <td class="stat-total">${this.formatStatValue(displayStats.total)}${suffix}</td>
                                    <td class="stat-average">${this.formatStatValue(displayStats.average)}${suffix}</td>
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
            30: "TD", 31: "Safe", 32: "Blk Kick", 33: "Ret Yds", 34: "Ret TD"
        };
    }

    const playerPage = new PlayerDetailPage();
    await playerPage.init();
});
