// player.js - FIXED to extract rank from IndexedDB and fix math/UI + ENHANCED with Advanced Analytics
class PlayerDetailPage {
    constructor() {
        this.playerId = null;
        this.currentFilters = {
            year: '2024',
            week: 'ALL',
            showFantasyStats: false
        };
        this.playerData = null;
        this.currentAnalytics = null;
        this.scoringRules = {};
        this.isLoading = false;
    }

    async init() {
        console.log('🚀 Initializing Player Detail Page...');
        
        const urlParams = new URLSearchParams(window.location.search);
        this.playerId = urlParams.get('id');
        
        if (!this.playerId) {
            this.showError('No player ID provided');
            return;
        }

        console.log(`🎯 Loading player ID: ${this.playerId}`);

        this.setupEventListeners();
        await this.initializeStatsAPI();
        await this.loadScoringRules();
        await this.loadPlayerData();
    }

    async loadPlayerData() {
        if (this.isLoading) {
            console.log('⏳ Already loading player data...');
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            console.log(`📊 Loading complete player data for: ${this.playerId}`);
            
            this.playerData = await window.playerStatsAPI.getPlayerCompleteStats(this.playerId);

            if (this.playerData && Object.keys(this.playerData.years).length > 0) {
                this.updatePlayerHeader();
                this.recalculateAndRender();
            } else {
                this.showError('No data found for this player');
            }

        } catch (error) {
            console.error('❌ Error loading player data:', error);
            this.showError(`Failed to load player data: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }

    async initializeStatsAPI() {
        try {
            console.log('🔄 Initializing StatsAPI and IndexedDB...');
            if (window.statsAPI && window.statsAPI.cache) {
                await window.statsAPI.cache.init();
                console.log('✅ StatsAPI IndexedDB initialized');
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize StatsAPI:', error);
        }
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

        // Hide week filter as requested
        const weekFilter = document.querySelector('.week-filter');
        if (weekFilter) {
            weekFilter.style.display = 'none';
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

    recalculateAndRender() {
        if (!this.playerData) {
            console.warn('⚠️ No player data available for calculation');
            return;
        }

        console.log(`🧮 Recalculating analytics with filters:`, this.currentFilters);

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
            const currentYear = this.currentFilters.year === 'ALL' ? '2024' : this.currentFilters.year;
            const yearData = this.playerData.years[currentYear];
            
            // EXTRACT RANK FROM INDEXEDDB yearRank field
            let rankDisplay = '';
            if (yearData && yearData.rank) {
                rankDisplay = `<span class="rank-badge">#${yearData.rank} Overall</span>`;
            }
            
            headerInfo.innerHTML = `
                <div class="player-title">
                    <h1>${this.playerData.playerName}</h1>
                    <div class="player-meta">
                        <span class="position-badge">${this.playerData.position}</span>
                        <span class="team-badge">${this.playerData.team}</span>
                        ${rankDisplay}
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

    const { stats, summary, advancedAnalytics } = this.currentAnalytics;
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

    // NEW: Advanced Analytics Cards (only show in fantasy mode)
    const advancedAnalyticsHTML = this.currentFilters.showFantasyStats && advancedAnalytics ? `
        <div class="advanced-analytics-section">
            <h2 class="analytics-title">Fantasy Analytics</h2>
            <div class="analytics-cards">
                <div class="analytics-card consistency">
                    <div class="card-icon">📊</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.consistencyScore || 0}%</div>
                        <div class="card-label">Consistency Score</div>
                        <div class="card-subtitle">${this.getConsistencyDescription(advancedAnalytics.consistencyScore)}</div>
                    </div>
                </div>
                
                <div class="analytics-card volatility">
                    <div class="card-icon">📈</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.volatilityIndex || 0}</div>
                        <div class="card-label">Volatility Index</div>
                        <div class="card-subtitle">${this.getVolatilityDescription(advancedAnalytics.volatilityIndex)}</div>
                    </div>
                </div>
                
                <div class="analytics-card boom-bust">
                    <div class="card-icon">💥</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.boomRate || 0}% / ${advancedAnalytics.bustRate || 0}%</div>
                        <div class="card-label">Boom / Bust Rate</div>
                        <div class="card-subtitle">${this.getBoomBustDescription(advancedAnalytics.boomRate, advancedAnalytics.bustRate)}</div>
                    </div>
                </div>
                
                <div class="analytics-card td-dependency">
                    <div class="card-icon">🏈</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.tdDependency || 0}%</div>
                        <div class="card-label">TD Dependency</div>
                        <div class="card-subtitle">${this.getTdDependencyDescription(advancedAnalytics.tdDependency)}</div>
                    </div>
                </div>
                
                <div class="analytics-card efficiency">
                    <div class="card-icon">⚡</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.opportunityEfficiency || 0}</div>
                        <div class="card-label">Opportunity Efficiency</div>
                        <div class="card-subtitle">Points per touch</div>
                    </div>
                </div>
                
                <div class="analytics-card floor-ceiling">
                    <div class="card-icon">📏</div>
                    <div class="card-content">
                        <div class="card-value">${advancedAnalytics.floorCeiling?.floor || 0} - ${advancedAnalytics.floorCeiling?.ceiling || 0}</div>
                        <div class="card-label">Floor - Ceiling</div>
                        <div class="card-subtitle">10th - 90th percentile</div>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    // REMOVED: The stats-summary section completely

const tableHTML = `
    ${advancedAnalyticsHTML}
    
    <div class="stats-table-container">
        <table class="player-stats-table">
            <thead>
                <tr>
                    <th class="stat-name-col">Statistic</th>
                    <th class="stat-value-col">Total</th>
                    <th class="stat-value-col">AVG. PPG</th>
                    <th class="stat-value-col">Season Mid</th>
                    <th class="stat-value-col">Spread</th>
                    <th class="stat-value-col">Best Game</th>
                </tr>
            </thead>
            <tbody>
                ${statsEntries.map(([statId, statData]) => {
                    const displayStats = this.currentFilters.showFantasyStats && statData.fantasyStats ? 
                        statData.fantasyStats : statData.rawStats;
                    
                    const suffix = this.currentFilters.showFantasyStats && statData.fantasyStats ? ' pts' : '';
                    
                    // Calculate range (min - max) - now called "Spread"
                    const spreadText = displayStats.min === displayStats.max ? 
                        this.formatStatValue(displayStats.min) : 
                        `${this.formatStatValue(displayStats.min)} - ${this.formatStatValue(displayStats.max)}`;
                    
                    // Determine row shading class based on average vs median comparison
                    let rowClass = 'stat-row';
                    if (displayStats.average !== displayStats.median) {
                        if (displayStats.average > displayStats.median) {
                            rowClass += ' above-median';
                        } else if (displayStats.average < displayStats.median) {
                            rowClass += ' below-median';
                        }
                    }
                    
                    return `
                        <tr class="${rowClass}">
                            <td class="stat-name">${statData.statName}</td>
                            <td class="stat-total">${this.formatStatValue(displayStats.total)}${suffix}</td>
                            <td class="stat-average">${this.formatStatValue(displayStats.average)}${suffix}</td>
                            <td class="stat-median">${this.formatStatValue(displayStats.median)}${suffix}</td>
                            <td class="stat-range">${spreadText}${suffix}</td>
                            <td class="stat-max">${this.formatStatValue(displayStats.max)}${suffix}</td>
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

    // NEW: Description helpers for advanced analytics
    getConsistencyDescription(score) {
        if (score >= 90) return 'Very Reliable';
        if (score >= 80) return 'Steady Producer';
        if (score >= 70) return 'Fairly Consistent';
        if (score >= 60) return 'Somewhat Volatile';
        return 'Boom or Bust';
    }

    getVolatilityDescription(index) {
        if (index <= 0.3) return 'Very Stable';
        if (index <= 0.5) return 'Stable';
        if (index <= 0.7) return 'Moderate';
        if (index <= 1.0) return 'Volatile';
        return 'Highly Volatile';
    }

    getBoomBustDescription(boomRate, bustRate) {
        if (boomRate > 30) return 'High Ceiling Player';
        if (bustRate > 30) return 'Risky Floor';
        if (boomRate > 20 && bustRate < 20) return 'Upside Play';
        return 'Balanced Profile';
    }

    getTdDependencyDescription(dependency) {
        if (dependency > 50) return 'TD Dependent';
        if (dependency > 30) return 'Moderate TD Reliance';
        if (dependency > 15) return 'Some TD Reliance';
        return 'Volume-Based';
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

    if (!window.statsAPI) {
        console.error('❌ statsAPI not found. Make sure stats-api.js is loaded first.');
        return;
    }

    const playerPage = new PlayerDetailPage();
    await playerPage.init();
});
