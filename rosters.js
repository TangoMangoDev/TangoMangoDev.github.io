// Fantasy Football Roster App
class FantasyRosterApp {
    constructor() {
        this.currentWeek = 1;
        this.currentView = 'roster';
        this.searchQuery = '';
        this.positionFilter = 'all';
        this.sortColumn = 'points';
        this.sortDirection = 'desc';
        this.selectedPlayer = null;
        
        this.mockData = this.generateMockData();
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.render();
    }
    
    bindEvents() {
        // Week navigation
        document.querySelector('.prev-week').addEventListener('click', () => this.changeWeek(-1));
        document.querySelector('.next-week').addEventListener('click', () => this.changeWeek(1));
        
        // View toggles
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeView(e.target.dataset.view));
        });
        
        // Search
        document.querySelector('.search-input').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.filterPlayers();
        });
        
        // Position filter
        document.querySelector('.position-filter').addEventListener('change', (e) => {
            this.positionFilter = e.target.value;
            this.filterPlayers();
        });
        
        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('playerModal').addEventListener('click', (e) => {
            if (e.target.id === 'playerModal') this.closeModal();
        });
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeTab(e.target.dataset.tab));
        });
    }
    
    generateMockData() {
        const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'K', 'DEF'];
        const teams = ['DAL', 'NYG', 'PHI', 'WAS', 'GB', 'CHI', 'MIN', 'DET'];
        const playerNames = {
            QB: ['Patrick Mahomes', 'Josh Allen', 'Lamar Jackson'],
            RB: ['Christian McCaffrey', 'Austin Ekeler', 'Derrick Henry', 'Nick Chubb'],
            WR: ['Tyreek Hill', 'Stefon Diggs', 'Justin Jefferson', 'CeeDee Lamb', 'AJ Brown'],
            TE: ['Travis Kelce', 'Mark Andrews', 'TJ Hockenson'],
            K: ['Justin Tucker', 'Harrison Butker'],
            DEF: ['49ers', 'Bills', 'Cowboys']
        };
        
        return {
            team: {
                name: 'Dynasty Destroyers',
                record: '7-2',
                score: 124.5,
                projectedScore: 132.8
            },
            opponent: {
                name: 'Gridiron Gladiators',
                score: 118.2,
                projectedScore: 125.4
            },
            roster: positions.map((pos, index) => {
                const names = playerNames[pos];
                const name = names[Math.floor(Math.random() * names.length)];
                const team = teams[Math.floor(Math.random() * teams.length)];
                const opponent = teams[Math.floor(Math.random() * teams.length)];
                
                return {
                    id: index + 1,
                    name: name,
                    position: pos,
                    team: team,
                    opponent: `vs ${opponent}`,
                    projection: Math.round(Math.random() * 20 + 5),
                    actual: Math.round(Math.random() * 25 + 3),
                    consistency: Math.round(Math.random() * 30 + 70),
                    trend: Math.random() > 0.5 ? 'up' : 'down',
                    stats: {
                        passingYards: pos === 'QB' ? Math.round(Math.random() * 150 + 200) : 0,
passingTDs: pos === 'QB' ? Math.round(Math.random() * 3) : 0,
                       rushingYards: ['RB', 'QB'].includes(pos) ? Math.round(Math.random() * 80 + 20) : 0,
                       rushingTDs: ['RB', 'QB'].includes(pos) ? Math.round(Math.random() * 2) : 0,
                       receivingYards: ['WR', 'TE', 'RB'].includes(pos) ? Math.round(Math.random() * 100 + 20) : 0,
                       receivingTDs: ['WR', 'TE', 'RB'].includes(pos) ? Math.round(Math.random() * 2) : 0,
                       receptions: ['WR', 'TE', 'RB'].includes(pos) ? Math.round(Math.random() * 8 + 2) : 0,
                       fieldGoals: pos === 'K' ? Math.round(Math.random() * 4) : 0,
                       extraPoints: pos === 'K' ? Math.round(Math.random() * 5) : 0,
                       sacks: pos === 'DEF' ? Math.round(Math.random() * 4) : 0,
                       interceptions: pos === 'DEF' ? Math.round(Math.random() * 3) : 0,
                       fumbles: pos === 'DEF' ? Math.round(Math.random() * 2) : 0
                   },
                   weeklyScores: Array.from({length: 17}, () => Math.round(Math.random() * 30 + 5))
               };
           })
       };
   }
   
   render() {
       this.renderHeader();
       this.renderRosterView();
       this.renderStatsView();
       this.renderMatchupView();
   }
   
   renderHeader() {
       document.querySelector('.team-name').textContent = this.mockData.team.name;
       document.querySelector('.team-record').textContent = this.mockData.team.record;
       document.querySelector('#weekNumber').textContent = this.currentWeek;
       document.querySelector('.my-score').textContent = this.mockData.team.score;
       document.querySelector('.opp-score').textContent = this.mockData.opponent.score;
       document.querySelector('.opponent-name').textContent = this.mockData.opponent.name;
   }
   
   renderRosterView() {
       const container = document.querySelector('#rosterView .roster-grid');
       container.innerHTML = '';
       
       // Group players by position
       const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
       const playersByPosition = {};
       
       this.getFilteredPlayers().forEach(player => {
           if (!playersByPosition[player.position]) {
               playersByPosition[player.position] = [];
           }
           playersByPosition[player.position].push(player);
       });
       
       positions.forEach(position => {
           if (playersByPosition[position]) {
               const group = this.createPositionGroup(position, playersByPosition[position]);
               container.appendChild(group);
           }
       });
   }
   
   createPositionGroup(position, players) {
       const group = document.createElement('div');
       group.className = 'position-group';
       
       const header = document.createElement('div');
       header.className = 'position-header';
       header.innerHTML = `
           <span>${position}</span>
           <span class="position-count">${players.length} player${players.length > 1 ? 's' : ''}</span>
       `;
       group.appendChild(header);
       
       const playersContainer = document.createElement('div');
       playersContainer.className = 'position-players';
       
       players.forEach(player => {
           const card = this.createPlayerCard(player);
           playersContainer.appendChild(card);
       });
       
       group.appendChild(playersContainer);
       return group;
   }
   
   createPlayerCard(player) {
       const template = document.getElementById('playerCardTemplate');
       const card = template.content.cloneNode(true);
       const element = card.querySelector('.player-card');
       
       element.dataset.playerId = player.id;
       
       // Basic info
       card.querySelector('.player-image').src = `https://ui-avatars.com/api/?name=${player.name}&background=6366f1&color=fff`;
       card.querySelector('.player-name').textContent = player.name;
       card.querySelector('.player-position').textContent = player.position;
       card.querySelector('.player-team').textContent = player.team;
       card.querySelector('.player-opponent').textContent = player.opponent;
       
       // Stats
       card.querySelector('.stat-value.projection').textContent = player.projection;
       card.querySelector('.stat-value.actual').textContent = player.actual;
       
       // Badges
       const badgesContainer = card.querySelector('.player-badges');
       
       // Performance badge
       const performance = player.actual - player.projection;
       if (performance > 5) {
           badgesContainer.innerHTML += '<span class="badge good">HOT</span>';
       } else if (performance < -5) {
           badgesContainer.innerHTML += '<span class="badge bad">COLD</span>';
       }
       
       // Consistency badge
       if (player.consistency > 85) {
           badgesContainer.innerHTML += '<span class="badge good">RELIABLE</span>';
       } else if (player.consistency < 60) {
           badgesContainer.innerHTML += '<span class="badge warning">VOLATILE</span>';
       }
       
       // Trend badge
       if (player.trend === 'up') {
           badgesContainer.innerHTML += '<span class="badge good">↑</span>';
       } else {
           badgesContainer.innerHTML += '<span class="badge bad">↓</span>';
       }
       
       // Expanded stats
       const expandedSection = card.querySelector('.player-expanded');
       expandedSection.innerHTML = this.getExpandedStats(player);
       
       // Event listeners
       card.querySelector('.expand-btn').addEventListener('click', (e) => {
           e.stopPropagation();
           element.classList.toggle('expanded');
       });
       
       card.querySelector('.player-main').addEventListener('click', () => {
           this.showPlayerDetail(player);
       });
       
       return card;
   }
   
   getExpandedStats(player) {
       let html = '<div class="expanded-stats-grid">';
       
       if (player.position === 'QB') {
           html += `
               <div class="expanded-stat">
                   <span class="stat-label">Pass Yds</span>
                   <span class="stat-value">${player.stats.passingYards}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Pass TD</span>
                   <span class="stat-value">${player.stats.passingTDs}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rush Yds</span>
                   <span class="stat-value">${player.stats.rushingYards}</span>
               </div>
           `;
       } else if (player.position === 'RB') {
           html += `
               <div class="expanded-stat">
                   <span class="stat-label">Rush Yds</span>
                   <span class="stat-value">${player.stats.rushingYards}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rush TD</span>
                   <span class="stat-value">${player.stats.rushingTDs}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rec</span>
                   <span class="stat-value">${player.stats.receptions}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rec Yds</span>
                   <span class="stat-value">${player.stats.receivingYards}</span>
               </div>
           `;
       } else if (player.position === 'WR' || player.position === 'TE') {
           html += `
               <div class="expanded-stat">
                   <span class="stat-label">Rec</span>
                   <span class="stat-value">${player.stats.receptions}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rec Yds</span>
                   <span class="stat-value">${player.stats.receivingYards}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Rec TD</span>
                   <span class="stat-value">${player.stats.receivingTDs}</span>
               </div>
           `;
       } else if (player.position === 'K') {
           html += `
               <div class="expanded-stat">
                   <span class="stat-label">FG</span>
                   <span class="stat-value">${player.stats.fieldGoals}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">XP</span>
                   <span class="stat-value">${player.stats.extraPoints}</span>
               </div>
           `;
       } else if (player.position === 'DEF') {
           html += `
               <div class="expanded-stat">
                   <span class="stat-label">Sacks</span>
                   <span class="stat-value">${player.stats.sacks}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">INT</span>
                   <span class="stat-value">${player.stats.interceptions}</span>
               </div>
               <div class="expanded-stat">
                   <span class="stat-label">Fum</span>
                   <span class="stat-value">${player.stats.fumbles}</span>
               </div>
           `;
       }
       
       html += '</div>';
       return html;
   }
   
   renderStatsView() {
       const tbody = document.querySelector('.stats-table tbody');
       tbody.innerHTML = '';
       
       const sortedPlayers = this.getSortedPlayers();
       
       sortedPlayers.forEach(player => {
           const row = document.createElement('tr');
           const difference = player.actual - player.projection;
           
           row.innerHTML = `
               <td class="sticky-col">
                   <div style="display: flex; align-items: center; gap: 0.75rem;">
                       <img src="https://ui-avatars.com/api/?name=${player.name}&background=6366f1&color=fff" 
                            style="width: 32px; height: 32px; border-radius: 50%;">
                       <div>
                           <div style="font-weight: 600;">${player.name}</div>
                           <div style="font-size: 0.75rem; color: var(--text-secondary);">
                               ${player.position} - ${player.team}
                           </div>
                       </div>
                   </div>
               </td>
               <td style="font-weight: 600;">${player.actual}</td>
               <td>${player.projection}</td>
               <td style="color: ${difference > 0 ? 'var(--secondary-color)' : 'var(--danger-color)'}; font-weight: 600;">
                   ${difference > 0 ? '+' : ''}${difference.toFixed(1)}
               </td>
               <td>
                   <div style="display: flex; align-items: center; gap: 0.5rem;">
                       <div style="width: 60px; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                           <div style="width: ${player.consistency}%; height: 100%; background: ${player.consistency > 80 ? 'var(--secondary-color)' : player.consistency > 60 ? 'var(--warning-color)' : 'var(--danger-color)'};"></div>
                       </div>
                       <span style="font-size: 0.875rem;">${player.consistency}%</span>
                   </div>
               </td>
               <td>
                   <span style="color: ${player.trend === 'up' ? 'var(--secondary-color)' : 'var(--danger-color)'};">
                       ${player.trend === 'up' ? '↑' : '↓'}
                   </span>
               </td>
           `;
           
           row.addEventListener('click', () => this.showPlayerDetail(player));
           tbody.appendChild(row);
       });
       
       // Sort functionality
       document.querySelectorAll('.sortable').forEach(th => {
           th.addEventListener('click', (e) => {
               const column = e.target.dataset.sort;
               if (this.sortColumn === column) {
                   this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
               } else {
                   this.sortColumn = column;
                   this.sortDirection = 'desc';
               }
               this.renderStatsView();
           });
       });
   }
   
   renderMatchupView() {
       // This would render the matchup comparison view
       // For brevity, implementing a simplified version
       const myTeamContainer = document.querySelector('.my-team .matchup-roster');
       const oppTeamContainer = document.querySelector('.opponent-team .matchup-roster');
       
       myTeamContainer.innerHTML = '';
       oppTeamContainer.innerHTML = '';
       
       this.mockData.roster.forEach(player => {
           const playerElement = document.createElement('div');
           playerElement.className = 'matchup-player';
           playerElement.innerHTML = `
               <div style="padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color);">
                   <div>
                       <div style="font-weight: 600;">${player.name}</div>
                       <div style="font-size: 0.75rem; color: var(--text-secondary);">${player.position}</div>
                   </div>
                   <div style="font-size: 1.25rem; font-weight: 700;">${player.actual}</div>
               </div>
           `;
           myTeamContainer.appendChild(playerElement);
       });
   }
   
   showPlayerDetail(player) {
       this.selectedPlayer = player;
       const modal = document.getElementById('playerModal');
       
       // Update modal content
       document.querySelector('.player-detail-image').src = `https://ui-avatars.com/api/?name=${player.name}&background=6366f1&color=fff`;
       document.querySelector('.player-detail-name').textContent = player.name;
       document.querySelector('.player-detail-meta').textContent = `${player.position} - ${player.team} ${player.opponent}`;
       
       // Show default tab
       this.changeTab('season');
       
       modal.classList.add('active');
   }
   
   closeModal() {
       document.getElementById('playerModal').classList.remove('active');
   }
   
   changeTab(tab) {
       document.querySelectorAll('.tab-btn').forEach(btn => {
           btn.classList.toggle('active', btn.dataset.tab === tab);
       });
       
       const content = document.querySelector('.tab-content');
       
       switch(tab) {
           case 'season':
               content.innerHTML = this.renderSeasonStats();
               break;
           case 'weekly':
               content.innerHTML = this.renderWeeklyLogs();
               break;
           case 'metrics':
               content.innerHTML = this.renderCustomMetrics();
               break;
       }
   }
   
   renderSeasonStats() {
       if (!this.selectedPlayer) return '';
       
       const player = this.selectedPlayer;
       let html = '<div class="season-stats">';
       
       html += '<h3 style="margin-bottom: 1rem;">Season Overview</h3>';
       html += '<div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">';
       
       if (player.position === 'QB') {
           html += this.createStatCard('Passing Yards', player.stats.passingYards * 16, 'yards');
           html += this.createStatCard('Passing TDs', player.stats.passingTDs * 16, 'touchdowns');
           html += this.createStatCard('Rushing Yards', player.stats.rushingYards * 16, 'yards');
       } else if (player.position === 'RB') {
           html += this.createStatCard('Rushing Yards', player.stats.rushingYards * 16, 'yards');
           html += this.createStatCard('Rushing TDs', player.stats.rushingTDs * 16, 'touchdowns');
           html += this.createStatCard('Receptions', player.stats.receptions * 16, 'catches');
           html += this.createStatCard('Receiving Yards', player.stats.receivingYards * 16, 'yards');
       }
       
       html += '</div>';
       
       // Performance chart placeholder
       html += '<div style="margin-top: 2rem;">';
       html += '<h3 style="margin-bottom: 1rem;">Performance Trend</h3>';
       html += '<div style="height: 200px; background: var(--bg-primary); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);">Chart visualization would go here</div>';
       html += '</div>';
       
       html += '</div>';
       return html;
   }
   
   renderWeeklyLogs() {
       if (!this.selectedPlayer) return '';
       
       let html = '<div class="weekly-logs">';
       html += '<h3 style="margin-bottom: 1rem;">Weekly Performance</h3>';
       html += '<div style="overflow-x: auto;">';
       html += '<table style="width: 100%; border-collapse: collapse;">';
       html += '<thead><tr style="border-bottom: 1px solid var(--border-color);">';
       html += '<th style="text-align: left; padding: 0.75rem;">Week</th>';
       html += '<th style="text-align: left; padding: 0.75rem;">Opponent</th>';
       html += '<th style="text-align: left; padding: 0.75rem;">Points</th>';
       html += '<th style="text-align: left; padding: 0.75rem;">Performance</th>';
       html += '</tr></thead><tbody>';
       
       for (let i = 0; i < Math.min(this.currentWeek, 17); i++) {
           const points = this.selectedPlayer.weeklyScores[i];
           const avg = this.selectedPlayer.weeklyScores.reduce((a, b) => a + b, 0) / this.selectedPlayer.weeklyScores.length;
           const performance = points > avg * 1.2 ? 'great' : points < avg * 0.8 ? 'poor' : 'average';
           
           html += `<tr style="border-bottom: 1px solid var(--border-color);">
               <td style="padding: 0.75rem;">${i + 1}</td>
               <td style="padding: 0.75rem;">vs Team</td>
               <td style="padding: 0.75rem; font-weight: 600;">${points}</td>
               <td style="padding: 0.75rem;">
                   <span class="badge ${performance === 'great' ? 'good' : performance === 'poor' ? 'bad' : ''}">${performance.toUpperCase()}</span>
               </td>
           </tr>`;
       }
       
       html += '</tbody></table></div></div>';
       return html;
   }
   
   renderCustomMetrics() {
       if (!this.selectedPlayer) return '';
       
       let html = '<div class="custom-metrics">';
       html += '<h3 style="margin-bottom: 1rem;">Advanced Metrics</h3>';
       html += '<div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">';
       
       html += this.createMetricCard('Consistency Score', `${this.selectedPlayer.consistency}%`, 
           this.selectedPlayer.consistency > 80 ? 'good' : this.selectedPlayer.consistency > 60 ? 'warning' : 'bad');
       
       html += this.createMetricCard('Trend', this.selectedPlayer.trend === 'up' ? 'Trending Up ↑' : 'Trending Down ↓',
           this.selectedPlayer.trend === 'up' ? 'good' : 'bad');
       
       const boom = Math.round(Math.random() * 30 + 20);
       html += this.createMetricCard('Boom Rate', `${boom}%`, boom > 30 ? 'good' : 'warning');
       
       const bust = Math.round(Math.random() * 20 + 10);
       html += this.createMetricCard('Bust Rate', `${bust}%`, bust < 15 ? 'good' : 'bad');
       
       html += '</div></div>';
       return html;
   }
   
   createStatCard(label, value, unit) {
       return `
           <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: var(--radius-md);">
               <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${label}</div>
               <div style="font-size: 1.5rem; font-weight: 700;">${value.toLocaleString()}</div>
               <div style="font-size: 0.75rem; color: var(--text-tertiary);">${unit}</div>
           </div>
       `;
   }
   
   createMetricCard(label, value, status) {
       return `
           <div style="background: var(--bg-primary); padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
               <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${label}</div>
               <div style="font-size: 1.25rem; font-weight: 700; color: ${status === 'good' ? 'var(--secondary-color)' : status === 'bad' ? 'var(--danger-color)' : 'var(--warning-color)'};">${value}</div>
           </div>
       `;
   }
   
   changeWeek(direction) {
       const newWeek = this.currentWeek + direction;
       if (newWeek >= 1 && newWeek <= 17) {
           this.currentWeek = newWeek;
           document.querySelector('#weekNumber').textContent = this.currentWeek;
           // In a real app, this would fetch new data
           this.render();
       }
   }
   
   changeView(view) {
       this.currentView = view;
       
       document.querySelectorAll('.view-btn').forEach(btn => {
           btn.classList.toggle('active', btn.dataset.view === view);
       });
       
       document.querySelectorAll('.view-container').forEach(container => {
           container.classList.toggle('active', container.id === `${view}View`);
       });
   }
   
   getFilteredPlayers() {
       return this.mockData.roster.filter(player => {
           const matchesSearch = !this.searchQuery || 
               player.name.toLowerCase().includes(this.searchQuery) ||
               player.team.toLowerCase().includes(this.searchQuery);
           
           const matchesPosition = this.positionFilter === 'all' || 
               player.position === this.positionFilter;
           
           return matchesSearch && matchesPosition;
       });
   }
   
   getSortedPlayers() {
       const players = [...this.getFilteredPlayers()];
       
       players.sort((a, b) => {
           let aValue, bValue;
           
           switch(this.sortColumn) {
               case 'points':
                   aValue = a.actual;
                   bValue = b.actual;
                   break;
               case 'projection':
                   aValue = a.projection;
                   bValue = b.projection;
                   break;
               case 'difference':
                   aValue = a.actual - a.projection;
                   bValue = b.actual - b.projection;
                   break;
               case 'consistency':
                   aValue = a.consistency;
                   bValue = b.consistency;
                   break;
               case 'trend':
                   aValue = a.trend === 'up' ? 1 : 0;
                   bValue = b.trend === 'up' ? 1 : 0;
                   break;
           }
           
           return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
       });
       
       return players;
   }
   
   filterPlayers() {
       this.render();
   }
}

// Additional CSS for components not in the main CSS file
const style = document.createElement('style');
style.textContent = `
   .expanded-stats-grid {
       display: grid;
       grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
       gap: 1rem;
   }
   
   .expanded-stat {
       text-align: center;
   }
   
   .expanded-stat .stat-label {
       display: block;
       font-size: 0.75rem;
       color: var(--text-tertiary);
       margin-bottom: 0.25rem;
   }
   
   .expanded-stat .stat-value {
       font-size: 1.25rem;
       font-weight: 700;
   }
   
   .position-players {
       padding: 1rem;
       display: grid;
       gap: 0.75rem;
   }
`;
document.head.appendChild(style);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
   new FantasyRosterApp();
});
