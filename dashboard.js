// COMPLETE FANTASY DASHBOARD WITH STATS AUTO-LOADING AND PAGINATION

// Stats API Client with URL parameters and pagination
class StatsAPIClient {
    constructor() {
        this.baseUrl = '/data/stats';
        this.cache = new Map();
    }

    async getStats(year = '2024', week = 'total', position = 'ALL', page = 1, limit = 50, forceRefresh = false) {
        const cacheKey = `${year}_${week}_${position}_${page}_${limit}`;
        
        console.log(`🔍 Requesting stats: Year=${year}, Week=${week}, Position=${position}, Page=${page}`);
        
        // Check in-memory cache first
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log(`📦 Serving from memory cache: ${cacheKey}`);
            return this.cache.get(cacheKey);
        }

        // Check IndexedDB cache
        if (!forceRefresh && window.statsDB && window.statsDB.isDataLoaded(year, week, position, page)) {
            console.log(`📦 Serving from IndexedDB: ${cacheKey}`);
            const cachedData = await window.statsDB.getStats(year, week, position, page);
            if (cachedData && cachedData.length > 0) {
                const result = {
                    success: true,
                    data: cachedData,
                    pagination: {
                        page: page,
                        limit: limit,
                        totalRecords: cachedData.length,
                        totalPages: Math.ceil(cachedData.length / limit),
                        hasNext: false,
                        hasPrev: page > 1
                    }
                };
                this.cache.set(cacheKey, result);
                return result;
            }
        }

        // Fetch from backend
        const params = new URLSearchParams({
            year: year,
            week: week,
            position: position,
            page: page.toString(),
            limit: limit.toString()
        });

        const url = `${this.baseUrl}?${params.toString()}`;
        console.log(`🌐 Fetching from backend: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch stats');
            }

            console.log(`✅ Fetched ${result.data.length} records from backend`);

            // Store in IndexedDB
            if (window.statsDB && result.data.length > 0) {
                await window.statsDB.storeStats(result.data, year, week, position, page);
                console.log(`💾 Stored ${result.data.length} records in IndexedDB`);
            }

            // Store in memory cache
            this.cache.set(cacheKey, result);

            return result;

        } catch (error) {
            console.error('❌ Error fetching stats:', error);
            throw error;
        }
    }

    clearCache() {
        this.cache.clear();
        console.log('🗑️ Memory cache cleared');
    }

    getCacheInfo() {
        return {
            memoryCacheSize: this.cache.size,
            memoryCacheKeys: Array.from(this.cache.keys())
        };
    }
}

// IndexedDB Manager with pagination support
class StatsIndexedDB {
    constructor() {
        this.dbName = 'FantasyStatsDB';
        this.version = 1;
        this.db = null;
        this.loadTracker = new Map();
    }

    async init() {
        console.log('🗃️ Initializing IndexedDB...');
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ IndexedDB initialization failed:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.loadStoredTracker();
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔨 Creating IndexedDB schema...');
                
                if (!db.objectStoreNames.contains('stats')) {
                    const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
                    statsStore.createIndex('year', 'year', { unique: false });
                    statsStore.createIndex('week', 'week', { unique: false });
                    statsStore.createIndex('position', 'position', { unique: false });
                    statsStore.createIndex('playerKey', 'playerKey', { unique: false });
                    statsStore.createIndex('page', 'page', { unique: false });
                    console.log('✅ Stats store created');
                }

                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    console.log('✅ Metadata store created');
                }
            };
        });
    }

    generateLoadKey(year, week, position = 'ALL', page = 1) {
        return `${year}_${week}_${position}_${page}`;
    }

    isDataLoaded(year, week, position = 'ALL', page = 1) {
        const key = this.generateLoadKey(year, week, position, page);
        return this.loadTracker.has(key) || localStorage.getItem(`loaded_${key}`) === 'true';
    }

    markAsLoaded(year, week, position = 'ALL', page = 1) {
        const key = this.generateLoadKey(year, week, position, page);
        this.loadTracker.set(key, true);
        localStorage.setItem(`loaded_${key}`, 'true');
        console.log(`✅ Marked as loaded: ${key}`);
    }

    loadStoredTracker() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('loaded_') && localStorage.getItem(key) === 'true') {
                const loadKey = key.replace('loaded_', '');
                this.loadTracker.set(loadKey, true);
                count++;
            }
        }
        console.log(`📋 Loaded ${count} cached data keys from localStorage`);
    }

    async storeStats(statsArray, year, week, position = 'ALL', page = 1) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readwrite');
        const store = transaction.objectStore('stats');

        for (const player of statsArray) {
            const record = {
                id: `${player.playerKey}_${year}_${week}_${page}`,
                playerKey: player.playerKey,
                playerName: player.playerName,
                position: player.position,
                team: player.team,
                year: year,
                week: week,
                page: page,
                stats: player.stats,
                storedAt: new Date().toISOString()
            };

            await store.put(record);
        }

        this.markAsLoaded(year, week, position, page);
    }

    async getStats(year, week, position = 'ALL', page = 1) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readonly');
        const store = transaction.objectStore('stats');

        const results = await new Promise((resolve) => {
            const allData = [];
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    if (record.year === year && record.week === week && record.page === page) {
                        if (position === 'ALL' || record.position === position) {
                            allData.push(record);
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(allData);
                }
            };
        });

        console.log(`📦 Retrieved ${results.length} records from IndexedDB`);
        return results;
    }

    async getStorageInfo() {
        if (!this.db) return { statsRecords: 0, loadedKeys: [] };
        
        const transaction = this.db.transaction(['stats'], 'readonly');
        const store = transaction.objectStore('stats');

        const count = await new Promise((resolve) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
        });

        return {
            statsRecords: count,
            loadedKeys: Array.from(this.loadTracker.keys())
        };
    }
}

// Main Fantasy Dashboard Class
class FantasyDashboard {
    constructor() {
        // Stats properties
        this.currentYear = '2024';
        this.currentWeek = 'total';
        this.currentPosition = 'ALL';
        this.currentPage = 1;
        this.pageSize = 50;
        this.statsData = [];
        this.pagination = null;
        this.isStatsLoading = false;
        
        console.log('🚀 Initializing Fantasy Dashboard...');
        
        this.initializeElements();
        this.bindEvents();
        this.initializeStats();
    }
    
    async initializeStats() {
        try {
            console.log('📊 Initializing stats system...');
            
            // Show loading state
            this.showStatsLoading();
            this.updateDebugInfo('Initializing IndexedDB...');
            
            // Initialize IndexedDB
            window.statsDB = new StatsIndexedDB();
            await window.statsDB.init();
            
            // Initialize API client
            window.statsAPI = new StatsAPIClient();
            
            this.updateDebugInfo('Loading initial stats data...');
            console.log('🔄 Loading initial stats data automatically...');
            
            // Load initial stats data (CRITICAL - this makes the first API call)
            await this.loadStatsData();
            
            console.log('✅ Stats system initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing stats:', error);
            this.showError(`Failed to initialize stats: ${error.message}`);
            this.updateDebugInfo(`Error: ${error.message}`);
        }
    }
    
    initializeElements() {
        this.elements = {
            // Stats elements
            statsSection: document.getElementById('stats-section'),
            statsLoading: document.getElementById('stats-loading'),
            statsContainer: document.getElementById('stats-container'),
            statsInfo: document.getElementById('stats-info'),
            yearSelect: document.getElementById('year-select'),
            weekSelect: document.getElementById('week-select'),
            positionSelect: document.getElementById('position-select'),
            statsCount: document.getElementById('stats-count'),
            cacheInfo: document.getElementById('cache-info'),
            
            // Pagination elements
            paginationContainer: document.getElementById('pagination-container'),
            prevPageBtn: document.getElementById('prev-page-btn'),
            nextPageBtn: document.getElementById('next-page-btn'),
            pageInfo: document.getElementById('page-info'),
            
            // Action buttons
            refreshStatsBtn: document.getElementById('refresh-stats-btn'),
            clearCacheBtn: document.getElementById('clear-cache-btn'),
            exportStatsBtn: document.getElementById('export-stats-btn'),
            
            // Messages
            error: document.getElementById('error'),
            success: document.getElementById('success'),
            
            // Debug
            debugInfo: document.getElementById('debug-info'),
            debugContent: document.getElementById('debug-content')
        };
        
        console.log('🎯 UI elements initialized');
    }
    
    bindEvents() {
        console.log('🔗 Binding events...');
        
        // Filter change events
        if (this.elements.yearSelect) {
            this.elements.yearSelect.addEventListener('change', (e) => {
                console.log(`📅 Year changed to: ${e.target.value}`);
                this.currentYear = e.target.value;
                this.currentPage = 1;
                this.loadStatsData();
            });
        }
        
        if (this.elements.weekSelect) {
            this.elements.weekSelect.addEventListener('change', (e) => {
                console.log(`📅 Week changed to: ${e.target.value}`);
                this.currentWeek = e.target.value;
                this.currentPage = 1;
                this.loadStatsData();
            });
        }
        
        if (this.elements.positionSelect) {
            this.elements.positionSelect.addEventListener('change', (e) => {
                console.log(`🏈 Position changed to: ${e.target.value}`);
                this.currentPosition = e.target.value;
                this.currentPage = 1;
                this.loadStatsData();
            });
        }

        // Pagination events
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    console.log(`⬅️ Previous page: ${this.currentPage - 1}`);
                    this.currentPage--;
                    this.loadStatsData();
                }
            });
        }

        if (this.elements.nextPageBtn.addEventListener('click', () => {
               if (this.pagination && this.currentPage < this.pagination.totalPages) {
                   console.log(`➡️ Next page: ${this.currentPage + 1}`);
                   this.currentPage++;
                   this.loadStatsData();
               }
           });
       }

       // Action button events
       if (this.elements.refreshStatsBtn) {
           this.elements.refreshStatsBtn.addEventListener('click', () => {
               console.log('🔄 Manual refresh requested');
               this.loadStatsData(true);
           });
       }

       if (this.elements.clearCacheBtn) {
           this.elements.clearCacheBtn.addEventListener('click', () => {
               console.log('🗑️ Clear cache requested');
               this.clearStatsCache();
           });
       }

       if (this.elements.exportStatsBtn) {
           this.elements.exportStatsBtn.addEventListener('click', () => {
               console.log('📥 Export CSV requested');
               this.exportStatsAsCSV();
           });
       }

       // Keyboard shortcuts
       document.addEventListener('keydown', (e) => {
           if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
               e.preventDefault();
               this.loadStatsData(true);
           }
           if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
               e.preventDefault();
               this.clearStatsCache();
           }
       });

       console.log('✅ All events bound successfully');
   }
   
   async loadStatsData(forceRefresh = false) {
       if (this.isStatsLoading) {
           console.log('⚠️ Already loading stats, skipping request');
           return;
       }
       
       this.isStatsLoading = true;
       this.showStatsLoading();
       
       const loadStart = Date.now();
       console.log(`🔄 Loading stats: ${this.currentYear}/${this.currentWeek}/${this.currentPosition} - Page ${this.currentPage}`);
       
       this.updateDebugInfo(`Loading: ${this.currentYear}/${this.currentWeek}/${this.currentPosition} - Page ${this.currentPage}`);
       
       try {
           const result = await window.statsAPI.getStats(
               this.currentYear, 
               this.currentWeek, 
               this.currentPosition, 
               this.currentPage,
               this.pageSize,
               forceRefresh
           );
           
           this.statsData = result.data || [];
           this.pagination = result.pagination || null;
           
           const loadTime = Date.now() - loadStart;
           console.log(`✅ Stats loaded successfully in ${loadTime}ms - ${this.statsData.length} players`);
           
           this.renderStatsData();
           this.updateStatsCount();
           this.updatePagination();
           this.updateCacheInfo();
           this.updateDebugInfo(`Loaded ${this.statsData.length} players in ${loadTime}ms`);
           
           // Always show the stats section
           if (this.elements.statsSection) {
               this.elements.statsSection.classList.remove('hidden');
           }
           
       } catch (error) {
           console.error('❌ Error loading stats data:', error);
           this.showError(`Failed to load stats: ${error.message}`);
           this.updateDebugInfo(`Error: ${error.message}`);
       } finally {
           this.isStatsLoading = false;
           this.hideStatsLoading();
       }
   }

   renderStatsData() {
       if (!this.elements.statsContainer || !this.statsData) return;
       
       console.log(`🎨 Rendering ${this.statsData.length} players`);
       
       if (this.statsData.length === 0) {
           this.elements.statsContainer.innerHTML = `
               <div class="no-stats">
                   <h3>📭 No Stats Found</h3>
                   <p>No statistics available for ${this.currentYear} ${this.currentWeek} ${this.currentPosition}</p>
                   <p>Try adjusting your filters or check the backend connection.</p>
               </div>
           `;
           return;
       }
       
       // Create stats table
       const tableHtml = `
           <div class="stats-table-container">
               <table class="stats-table">
                   <thead>
                       <tr>
                           <th>👤 Player</th>
                           <th>🏈 Pos</th>
                           <th>🏟️ Team</th>
                           <th>📊 Key Statistics</th>
                       </tr>
                   </thead>
                   <tbody>
                       ${this.statsData.map((player, index) => this.createPlayerRow(player, index)).join('')}
                   </tbody>
               </table>
           </div>
       `;
       
       this.elements.statsContainer.innerHTML = tableHtml;
   }
   
   createPlayerRow(player, index) {
       const statsPreview = this.formatStatsPreview(player.stats);
       
       return `
           <tr class="player-row" data-player-key="${player.playerKey}" data-index="${index}">
               <td class="player-name">${player.playerName || 'Unknown Player'}</td>
               <td class="player-position">${player.position || '-'}</td>
               <td class="player-team">${player.team || '-'}</td>
               <td class="player-stats">${statsPreview}</td>
           </tr>
       `;
   }
   
   formatStatsPreview(stats) {
       if (!stats || typeof stats !== 'object') return 'No statistics available';
       
       const keyStats = [];
       
       // COMPLETE Yahoo Fantasy Football stat mappings
       if (stats['0']) keyStats.push(`🎮 GP: ${stats['0']}`);
       if (stats['1']) keyStats.push(`🎯 GS: ${stats['1']}`);
       if (stats['2']) keyStats.push(`🏈 Pass Att: ${stats['2']}`);
       if (stats['3']) keyStats.push(`✅ Pass Comp: ${stats['3']}`);
       if (stats['4']) keyStats.push(`📏 Pass Yds: ${stats['4']}`);
       if (stats['5']) keyStats.push(`🎯 Pass TD: ${stats['5']}`);
       if (stats['6']) keyStats.push(`❌ Pass INT: ${stats['6']}`);
       if (stats['7']) keyStats.push(`💯 Pass 2PT: ${stats['7']}`);
       if (stats['8']) keyStats.push(`🏃 Rush Att: ${stats['8']}`);
       if (stats['9']) keyStats.push(`📏 Rush Yds: ${stats['9']}`);
       if (stats['10']) keyStats.push(`🎯 Rush TD: ${stats['10']}`);
       if (stats['11']) keyStats.push(`🤲 Rec: ${stats['11']}`);
       if (stats['12']) keyStats.push(`📏 Rec Yds: ${stats['12']}`);
       if (stats['13']) keyStats.push(`🎯 Rec TD: ${stats['13']}`);
       if (stats['14']) keyStats.push(`⚡ Ret TD: ${stats['14']}`);
       if (stats['15']) keyStats.push(`💯 Rush 2PT: ${stats['15']}`);
       if (stats['16']) keyStats.push(`💯 Rec 2PT: ${stats['16']}`);
       if (stats['17']) keyStats.push(`💀 Fum Lost: ${stats['17']}`);
       if (stats['18']) keyStats.push(`🏈 Fum: ${stats['18']}`);
       if (stats['57']) keyStats.push(`🚀 40+ Pass: ${stats['57']}`);
       if (stats['58']) keyStats.push(`🚀 50+ Pass: ${stats['58']}`);
       if (stats['59']) keyStats.push(`🚀 40+ Rush: ${stats['59']}`);
       if (stats['60']) keyStats.push(`🚀 50+ Rush: ${stats['60']}`);
       if (stats['61']) keyStats.push(`🚀 40+ Rec: ${stats['61']}`);
       if (stats['62']) keyStats.push(`🚀 50+ Rec: ${stats['62']}`);
       if (stats['63']) keyStats.push(`💯 Rush 2PT Conv: ${stats['63']}`);
       if (stats['64']) keyStats.push(`💯 Pass 2PT Conv: ${stats['64']}`);
       if (stats['78']) keyStats.push(`⭐ Fantasy Pts: ${stats['78']}`);
       if (stats['79']) keyStats.push(`💺 Bench Pts: ${stats['79']}`);
       if (stats['80']) keyStats.push(`🏥 IR Pts: ${stats['80']}`);
       if (stats['81']) keyStats.push(`🎯 Act Pts: ${stats['81']}`);
       
       return keyStats.length > 0 ? keyStats.slice(0, 6).join(' • ') : 'Various statistics available';
   }
   
   updateStatsCount() {
       if (this.elements.statsCount && this.pagination) {
           const { page, totalRecords, limit } = this.pagination;
           const startRecord = (page - 1) * limit + 1;
           const endRecord = Math.min(page * limit, totalRecords);
           
           this.elements.statsCount.textContent = 
               `📊 Showing ${startRecord}-${endRecord} of ${totalRecords} players • ${this.currentYear} ${this.currentWeek} • ${this.currentPosition}`;
       } else if (this.elements.statsCount) {
           this.elements.statsCount.textContent = 
               `📊 Showing ${this.statsData.length} players • ${this.currentYear} ${this.currentWeek} • ${this.currentPosition}`;
       }
   }

   updatePagination() {
       if (!this.pagination) {
           if (this.elements.paginationContainer) {
               this.elements.paginationContainer.classList.add('hidden');
           }
           return;
       }

       const { page, totalPages, hasNext, hasPrev } = this.pagination;

       // Update pagination buttons
       if (this.elements.prevPageBtn) {
           this.elements.prevPageBtn.disabled = !hasPrev;
       }
       
       if (this.elements.nextPageBtn) {
           this.elements.nextPageBtn.disabled = !hasNext;
       }

       // Update page info
       if (this.elements.pageInfo) {
           this.elements.pageInfo.textContent = `Page ${page} of ${totalPages}`;
       }

       // Show pagination container
       if (this.elements.paginationContainer) {
           this.elements.paginationContainer.classList.remove('hidden');
       }

       console.log(`📄 Pagination updated: Page ${page} of ${totalPages}`);
   }
   
   async updateCacheInfo() {
       if (this.elements.cacheInfo) {
           try {
               const cacheInfo = window.statsAPI.getCacheInfo();
               const storageInfo = await window.statsDB.getStorageInfo();
               
               this.elements.cacheInfo.innerHTML = `
                   💾 Cache: ${cacheInfo.memoryCacheSize} in memory, 
                   ${storageInfo.statsRecords} in IndexedDB
               `;
           } catch (error) {
               console.error('Error updating cache info:', error);
               this.elements.cacheInfo.textContent = '💾 Cache: Error loading info';
           }
       }
   }
   
   showStatsLoading() {
       if (this.elements.statsLoading) {
           this.elements.statsLoading.classList.remove('hidden');
       }
   }
   
   hideStatsLoading() {
       if (this.elements.statsLoading) {
           this.elements.statsLoading.classList.add('hidden');
       }
   }

   async clearStatsCache() {
       try {
           console.log('🗑️ Clearing stats cache...');
           
           if (window.statsAPI) {
               window.statsAPI.clearCache();
           }
           
           if (window.statsDB) {
               const key = window.statsDB.generateLoadKey(
                   this.currentYear, 
                   this.currentWeek, 
                   this.currentPosition, 
                   this.currentPage
               );
               window.statsDB.loadTracker.delete(key);
               localStorage.removeItem(`loaded_${key}`);
           }
           
           this.showSuccess('🗑️ Stats cache cleared successfully');
           this.updateDebugInfo('Cache cleared, reloading...');
           
           // Force refresh
           await this.loadStatsData(true);
           
       } catch (error) {
           console.error('❌ Error clearing cache:', error);
           this.showError('Failed to clear cache');
       }
   }

   exportStatsAsCSV() {
       if (!this.statsData || this.statsData.length === 0) {
           this.showError('📭 No stats data to export');
           return;
       }

       try {
           console.log(`📥 Exporting ${this.statsData.length} records to CSV...`);
           
           // Create CSV headers
           const headers = ['Player Name', 'Position', 'Team', 'Player Key'];
           
           // Add stat headers
           const sampleStats = this.statsData[0]?.stats || {};
           const statKeys = Object.keys(sampleStats).sort((a, b) => parseInt(a) - parseInt(b));
           headers.push(...statKeys.map(key => `Stat_${key}`));

           // Create CSV rows
           const csvRows = [headers.join(',')];
           
           this.statsData.forEach(player => {
               const row = [
                   `"${player.playerName || ''}"`,
                   `"${player.position || ''}"`,
                   `"${player.team || ''}"`,
                   `"${player.playerKey || ''}"`
               ];

               // Add stat values
               statKeys.forEach(key => {
                   row.push(player.stats?.[key] || '0');
               });

               csvRows.push(row.join(','));
           });

           // Create and download CSV file
           const csvContent = csvRows.join('\n');
           const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
           const link = document.createElement('a');
           
           if (link.download !== undefined) {
               const url = URL.createObjectURL(blob);
               link.setAttribute('href', url);
               link.setAttribute('download', 
                   `fantasy-stats-${this.currentYear}-${this.currentWeek}-${this.currentPosition}-page${this.currentPage}.csv`
               );
               link.style.visibility = 'hidden';
               document.body.appendChild(link);
               link.click();
               document.body.removeChild(link);
               URL.revokeObjectURL(url);
           }

           this.showSuccess(`📥 Exported ${this.statsData.length} player stats to CSV`);
           console.log('✅ CSV export completed successfully');

       } catch (error) {
           console.error('❌ Error exporting CSV:', error);
           this.showError('Failed to export stats data');
       }
   }
   
   showError(message) {
       if (this.elements.error) {
           this.elements.error.textContent = message;
           this.elements.error.className = 'error';
           this.elements.error.classList.remove('hidden');
       }
       if (this.elements.success) {
           this.elements.success.classList.add('hidden');
       }
       console.error('❌ Error:', message);
   }
   
   showSuccess(message) {
       if (this.elements.success) {
           this.elements.success.textContent = message;
           this.elements.success.className = 'success';
           this.elements.success.classList.remove('hidden');
       }
       if (this.elements.error) {
           this.elements.error.classList.add('hidden');
       }
       console.log('✅ Success:', message);
       
       // Auto-hide success messages after 3 seconds
       setTimeout(() => {
           if (this.elements.success) {
               this.elements.success.classList.add('hidden');
           }
       }, 3000);
   }
   
   updateDebugInfo(message) {
       if (this.elements.debugContent) {
           this.elements.debugContent.textContent = message;
           
           if (this.elements.debugInfo) {
               this.elements.debugInfo.classList.remove('hidden');
           }
       }
       
       // Auto-hide debug after 5 seconds
       setTimeout(() => {
           if (this.elements.debugInfo) {
               this.elements.debugInfo.classList.add('hidden');
           }
       }, 5000);
   }

   async getDetailedCacheStats() {
       const memoryInfo = window.statsAPI ? window.statsAPI.getCacheInfo() : { memoryCacheSize: 0 };
       const storageInfo = window.statsDB ? await window.statsDB.getStorageInfo() : { statsRecords: 0 };

       return {
           memory: memoryInfo,
           indexedDB: storageInfo,
           currentState: {
               year: this.currentYear,
               week: this.currentWeek,
               position: this.currentPosition,
               page: this.currentPage,
               dataCount: this.statsData.length
           }
       };
   }

   async logCacheDebugInfo() {
       const stats = await this.getDetailedCacheStats();
       console.group('🔍 Fantasy Dashboard Debug Info');
       console.log('Memory Cache:', stats.memory);
       console.log('IndexedDB Cache:', stats.indexedDB);
       console.log('Current State:', stats.currentState);
       console.log('Pagination:', this.pagination);
       console.groupEnd();
   }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
   console.log('🚀 DOM loaded, initializing Fantasy Dashboard...');
   
   const dashboard = new FantasyDashboard();
   
   // Make dashboard available globally for debugging
   window.fantasyDashboard = dashboard;
   
   // Global debug functions
   window.debugCache = () => dashboard.logCacheDebugInfo();
   window.clearCache = () => dashboard.clearStatsCache();
   window.exportStats = () => dashboard.exportStatsAsCSV();
   window.reloadStats = () => dashboard.loadStatsData(true);
   
   console.log('🏈 Fantasy Dashboard initialized successfully!');
   console.log('📊 Stats will load automatically on initialization...');
   console.log('🔧 Available debug commands:');
   console.log('  - window.debugCache() - Show detailed cache information');
   console.log('  - window.clearCache() - Clear current stats cache');
   console.log('  - window.exportStats() - Export current stats as CSV');
   console.log('  - window.reloadStats() - Force reload stats data');
   console.log('  - Ctrl/Cmd + R - Refresh stats data');
   console.log('  - Ctrl/Cmd + Shift + C - Clear cache');
});
