// stats-api.js - API layer with caching
class StatsAPI {
    constructor() {
        this.baseUrl = '/data/stats/data'; // Your Cloudflare Worker endpoint
        this.cache = new StatsCache();
        this.currentRequests = new Map(); // Prevent duplicate requests
        
        // Yahoo stat ID mapping - done on FRONTEND
        this.statIdMapping = {
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
    }

    // Convert Yahoo stat IDs to readable names - FRONTEND ONLY
    convertYahooStatsToReadable(rawStats, position) {
        const readableStats = {};
        
        Object.entries(rawStats).forEach(([statId, value]) => {
            const readableName = this.statIdMapping[statId];
            if (readableName && value != null && value !== 0) {
                readableStats[readableName] = value;
            }
        });

        return readableStats;
    }

    async fetchStats(year = '2024', week = 'total', position = 'ALL', page = 1) {
        const requestKey = `${year}_${week}_${position}_${page}`;
        
        // Check if we already have a pending request for this data
        if (this.currentRequests.has(requestKey)) {
            console.log(`⏳ Waiting for pending request: ${requestKey}`);
            return await this.currentRequests.get(requestKey);
        }

        // Check cache first
        const cachedData = await this.cache.get(year, week, position, page);
        if (cachedData) {
            return cachedData;
        }

        // Create the fetch promise
        const fetchPromise = this.fetchFromAPI(year, week, position, page);
        this.currentRequests.set(requestKey, fetchPromise);

        try {
            const data = await fetchPromise;
            
            // Cache the successful response
            if (data.success) {
                await this.cache.set(year, week, position, page, data);
            }
            
            return data;
        } catch (error) {
            console.error('Stats fetch error:', error);
            throw error;
        } finally {
            // Clean up the pending request
            this.currentRequests.delete(requestKey);
        }
    }

    async fetchFromAPI(year, week, position, page) {
        const params = new URLSearchParams({
            year,
            week,
            position,
            page: page.toString(),
            limit: '50'
        });

        const url = `${this.baseUrl}?${params}`;
        console.log(`🌐 Fetching from API: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include', // Include cookies for auth
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }

        // Convert raw Yahoo stat IDs to readable names HERE on frontend
        data.data = data.data.map(player => ({
            ...player,
            stats: this.convertYahooStatsToReadable(player.stats, player.position)
        }));

        console.log(`✅ Fetched and converted ${data.count} players from API`);
        return data;
    }

    async clearCache(year = null) {
        if (year) {
            await this.cache.clear(year);
        } else {
            await this.cache.clearAll();
        }
    }

    async getCacheStats() {
        return await this.cache.getStats();
    }
}
