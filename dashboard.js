// IndexedDB Manager
class StatsIndexedDB {
    constructor() {
        this.dbName = 'FantasyStatsDB';
        this.version = 1;
        this.db = null;
        this.loadTracker = new Map(); // In-memory tracker for loaded data
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadStoredTracker();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stats store
                if (!db.objectStoreNames.contains('stats')) {
                    const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
                    statsStore.createIndex('year', 'year', { unique: false });
                    statsStore.createIndex('week', 'week', { unique: false });
                    statsStore.createIndex('position', 'position', { unique: false });
                    statsStore.createIndex('playerKey', 'playerKey', { unique: false });
                }

                // Create metadata store for tracking loaded data
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    // Generate unique key for tracking loaded data
    generateLoadKey(year, week, position = 'ALL') {
        return `${year}_${week}_${position}`;
    }

    // Check if data is already loaded
    isDataLoaded(year, week, position = 'ALL') {
        const key = this.generateLoadKey(year, week, position);
        return this.loadTracker.has(key) || localStorage.getItem(`loaded_${key}`) === 'true';
    }

    // Mark data as loaded
    markAsLoaded(year, week, position = 'ALL') {
        const key = this.generateLoadKey(year, week, position);
        this.loadTracker.set(key, true);
        localStorage.setItem(`loaded_${key}`, 'true');
        
        // Also store in IndexedDB metadata
        this.storeMetadata(key, {
            year,
            week, 
            position,
            loadedAt: new Date().toISOString()
        });
    }

    // Store metadata in IndexedDB
    async storeMetadata(key, data) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        
        await store.put({ key, ...data });
    }

    // Load stored tracker from localStorage
    loadStoredTracker() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('loaded_') && localStorage.getItem(key) === 'true') {
                const loadKey = key.replace('loaded_', '');
                this.loadTracker.set(loadKey, true);
            }
        }
    }

    // Store stats data in IndexedDB
    async storeStats(statsArray, year, week, position = 'ALL') {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readwrite');
        const store = transaction.objectStore('stats');

        // Store each player's stats with metadata
        for (const player of statsArray) {
            const record = {
                id: `${player.playerKey}_${year}_${week}`,
                playerKey: player.playerKey,
                playerName: player.playerName,
                position: player.position,
                year: year,
                week: week,
                stats: player.stats,
                storedAt: new Date().toISOString()
            };

            await store.put(record);
        }

        // Mark as loaded
        this.markAsLoaded(year, week, position);
    }

    // Retrieve stats from IndexedDB
    async getStats(year, week, position = 'ALL') {
        if (!this.db) await this.init();

        const transaction = this.db.transaction(['stats'], 'readonly');
        const store = transaction.objectStore('stats');

        let results = [];

        if (position === 'ALL') {
            // Get all records for year/week
            const yearIndex = store.index('year');
            const request = yearIndex.getAll(year);
            
            const allRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = allRecords.filter(record => record.week === week);
        } else {
            // Get records for specific position
            const positionIndex = store.index('position');
            const request = positionIndex.getAll(position);
            
            const positionRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = positionRecords.filter(record => 
                record.year === year && record.week === week
            );
        }

        return results;
    }

    // Get storage info for debugging
    async getStorageInfo() {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['stats', 'metadata'], 'readonly');
        const statsStore = transaction.objectStore('stats');
        const metadataStore = transaction.objectStore('metadata');

        const statsCount = await new Promise((resolve) => {
            const request = statsStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        const metadataCount = await new Promise((resolve) => {
            const request = metadataStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        return {
            statsRecords: statsCount,
            metadataRecords: metadataCount,
            loadedKeys: Array.from(this.loadTracker.keys()),
            localStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('loaded_'))
        };
    }
}
// Updated Stats API Client with URL parameters and pagination
class StatsAPIClient {
    constructor() {
        this.baseUrl = '/data/stats';
        this.cache = new Map();
    }

    async getStats(year = '2024', week = 'total', position = 'ALL', page = 1, limit = 50, forceRefresh = false) {
        const cacheKey = `${year}_${week}_${position}_${page}_${limit}`;
        
        // Check in-memory cache first (fastest)
        if (!forceRefresh && this.cache.has(cacheKey)) {
            console.log(`📦 Serving from memory cache: ${cacheKey}`);
            return this.cache.get(cacheKey);
        }

        // Check if data is already loaded in IndexedDB
        if (!forceRefresh && window.statsDB && window.statsDB.isDataLoaded(year, week, position, page)) {
            console.log(`📦 Serving from IndexedDB: ${cacheKey}`);
            const data = await window.statsDB.getStats(year, week, position, page);
            this.cache.set(cacheKey, data);
            return data;
        }

        // Fetch from backend using URL parameters
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

            // Store in IndexedDB
            if (window.statsDB) {
                await window.statsDB.storeStats(result.data, year, week, position, page);
            }

            // Store in memory cache
            this.cache.set(cacheKey, result);

            console.log(`✅ Fetched and cached ${result.data.length} records for ${cacheKey}`);
            return result;

        } catch (error) {
            console.error('Error fetching stats:', error);
            throw error;
        }
    }

    // Clear cache
    clearCache(year = null, week = null, position = null) {
        if (year || week || position) {
            const pattern = `${year || '[^_]+'}_${week || '[^_]+'}_${position || '[^_]+'}`;
            const regex = new RegExp(pattern);
            
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    getCacheInfo() {
        return {
            memoryCacheSize: this.cache.size,
            memoryCacheKeys: Array.from(this.cache.keys())
        };
    }
}

// Updated IndexedDB Manager with pagination support
class StatsIndexedDB {
    constructor() {
        this.dbName = 'FantasyStatsDB';
        this.version = 1;
        this.db = null;
        this.loadTracker = new Map();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.loadStoredTracker();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('stats')) {
                    const statsStore = db.createObjectStore('stats', { keyPath: 'id' });
                    statsStore.createIndex('year', 'year', { unique: false });
                    statsStore.createIndex('week', 'week', { unique: false });
                    statsStore.createIndex('position', 'position', { unique: false });
                    statsStore.createIndex('playerKey', 'playerKey', { unique: false });
                    statsStore.createIndex('page', 'page', { unique: false });
                }

                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
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
        
        this.storeMetadata(key, {
            year, week, position, page,
            loadedAt: new Date().toISOString()
        });
    }

    async storeMetadata(key, data) {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        
        await store.put({ key, ...data });
    }

    loadStoredTracker() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('loaded_') && localStorage.getItem(key) === 'true') {
                const loadKey = key.replace('loaded_', '');
                this.loadTracker.set(loadKey, true);
            }
        }
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

        let results = [];

        if (position === 'ALL') {
            const yearIndex = store.index('year');
            const request = yearIndex.getAll(year);
            
            const allRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = allRecords.filter(record => 
                record.week === week && record.page === page
            );
        } else {
            const positionIndex = store.index('position');
            const request = positionIndex.getAll(position);
            
            const positionRecords = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });

            results = positionRecords.filter(record => 
                record.year === year && record.week === week && record.page === page
            );
        }

        return results;
    }

    async getStorageInfo() {
        if (!this.db) await this.init();
        
        const transaction = this.db.transaction(['stats', 'metadata'], 'readonly');
        const statsStore = transaction.objectStore('stats');
        const metadataStore = transaction.objectStore('metadata');

        const statsCount = await new Promise((resolve) => {
            const request = statsStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        const metadataCount = await new Promise((resolve) => {
            const request = metadataStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        return {
            statsRecords: statsCount,
            metadataRecords: metadataCount,
            loadedKeys: Array.from(this.loadTracker.keys()),
            localStorageKeys: Object.keys(localStorage).filter(k => k.startsWith('loaded_'))
        };
    }
}

// Updated Main Fantasy Dashboard Class with Auto-Load
class FantasyDashboard {
    constructor() {
        this.leagues = [];
        this.selectedLeagues = new Set();
        this.isLoading = false;
        this.isSubmitting = false;
        
        // Stats-related properties with pagination
        this.currentYear = '2024';
        this.currentWeek = 'total';
        this.currentPosition = 'ALL';
        this.currentPage = 1;
        this.pageSize = 50;
        this.statsData = [];
        this.pagination = null;
        this.isStatsLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeStats();
    }
    
    async initializeStats() {
        try {
            // Initialize IndexedDB
            window.statsDB = new StatsIndexedDB();
            await window.statsDB.init();
            console.log('✅ IndexedDB initialized');
            
            // Initialize API client
            window.statsAPI = new StatsAPIClient();
            
            // Populate the select dropdowns first
            await this.populateStatsSelects();
            
            // Load initial stats data automatically
            console.log('🚀 Loading initial stats data...');
            await this.loadStatsData();
            
        } catch (error) {
            console.error('Error initializing stats:', error);
            this.showError('Failed to initialize stats database');
        }
    }
    
    initializeElements() {
        this.elements = {
            // Existing elements
            welcomeSection: document.getElementById('welcome-section'),
            importDataBtn: document.getElementById('import-data-btn'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            success: document.getElementById('success'),
            leaguesSection: document.getElementById('leagues-section'),
            leaguesContainer: document.getElementById('leagues-container'),
            submitSection: document.getElementById('submit-section'),
            selectedCount: document.getElementById('selected-count'),
            noLeagues: document.getElementById('no-leagues'),
            submitBtn: document.getElementById('submit-btn'),
            retryBtn: document.getElementById('retry-btn'),
            importResultsSection: document.getElementById('import-results-section'),
            importResultsContainer: document.getElementById('import-results-container'),
            
            // Stats elements
            statsSection: document.getElementById('stats-section'),
            statsLoading: document.getElementById('stats-loading'),
            statsContainer: document.getElementById('stats-container'),
            yearSelect: document.getElementById('year-select'),
            weekSelect: document.getElementById('week-select'),
            positionSelect: document.getElementById('position-select'),
            statsCount: document.getElementById('stats-count'),
            cacheInfo: document.getElementById('cache-info'),
            
            // Pagination elements
            paginationContainer: document.getElementById('pagination-container'),
            prevPageBtn: document.getElementById('prev-page-btn'),
            nextPageBtn: document.getElementById('next-page-btn'),
            pageInfo: document.getElementById('page-info')
        };
    }
    
    bindEvents() {
        // Existing events
        if (this.elements.importDataBtn) {
            this.elements.importDataBtn.addEventListener('click', () => this.loadLeagues());
        }
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => this.loadLeagues());
        }
        if (this.elements.submitBtn) {
            this.elements.submitBtn.addEventListener('click', () => {
                console.log('Submit button clicked!');
                this.submitSelectedLeagues();
            });
        }
        
        // Stats events
        if (this.elements.yearSelect) {
            this.elements.yearSelect.addEventListener('change', (e) => {
                this.currentYear = e.target.value;
                this.currentPage = 1; // Reset to page 1
                this.loadStatsData();
            });
        }
        
        if (this.elements.weekSelect) {
            this.elements.weekSelect.addEventListener('change', (e) => {
                this.currentWeek = e.target.value;
                this.currentPage = 1; // Reset to page 1
                this.loadStatsData();
            });
        }
        
        if (this.elements.positionSelect) {
            this.elements.positionSelect.addEventListener('change', (e) => {
                this.currentPosition = e.target.value;
                this.currentPage = 1; // Reset to page 1
                this.loadStatsData();
            });
        }

        // Pagination events
        if (this.elements.prevPageBtn) {
            this.elements.prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadStatsData();
                }
            });
        }

        if (this.elements.nextPageBtn) {
            this.elements.nextPageBtn.addEventListener('click', () => {
                if (this.pagination && this.currentPage < this.pagination.totalPages) {
                    this.currentPage++;
                    this.loadStatsData();
                }
            });
        }
    }
    
    async loadStatsData(forceRefresh = false) {
        if (this.isStatsLoading) return;
        
        this.isStatsLoading = true;
        this.showStatsLoading();
        
        try {
            console.log(`Loading stats: ${this.currentYear}/${this.currentWeek}/${this.currentPosition} - Page ${this.currentPage}`);
            
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
            
            this.renderStatsData();
            this.updateStatsCount();
            this.updatePagination();
            this.updateCacheInfo();
            
            // Show the stats section automatically
            this.elements.statsSection.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading stats data:', error);
            this.showError(`Failed to load stats: ${error.message}`);
        } finally {
            this.isStatsLoading = false;
            this.hideStatsLoading();
// Main Fantasy Dashboard Class
class FantasyDashboard {
    constructor() {
        this.leagues = [];
        this.selectedLeagues = new Set();
        this.isLoading = false;
        this.isSubmitting = false;
        
        // Stats-related properties
        this.currentYear = '2024';
        this.currentWeek = 'total';
        this.currentPosition = 'ALL';
        this.statsData = [];
        this.isStatsLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeStats();
    }
    
    async initializeStats() {
        try {
            // Initialize IndexedDB
            window.statsDB = new StatsIndexedDB();
            await window.statsDB.init();
            console.log('✅ IndexedDB initialized');
            
            // Initialize API client
            window.statsAPI = new StatsAPIClient();
            
            // Load initial stats data
            await this.loadStatsData();
            
        } catch (error) {
            console.error('Error initializing stats:', error);
            this.showError('Failed to initialize stats database');
        }
    }
    
    initializeElements() {
        this.elements = {
            // Existing elements
            welcomeSection: document.getElementById('welcome-section'),
            importDataBtn: document.getElementById('import-data-btn'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            success: document.getElementById('success'),
            leaguesSection: document.getElementById('leagues-section'),
            leaguesContainer: document.getElementById('leagues-container'),
            submitSection: document.getElementById('submit-section'),
            selectedCount: document.getElementById('selected-count'),
            noLeagues: document.getElementById('no-leagues'),
            submitBtn: document.getElementById('submit-btn'),
            retryBtn: document.getElementById('retry-btn'),
            importResultsSection: document.getElementById('import-results-section'),
            importResultsContainer: document.getElementById('import-results-container'),
            
            // New stats elements
            statsSection: document.getElementById('stats-section'),
            statsLoading: document.getElementById('stats-loading'),
            statsContainer: document.getElementById('stats-container'),
            yearSelect: document.getElementById('year-select'),
            weekSelect: document.getElementById('week-select'),
            positionSelect: document.getElementById('position-select'),
            statsCount: document.getElementById('stats-count'),
            cacheInfo: document.getElementById('cache-info')
        };
    }
    
    bindEvents() {
        // Existing events
        if (this.elements.importDataBtn) {
            this.elements.importDataBtn.addEventListener('click', () => this.loadLeagues());
        }
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => this.loadLeagues());
        }
        
        // Bind submit button event
        if (this.elements.submitBtn) {
            this.elements.submitBtn.addEventListener('click', () => {
                console.log('Submit button clicked!');
                this.submitSelectedLeagues();
            });
        }
        
        // New stats events
        if (this.elements.yearSelect) {
            this.elements.yearSelect.addEventListener('change', (e) => {
                this.currentYear = e.target.value;
                this.loadStatsData();
            });
        }
        
        if (this.elements.weekSelect) {
            this.elements.weekSelect.addEventListener('change', (e) => {
                this.currentWeek = e.target.value;
                this.loadStatsData();
            });
        }
        
        if (this.elements.positionSelect) {
            this.elements.positionSelect.addEventListener('change', (e) => {
                this.currentPosition = e.target.value;
                this.loadStatsData();
            });
        }
    }
    
    async loadStatsData(forceRefresh = false) {
        if (this.isStatsLoading) return;
        
        this.isStatsLoading = true;
        this.showStatsLoading();
        
        try {
            console.log(`Loading stats: ${this.currentYear}/${this.currentWeek}/${this.currentPosition}`);
            
            const data = await window.statsAPI.getStats(
                this.currentYear, 
                this.currentWeek, 
                this.currentPosition, 
                forceRefresh
            );
            
            this.statsData = data;
            this.renderStatsData();
            this.updateStatsCount();
            this.updateCacheInfo();
            
        } catch (error) {
            console.error('Error loading stats data:', error);
            this.showError(`Failed to load stats: ${error.message}`);
        } finally {
            this.isStatsLoading = false;
            this.hideStatsLoading();
        }
    }
    
    renderStatsData() {
        if (!this.elements.statsContainer || !this.statsData) return;
        
        if (this.statsData.length === 0) {
            this.elements.statsContainer.innerHTML = `
                <div class="no-stats">
                    <h3>No Stats Found</h3>
                    <p>No stats available for ${this.currentYear} ${this.currentWeek} ${this.currentPosition}</p>
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
                            <th>Player</th>
                            <th>Position</th>
                            <th>Team</th>
                            <th>Key Stats</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.statsData.map(player => this.createPlayerRow(player)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        this.elements.statsContainer.innerHTML = tableHtml;
        this.elements.statsSection.classList.remove('hidden');
    }
    
    createPlayerRow(player) {
        const statsPreview = this.formatStatsPreview(player.stats);
        
        return `
            <tr class="player-row" data-player-key="${player.playerKey}">
                <td class="player-name">${player.playerName || 'Unknown'}</td>
                <td class="player-position">${player.position || ''}</td>
                <td class="player-team">${this.getPlayerTeam(player) || ''}</td>
                <td class="player-stats">${statsPreview}</td>
            </tr>
        `;
    }
    
    formatStatsPreview(stats) {
        if (!stats || typeof stats !== 'object') return 'No stats';
        
        // Show key fantasy stats based on common Yahoo stat IDs
        const keyStats = [];
        
        // Common stat mappings (based on the provided JSON example)
        if (stats['0']) keyStats.push(`GP: ${stats['0']}`);
        if (stats['8']) keyStats.push(`Att: ${stats['8']}`);
        if (stats['9']) keyStats.push(`Rush Yds: ${stats['9']}`);
        if (stats['11']) keyStats.push(`Rec: ${stats['11']}`);
        if (stats['12']) keyStats.push(`Rec Yds: ${stats['12']}`);
        if (stats['13']) keyStats.push(`TD: ${stats['13']}`);
        if (stats['78']) keyStats.push(`Fantasy Pts: ${stats['78']}`);
        
        return keyStats.length > 0 ? keyStats.slice(0, 4).join(', ') : 'Various stats available';
    }
    
    getPlayerTeam(player) {
        // Extract team from player data or stats
        return player.team || '';
    }
    
    updateStatsCount() {
        if (this.elements.statsCount) {
            const count = this.statsData.length;
            this.elements.statsCount.textContent = 
                `${count} player${count === 1 ? '' : 's'} • ${this.currentYear} ${this.currentWeek} • ${this.currentPosition}`;
        }
    }
    
    async updateCacheInfo() {
        if (this.elements.cacheInfo) {
            try {
                const cacheInfo = window.statsAPI.getCacheInfo();
                const storageInfo = await window.statsDB.getStorageInfo();
                
                this.elements.cacheInfo.innerHTML = `
                    <small>
                        Cache: ${cacheInfo.memoryCacheSize} in memory, 
                        ${storageInfo.statsRecords} in IndexedDB
                    </small>
                `;
            } catch (error) {
                console.error('Error updating cache info:', error);
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

    // Existing methods below - unchanged
    async loadLeagues() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        this.clearMessages();
        this.hideImportResults();
        
        try {
            const response = await fetch('/data/fantasy/leagues', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    const errorData = await response.json().catch(() => ({}));
                    
                    if (errorData.needsAuth || errorData.needsReauth) {
                        this.showAuthError('Yahoo authentication required. Redirecting to login...');
                        setTimeout(() => {
                            window.location.href = errorData.redirectUrl || '/yahoo/yauth.html';
                        }, 2000);
                        return;
                    }
                    
                    window.location.href = '/login';
                    return;
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.leagues = data.leagues || [];
            
            if (this.leagues.length === 0) {
                this.showNoLeagues();
            } else {
                this.renderLeagues();
                this.showSuccess(`Found ${this.leagues.length} fantasy league${this.leagues.length === 1 ? '' : 's'}!`);
            }
            
        } catch (error) {
            console.error('Error loading leagues:', error);
            this.showError(`Failed to load leagues: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    async submitSelectedLeagues() {
        console.log('submitSelectedLeagues called!');
        console.log('Selected leagues:', Array.from(this.selectedLeagues));
        
        if (this.isSubmitting || this.selectedLeagues.size === 0) {
            console.log('Blocking submission - isSubmitting:', this.isSubmitting, 'selectedLeagues.size:', this.selectedLeagues.size);
            return;
        }
        
        this.isSubmitting = true;
        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.textContent = '⏳ Importing Data...';
        this.clearMessages();
        this.hideImportResults();
        
        try {
            const selectedLeagueIds = Array.from(this.selectedLeagues);
            console.log('Submitting leagues:', selectedLeagueIds);
            
            const response = await fetch('/data/fantasy/teams', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    leagueIds: selectedLeagueIds
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    const errorData = await response.json().catch(() => ({}));
                    
                    if (errorData.needsAuth || errorData.needsReauth) {
                        this.showAuthError('Yahoo authentication required. Redirecting to login...');
                        setTimeout(() => {
                            window.location.href = errorData.redirectUrl || '/yahoo/yauth.html';
                        }, 2000);
                        return;
                    }
                    
                    window.location.href = '/login';
                    return;
                }
                
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // STORE IN LOCALSTORAGE
            this.storeFantasyDataInLocalStorage(data);
            
            this.showSuccess(`Successfully imported ${data.importedCount || selectedLeagueIds.length} league${selectedLeagueIds.length === 1 ? '' : 's'} with teams and scoring data!`);
            
            this.displayImportResults(data);
            
            this.selectedLeagues.clear();
            this.updateSelectedCount();
            this.updateLeagueSelections();
            
        } catch (error) {
            console.error('Error submitting leagues:', error);
            this.showError(`Failed to submit leagues: ${error.message}`);
        } finally {
            this.isSubmitting = false;
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.textContent = '📤 Submit Selected Leagues';
        }
    }
    
    storeFantasyDataInLocalStorage(data) {
        try {
            // Get existing data or initialize
            let storedData = JSON.parse(localStorage.getItem('fantasyLeagueData') || '{}');
            
            // Initialize if needed
            if (!storedData.leagues) {
                storedData.leagues = {};
            }
            if (!storedData.lastUpdated) {
                storedData.lastUpdated = null;
            }
            
            // Process each result
            if (data.results && Array.isArray(data.results)) {
                data.results.forEach(result => {
                    if (result.success) {
                        // Store league data indexed by leagueId
                        storedData.leagues[result.leagueId] = {
                            leagueId: result.leagueId,
                            leagueName: result.leagueName,
                            teams: result.teams || [],
                            scoringSettings: result.scoringSettings || [],
                            teamsCount: result.teamsCount || 0,
                            importedAt: new Date().toISOString(),
                            airtableStatus: result.airtableStatus,
                            airtableRecordId: result.airtableRecordId
                        };
                    }
                });
            }
            
            // Update metadata
            storedData.lastUpdated = new Date().toISOString();
            storedData.totalLeagues = Object.keys(storedData.leagues).length;
            
            // Store in localStorage
            localStorage.setItem('fantasyLeagueData', JSON.stringify(storedData));
            
            console.log('✅ Fantasy data stored in localStorage:', storedData);
            
            // Also store a simplified version for quick access
            const simplifiedData = {
                leagueIds: Object.keys(storedData.leagues),
                leagueNames: Object.values(storedData.leagues).map(l => ({
                    id: l.leagueId,
                    name: l.leagueName
                })),
                lastUpdated: storedData.lastUpdated
            };
            localStorage.setItem('fantasyLeagueQuickAccess', JSON.stringify(simplifiedData));
            
        } catch (error) {
            console.error('Error storing data in localStorage:', error);
        }
    }
    
    displayImportResults(data) {
        if (!data.results || data.results.length === 0) return;
        
        this.elements.importResultsContainer.innerHTML = '';
        
        data.results.forEach(result => {
            if (result.success && result.teams) {
                const resultElement = this.createImportResultElement(result);
                this.elements.importResultsContainer.appendChild(resultElement);
            }
        });
        
        this.elements.importResultsSection.classList.remove('hidden');
    }
    
    createImportResultElement(result) {
        const div = document.createElement('div');
        div.className = 'imported-league';
        
        const teamsHtml = result.teams.map(team => `
            <div class="team-card ${team.isOwned ? 'owned' : ''}">
                <div class="team-name">${team.teamName}</div>
                ${team.isOwned ? '<div class="owned-badge">Your Team</div>' : ''}
            </div>
        `).join('');
        
        const scoringHtml = result.scoringSettings && result.scoringSettings.length > 0 ? `
            <div class="scoring-summary">
                <h5>📊 Scoring Settings</h5>
                <div class="scoring-details">
                    Found ${result.scoringSettings.length} scoring categories configured
                    <br>
                    <small>Sample rules: ${result.scoringSettings.slice(0, 3).map(s => `${s.name}: ${s.points}pts`).join(', ')}${result.scoringSettings.length > 3 ? '...' : ''}</small>
                </div>
            </div>
        ` : `
            <div class="scoring-summary">
                <h5>📊 Scoring Settings</h5>
                <div class="scoring-details">
                    No scoring data available
                </div>
            </div>
        `;
        
        div.innerHTML = `
            <h4>🏈 ${result.leagueName}</h4>
            <div class="teams-grid">
                ${teamsHtml}
            </div>
            ${scoringHtml}
        `;
        
        return div;
    }
    
    renderLeagues() {
        this.elements.leaguesContainer.innerHTML = '';
        
        this.leagues.forEach(league => {
            const leagueElement = this.createLeagueElement(league);
            this.elements.leaguesContainer.appendChild(leagueElement);
        });
        
        this.elements.leaguesSection.classList.remove('hidden');
        this.updateSelectedCount();
    }
    
    createLeagueElement(league) {
        const div = document.createElement('div');
        div.className = 'league-item';
        div.innerHTML = `
            <div class="league-header">
                <input type="checkbox" class="league-checkbox" data-league-id="${league.leagueId}">
                <div class="league-name">${league.leagueName}</div>
            </div>
            <div class="league-details">
                <div class="league-detail">
                    <strong>Season</strong>
                    <span>${league.season}</span>
                </div>
                <div class="league-detail">
                    <strong>Teams</strong>
                    <span>${league.numTeams}</span>
                </div>
                <div class="league-detail">
                    <strong>Scoring</strong>
                    <span>${league.scoringType}</span>
                </div>
                <div class="league-detail">
                    <strong>Type</strong>
                    <span>${league.leagueType}</span>
                </div>
                <div class="league-detail">
                    <strong>League ID</strong>
                    <span>${league.leagueId}</span>
                </div>
            </div>
        `;
        
        const checkbox = div.querySelector('.league-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectedLeagues.add(league.leagueId);
                div.classList.add('selected');
            } else {
                this.selectedLeagues.delete(league.leagueId);
                div.classList.remove('selected');
            }
            this.updateSelectedCount();
        });
        
        return div;
    }
    
    updateSelectedCount() {
        const count = this.selectedLeagues.size;
        this.elements.selectedCount.textContent = 
            count === 0 ? 'Select leagues to submit' : 
            `${count} league${count === 1 ? '' : 's'} selected`;
        
        if (count > 0) {
            this.elements.submitSection.classList.remove('hidden');
            
            // RE-BIND THE SUBMIT BUTTON EVENT EVERY TIME IT'S SHOWN
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                // Remove any existing listeners
                submitBtn.replaceWith(submitBtn.cloneNode(true));
                // Get the new button reference
                this.elements.submitBtn = document.getElementById('submit-btn');
                // Add the event listener
                this.elements.submitBtn.addEventListener('click', () => {
                    console.log('Submit button clicked via updateSelectedCount!');
                    this.submitSelectedLeagues();
                });
            }
        } else {
            this.elements.submitSection.classList.add('hidden');
        }
    }
    
    updateLeagueSelections() {
        const checkboxes = document.querySelectorAll('.league-checkbox');
        checkboxes.forEach(checkbox => {
            const leagueId = checkbox.dataset.leagueId;
            checkbox.checked = this.selectedLeagues.has(leagueId);
            
            const leagueItem = checkbox.closest('.league-item');
            if (checkbox.checked) {
                leagueItem.classList.add('selected');
            } else {
                leagueItem.classList.remove('selected');
            }
        });
    }
    
    showLoading() {
        this.elements.loading.classList.remove('hidden');
        this.elements.welcomeSection.classList.add('hidden');
        this.elements.leaguesSection.classList.add('hidden');
        this.elements.noLeagues.classList.add('hidden');
    }
    
    hideLoading() {
        this.elements.loading.classList.add('hidden');
    }
    hideImportResults() {
        this.elements.importResultsSection.classList.add('hidden');
    }
    
    showNoLeagues() {
        this.elements.noLeagues.classList.remove('hidden');
        this.elements.welcomeSection.classList.add('hidden');
        this.elements.leaguesSection.classList.add('hidden');
    }
    
    showError(message) {
        this.elements.error.textContent = message;
        this.elements.error.className = 'error';
        this.elements.error.classList.remove('hidden');
        this.elements.success.classList.add('hidden');
    }
    
    showSuccess(message) {
        this.elements.success.textContent = message;
        this.elements.success.className = 'success';
        this.elements.success.classList.remove('hidden');
        this.elements.error.classList.add('hidden');
    }
    
    showAuthError(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #d97706;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-width: 400px;
            font-family: 'Inter', sans-serif;
        `;
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">🔐 Authentication Required</div>
            <div>${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        this.showError(message);
    }
    
    clearMessages() {
        this.elements.error.classList.add('hidden');
        this.elements.success.classList.add('hidden');
    }

    // Additional utility methods for stats functionality
    async clearStatsCache() {
        try {
            if (window.statsAPI) {
                window.statsAPI.clearCache();
            }
            if (window.statsDB) {
                // Clear specific data for current selection
                const key = window.statsDB.generateLoadKey(this.currentYear, this.currentWeek, this.currentPosition);
                window.statsDB.loadTracker.delete(key);
                localStorage.removeItem(`loaded_${key}`);
            }
            this.showSuccess('Stats cache cleared');
            await this.loadStatsData(true); // Force refresh
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showError('Failed to clear cache');
        }
    }

    // Method to populate year/week/position selects dynamically
    async populateStatsSelects() {
        try {
            // Populate years (could be made dynamic based on available data)
            const years = ['2024', '2023', '2022'];
            if (this.elements.yearSelect) {
                this.elements.yearSelect.innerHTML = years.map(year => 
                    `<option value="${year}" ${year === this.currentYear ? 'selected' : ''}>${year}</option>`
                ).join('');
            }

            // Populate weeks
            const weeks = [
                { value: 'total', label: 'Season Total' },
                { value: 'week1', label: 'Week 1' },
                { value: 'week2', label: 'Week 2' },
                { value: 'week3', label: 'Week 3' },
                { value: 'week4', label: 'Week 4' },
                { value: 'week5', label: 'Week 5' },
                { value: 'week6', label: 'Week 6' },
                { value: 'week7', label: 'Week 7' },
                { value: 'week8', label: 'Week 8' },
                { value: 'week9', label: 'Week 9' },
                { value: 'week10', label: 'Week 10' },
                { value: 'week11', label: 'Week 11' },
                { value: 'week12', label: 'Week 12' },
                { value: 'week13', label: 'Week 13' },
                { value: 'week14', label: 'Week 14' },
                { value: 'week15', label: 'Week 15' },
                { value: 'week16', label: 'Week 16' },
                { value: 'week17', label: 'Week 17' },
                { value: 'week18', label: 'Week 18' }
            ];

            if (this.elements.weekSelect) {
                this.elements.weekSelect.innerHTML = weeks.map(week => 
                    `<option value="${week.value}" ${week.value === this.currentWeek ? 'selected' : ''}>${week.label}</option>`
                ).join('');
            }

            // Populate positions
            const positions = [
                { value: 'ALL', label: 'All Positions' },
                { value: 'QB', label: 'Quarterback' },
                { value: 'RB', label: 'Running Back' },
                { value: 'WR', label: 'Wide Receiver' },
                { value: 'TE', label: 'Tight End' },
                { value: 'K', label: 'Kicker' },
                { value: 'DEF', label: 'Defense' }
            ];

            if (this.elements.positionSelect) {
                this.elements.positionSelect.innerHTML = positions.map(pos => 
                    `<option value="${pos.value}" ${pos.value === this.currentPosition ? 'selected' : ''}>${pos.label}</option>`
                ).join('');
            }

        } catch (error) {
            console.error('Error populating stats selects:', error);
        }
    }

    // Method to handle keyboard shortcuts for stats navigation
    handleStatsKeyboardShortcuts(event) {
        // Only handle shortcuts when stats section is visible
        if (this.elements.statsSection && this.elements.statsSection.classList.contains('hidden')) {
            return;
        }

        // Ctrl/Cmd + R: Refresh stats
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            this.loadStatsData(true);
        }

        // Ctrl/Cmd + Shift + C: Clear cache
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            this.clearStatsCache();
        }
    }

    // Method to export stats data as CSV
    exportStatsAsCSV() {
        if (!this.statsData || this.statsData.length === 0) {
            this.showError('No stats data to export');
            return;
        }

        try {
            // Create CSV headers
            const headers = ['Player Name', 'Position', 'Team', 'Player Key'];
            
            // Add stat headers based on available stats
            const sampleStats = this.statsData[0]?.stats || {};
            const statKeys = Object.keys(sampleStats);
            headers.push(...statKeys.map(key => `Stat_${key}`));

            // Create CSV rows
            const csvRows = [headers.join(',')];
            
            this.statsData.forEach(player => {
                const row = [
                    `"${player.playerName || ''}"`,
                    `"${player.position || ''}"`,
                    `"${this.getPlayerTeam(player) || ''}"`,
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
                link.setAttribute('download', `fantasy-stats-${this.currentYear}-${this.currentWeek}-${this.currentPosition}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            this.showSuccess(`Exported ${this.statsData.length} player stats to CSV`);

        } catch (error) {
            console.error('Error exporting CSV:', error);
            this.showError('Failed to export stats data');
        }
    }

    // Method to get detailed cache statistics
    async getDetailedCacheStats() {
        try {
            const memoryInfo = window.statsAPI ? window.statsAPI.getCacheInfo() : { memoryCacheSize: 0, memoryCacheKeys: [] };
            const storageInfo = window.statsDB ? await window.statsDB.getStorageInfo() : { statsRecords: 0, loadedKeys: [] };

            return {
                memory: memoryInfo,
                indexedDB: storageInfo,
                localStorage: {
                    fantasyLeagueData: localStorage.getItem('fantasyLeagueData') ? 'Present' : 'Not found',
                    fantasyLeagueQuickAccess: localStorage.getItem('fantasyLeagueQuickAccess') ? 'Present' : 'Not found',
                    loadedStatsKeys: Object.keys(localStorage).filter(k => k.startsWith('loaded_')).length
                }
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return null;
        }
    }

    // Debug method to log all cache information
    async logCacheDebugInfo() {
        const stats = await this.getDetailedCacheStats();
        console.group('🔍 Fantasy Dashboard Cache Debug Info');
        console.log('Memory Cache:', stats?.memory);
        console.log('IndexedDB Cache:', stats?.indexedDB);
        console.log('LocalStorage Cache:', stats?.localStorage);
        console.log('Current State:', {
            year: this.currentYear,
            week: this.currentWeek,
            position: this.currentPosition,
            statsDataCount: this.statsData.length
        });
        console.groupEnd();
    }

    // Enhanced initialization that includes populating selects
    async initializeStatsExtended() {
        try {
            await this.initializeStats();
            await this.populateStatsSelects();
            
            // Add keyboard shortcuts
            document.addEventListener('keydown', (e) => this.handleStatsKeyboardShortcuts(e));

            console.log('✅ Extended stats initialization complete');
        } catch (error) {
            console.error('Error in extended stats initialization:', error);
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new FantasyDashboard();
    
    // Make dashboard available globally for debugging
    window.fantasyDashboard = dashboard;
    
    // Add some helpful global debug functions
    window.debugCache = () => dashboard.logCacheDebugInfo();
    window.clearCache = () => dashboard.clearStatsCache();
    window.exportStats = () => dashboard.exportStatsAsCSV();
    
    console.log('🏈 Fantasy Dashboard initialized! Available debug commands:');
    console.log('- window.debugCache() - Show cache information');
    console.log('- window.clearCache() - Clear current stats cache');
    console.log('- window.exportStats() - Export current stats as CSV');
    console.log('- Ctrl/Cmd + R - Refresh stats data');
    console.log('- Ctrl/Cmd + Shift + C - Clear cache');
});
