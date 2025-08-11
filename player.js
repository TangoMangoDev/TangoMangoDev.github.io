// player.js - ENHANCED with intelligent stat coloring and mobile layout
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
       
       // Define which stats are "negative" (worse when they increase)
       this.negativeStats = new Set([
           'Int',           // Interceptions
           'Sack',          // Sacks (for QB)
           'Fum',           // Fumbles
           'Fum Lost',      // Fumbles Lost
           'Inc',           // Incompletions
           'FGM 0-19',      // Field Goal Misses
           'FGM 20-29',
           'FGM 30-39', 
           'FGM 40-49',
           'FGM 50+',
           'PAT Miss',      // PAT Misses
           'FG Miss',       // Generic FG Miss
           'Pts Allow',     // Points Allowed (Defense)
           'Pts Allow 1-6', // Points Allowed ranges
           'Pts Allow 7-13',
           'Pts Allow 14-20',
           'Pts Allow 21-27',
           'Pts Allow 28-34',
           'Pts Allow 35+',
           'Def Yds Allow', // Defense Yards Allowed
           'Yds Allow 100-199',
           'Yds Allow 200-299',
           'Yds Allow 300-399',
           'Yds Allow 400-499',
           'Yds Allow 500+'
       ]);
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
           return;
       }

       this.isLoading = true;
       this.showLoading();

       try {
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
           
           let rankDisplay = '';
           if (yearData && yearData.rank) {
               rankDisplay = `<span class="rank-badge">#${yearData.rank} Overall</span>`;
           }

           let startsDisplay = '';
           if (this.currentAnalytics && this.currentAnalytics.startsInfo) {
               const { displayText } = this.currentAnalytics.startsInfo;
               startsDisplay = `<span class="starts-badge">Starts: ${displayText}</span>`;
           }
           
           headerInfo.innerHTML = `
               <div class="player-title">
                   <h1>${this.playerData.playerName}</h1>
                   <div class="player-meta">
                       <span class="position-badge">${this.playerData.position}</span>
                       <span class="team-badge">${this.playerData.team}</span>
                       ${rankDisplay}
                       ${startsDisplay}
                   </div>
               </div>
           `;
       }
   }

   getStatColorClass(statName, value, isAverage = false) {
       const isNegativeStat = this.negativeStats.has(statName);
       
       if (value === 0) return '';
       
       if (isNegativeStat) {
           return value > 0 ? 'stat-negative' : 'stat-positive';
       } else {
           return value > 0 ? 'stat-positive' : '';
       }
   }

   formatYearOverYearDisplay(yoyData, statName) {
       if (!yoyData) return '';
       
       if (yoyData.isNew) {
           return '<span class="yoy-new">NEW</span>';
       }
       
       if (yoyData.percentage === null) return '';
       
       const percentage = yoyData.percentage;
       const sign = percentage >= 0 ? '+' : '';
       
       let colorClass;
       const isNegativeStat = this.negativeStats.has(statName);
       
       if (isNegativeStat) {
           colorClass = percentage >= 0 ? 'yoy-negative' : 'yoy-positive';
       } else {
           colorClass = percentage >= 0 ? 'yoy-positive' : 'yoy-negative';
       }
       
       return `<span class="yoy-change ${colorClass}">(${sign}${percentage}%)</span>`;
   }

   renderStatsTable() {
       const container = document.getElementById('playerStatsContainer');
       if (!container || !this.currentAnalytics) {
           console.warn('⚠️ Cannot render stats table - missing container or analytics');
           return;
       }

       const { stats, summary, advancedAnalytics, yearOverYear } = this.currentAnalytics;
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

       const showYearOverYear = this.currentFilters.year === '2024' && yearOverYear && Object.keys(yearOverYear).length > 0;

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

       const tableHTML = `
           ${advancedAnalyticsHTML}
           
           <div class="stats-table-container">
               <table class="player-stats-table">
                   <thead>
                       <tr>
                           <th class="stat-name-col" onclick="sortPlayerTable('statName')">Statistic</th>
                           <th class="stat-value-col" onclick="sortPlayerTable('total')">Total${showYearOverYear ? ' (YoY)' : ''}</th>
                           <th class="stat-value-col" onclick="sortPlayerTable('average')">AVG. PPG</th>
                           <th class="stat-value-col" onclick="sortPlayerTable('median')">Season Mid</th>
                           <th class="stat-value-col" onclick="sortPlayerTable('low')">Low</th>
                           <th class="stat-value-col" onclick="sortPlayerTable('max')">Best Game</th>
                       </tr>
                   </thead>
                   <tbody>
                       ${statsEntries.map(([statId, statData]) => {
                           const displayStats = this.currentFilters.showFantasyStats && statData.fantasyStats ? 
                               statData.fantasyStats : statData.rawStats;
                           
                           const suffix = this.currentFilters.showFantasyStats && statData.fantasyStats ? ' pts' : '';
                           
                           const lowValue = displayStats.lowGameValue !== undefined ? 
                               displayStats.lowGameValue : displayStats.min;
                           
                           const avgColorClass = this.getStatColorClass(statData.statName, displayStats.average, true);
                           const medianColorClass = this.getStatColorClass(statData.statName, displayStats.median, true);
                           const maxColorClass = 'stat-best-game';
                           
                           const yoyDisplay = showYearOverYear && yearOverYear[statId] ? 
                               this.formatYearOverYearDisplay(yearOverYear[statId], statData.statName) : '';
                           
                           return `
                               <tr class="stat-row">
                                   <td class="stat-name">${statData.statName}</td>
                                   <td class="stat-total">
                                       <span>${this.formatStatValue(displayStats.total)}${suffix}</span>
                                       ${yoyDisplay}
                                   </td>
                                   <td class="stat-average ${avgColorClass}">${this.formatStatValue(displayStats.average)}${suffix}</td>
                                   <td class="stat-median ${medianColorClass}">${this.formatStatValue(displayStats.median)}${suffix}</td>
                                   <td class="stat-low">${this.formatStatValue(lowValue)}${suffix}</td>
                                   <td class="stat-max ${maxColorClass}">${this.formatStatValue(displayStats.max)}${suffix}</td>
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
       
       this.updatePlayerHeader();
   }

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

// 🔥 SORTING FUNCTIONS OUTSIDE THE CLASS 🔥
let playerTableSort = {
    column: null,
    direction: 'desc'
};

function sortPlayerTable(column) {
    console.log(`🔄 Sorting player table by: ${column}`);
    
    const table = document.querySelector('.player-stats-table');
    if (!table) {
        console.error('❌ Player stats table not found');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    let direction = 'desc';
    if (playerTableSort.column === column) {
        direction = playerTableSort.direction === 'desc' ? 'asc' : 'desc';
    }
    
    playerTableSort = { column, direction };
    
    const sortedRows = rows.sort((a, b) => {
        let aValue, bValue;
        
        switch(column) {
            case 'statName':
                aValue = a.cells[0].textContent.trim();
                bValue = b.cells[0].textContent.trim();
                break;
            case 'total':
                aValue = parseFloat(a.cells[1].textContent.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(b.cells[1].textContent.replace(/[^\d.-]/g, '')) || 0;
                break;
            case 'average':
                aValue = parseFloat(a.cells[2].textContent.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(b.cells[2].textContent.replace(/[^\d.-]/g, '')) || 0;
                break;
            case 'median':
                aValue = parseFloat(a.cells[3].textContent.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(b.cells[3].textContent.replace(/[^\d.-]/g, '')) || 0;
                break;
            case 'low':
                aValue = parseFloat(a.cells[4].textContent.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(b.cells[4].textContent.replace(/[^\d.-]/g, '')) || 0;
                break;
            case 'max':
                aValue = parseFloat(a.cells[5].textContent.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(b.cells[5].textContent.replace(/[^\d.-]/g, '')) || 0;
                break;
            default:
                return 0;
        }
        
        if (column === 'statName') {
            if (direction === 'asc') {
                return aValue.localeCompare(bValue);
            } else {
                return bValue.localeCompare(aValue);
            }
        } else {
            if (direction === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        }
    });
    
    sortedRows.forEach(row => tbody.appendChild(row));
    updatePlayerTableSortIndicators(table, column, direction);
    
    console.log(`✅ Sorted player table by ${column} (${direction})`);
}

function updatePlayerTableSortIndicators(table, activeColumn, direction) {
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const existingIndicator = th.querySelector('.sort-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
    });
    
    const headers = table.querySelectorAll('th');
    const columnIndex = {
        'statName': 0,
        'total': 1,
        'average': 2,
        'median': 3,
        'low': 4,
        'max': 5
    }[activeColumn];
    
    if (columnIndex !== undefined && headers[columnIndex]) {
        const activeHeader = headers[columnIndex];
        activeHeader.classList.add(`sort-${direction}`);
        
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = direction === 'asc' ? ' ▲' : ' ▼';
        activeHeader.appendChild(indicator);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
   if (!window.statsAPI) {
       console.error('❌ statsAPI not found. Make sure stats-api.js is loaded first.');
       return;
   }

   const playerPage = new PlayerDetailPage();
   await playerPage.init();
});
