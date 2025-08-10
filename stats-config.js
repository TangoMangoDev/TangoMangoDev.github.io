// stats-config.js - SHARED CONFIGURATION FOR ALL STATS
// This is the single source of truth for all stat definitions, calculations, and mappings

window.STATS_CONFIG = {
    // OFFICIAL STAT ID MAPPING - Single source of truth
    STAT_ID_MAPPING: {
        "0": { name: "Games Played", type: "count", calculation: "sum", isNegative: false },
        "1": { name: "Pass Att", type: "count", calculation: "sum", isNegative: false },
        "2": { name: "Comp", type: "count", calculation: "sum", isNegative: false },
        "3": { name: "Inc", type: "count", calculation: "sum", isNegative: false },
        "4": { name: "Pass Yds", type: "yards", calculation: "sum", isNegative: false },
        "5": { name: "Pass TD", type: "count", calculation: "sum", isNegative: false },
        "6": { name: "Int", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "7": { name: "Sack", type: "count", calculation: "sum", isNegative: false },
        "8": { name: "Rush Att", type: "count", calculation: "sum", isNegative: false },
        "9": { name: "Rush Yds", type: "yards", calculation: "sum", isNegative: false },
        "10": { name: "Rush TD", type: "count", calculation: "sum", isNegative: false },
        "11": { name: "Rec", type: "count", calculation: "sum", isNegative: false },
        "12": { name: "Rec Yds", type: "yards", calculation: "sum", isNegative: false },
        "13": { name: "Rec TD", type: "count", calculation: "sum", isNegative: false },
        "14": { name: "Ret Yds", type: "yards", calculation: "sum", isNegative: false },
        "15": { name: "Ret TD", type: "count", calculation: "sum", isNegative: false },
        "16": { name: "2-PT", type: "count", calculation: "sum", isNegative: false },
        "17": { name: "Fum", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "18": { name: "Fum Lost", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "19": { name: "FG 0-19", type: "count", calculation: "sum", isNegative: false },
        "20": { name: "FG 20-29", type: "count", calculation: "sum", isNegative: false },
        "21": { name: "FG 30-39", type: "count", calculation: "sum", isNegative: false },
        "22": { name: "FG 40-49", type: "count", calculation: "sum", isNegative: false },
        "23": { name: "FG 50+", type: "count", calculation: "sum", isNegative: false },
        "24": { name: "FGM 0-19", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "25": { name: "FGM 20-29", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "26": { name: "FGM 30-39", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "27": { name: "FGM 40-49", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "28": { name: "FGM 50+", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "29": { name: "PAT Made", type: "count", calculation: "sum", isNegative: false },
        "30": { name: "PAT Miss", type: "count", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "31": { name: "Pts Allow", type: "points", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "32": { name: "Sack", type: "count", calculation: "sum", isNegative: false },
        "33": { name: "Int", type: "count", calculation: "sum", isNegative: false },
        "34": { name: "Fum Rec", type: "count", calculation: "sum", isNegative: false },
        "35": { name: "TD", type: "count", calculation: "sum", isNegative: false },
        "36": { name: "Safe", type: "count", calculation: "sum", isNegative: false },
        "37": { name: "Blk Kick", type: "count", calculation: "sum", isNegative: false },
        "38": { name: "Tack Solo", type: "count", calculation: "sum", isNegative: false },
        "39": { name: "Tack Ast", type: "count", calculation: "sum", isNegative: false },
        "40": { name: "Sack", type: "count", calculation: "sum", isNegative: false },
        "41": { name: "Int", type: "count", calculation: "sum", isNegative: false },
        "42": { name: "Fum Force", type: "count", calculation: "sum", isNegative: false },
        "43": { name: "Fum Rec", type: "count", calculation: "sum", isNegative: false },
        "44": { name: "TD", type: "count", calculation: "sum", isNegative: false },
        "45": { name: "Safe", type: "count", calculation: "sum", isNegative: false },
        "46": { name: "Pass Def", type: "count", calculation: "sum", isNegative: false },
        "47": { name: "Blk Kick", type: "count", calculation: "sum", isNegative: false },
        "48": { name: "Ret Yds", type: "yards", calculation: "sum", isNegative: false },
        "49": { name: "Ret TD", type: "count", calculation: "sum", isNegative: false },
        "50": { name: "Pts Allow 0", type: "count", calculation: "sum", isNegative: false },
        "51": { name: "Pts Allow 1-6", type: "count", calculation: "sum", isNegative: false },
        "52": { name: "Pts Allow 7-13", type: "count", calculation: "sum", isNegative: false },
        "53": { name: "Pts Allow 14-20", type: "count", calculation: "sum", isNegative: false },
        "54": { name: "Pts Allow 21-27", type: "count", calculation: "sum", isNegative: false },
        "55": { name: "Pts Allow 28-34", type: "count", calculation: "sum", isNegative: false },
        "56": { name: "Pts Allow 35+", type: "count", calculation: "sum", isNegative: false },
        "57": { name: "Fum Ret TD", type: "count", calculation: "sum", isNegative: false },
        "58": { name: "Pick Six", type: "count", calculation: "sum", isNegative: false },
        "59": { name: "40 Yd Comp", type: "count", calculation: "sum", isNegative: false },
        "60": { name: "40 Yd Pass TD", type: "count", calculation: "sum", isNegative: false },
        "61": { name: "40 Yd Rush", type: "count", calculation: "sum", isNegative: false },
        "62": { name: "40 Yd Rush TD", type: "count", calculation: "sum", isNegative: false },
        "63": { name: "40 Yd Rec", type: "count", calculation: "sum", isNegative: false },
        "64": { name: "40 Yd Rec TD", type: "count", calculation: "sum", isNegative: false },
        "65": { name: "TFL", type: "count", calculation: "sum", isNegative: false },
        "66": { name: "TO Ret Yds", type: "yards", calculation: "sum", isNegative: false },
        "67": { name: "4 Dwn Stops", type: "count", calculation: "sum", isNegative: false },
        "68": { name: "TFL", type: "count", calculation: "sum", isNegative: false },
        "69": { name: "Def Yds Allow", type: "yards", calculation: "sum", isNegative: true }, // NEGATIVE STAT
        "70": { name: "Yds Allow Neg", type: "yards", calculation: "sum", isNegative: false },
        "71": { name: "Yds Allow 0-99", type: "count", calculation: "sum", isNegative: false },
        "72": { name: "Yds Allow 100-199", type: "count", calculation: "sum", isNegative: false },
        "73": { name: "Yds Allow 200-299", type: "count", calculation: "sum", isNegative: false },
        "74": { name: "Yds Allow 300-399", type: "count", calculation: "sum", isNegative: false },
        "75": { name: "Yds Allow 400-499", type: "count", calculation: "sum", isNegative: false },
        "76": { name: "Yds Allow 500+", type: "count", calculation: "sum", isNegative: false },
        "77": { name: "3 and Outs", type: "count", calculation: "sum", isNegative: false },
        "78": { name: "Targets", type: "count", calculation: "sum", isNegative: false },
        "79": { name: "Pass 1st Downs", type: "count", calculation: "sum", isNegative: false },
        "80": { name: "Rec 1st Downs", type: "count", calculation: "sum", isNegative: false },
        "81": { name: "Rush 1st Downs", type: "count", calculation: "sum", isNegative: false },
        "82": { name: "XPR", type: "count", calculation: "sum", isNegative: false },
        "83": { name: "XPR", type: "count", calculation: "sum", isNegative: false },
        "84": { name: "FG Yds", type: "yards", calculation: "sum", isNegative: false },
        "85": { name: "FG Made", type: "count", calculation: "sum", isNegative: false },
        "86": { name: "FG Miss", type: "count", calculation: "sum", isNegative: true } // NEGATIVE STAT
    },

    // Position-specific key stats for card displays
    POSITION_KEY_STATS: {
        "QB": ["Pass Yds", "Pass TD", "Int", "Rush Yds"],
        "RB": ["Rush Yds", "Rush TD", "Rec", "Rec Yds"],
        "WR": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
        "TE": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
        "K": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49"],
        "DST": ["Pts Allow 0", "Sack", "Int", "Def TD"],
        "LB": ["Tack Solo", "Sack", "Int", "Fum Force"],
        "CB": ["Tack Solo", "Pass Def", "Int", "Def TD"],
        "S": ["Tack Solo", "Pass Def", "Int", "Def TD"],
        "DE": ["Tack Solo", "Sack", "Fum Force", "Def TD"],
        "DT": ["Tack Solo", "Sack", "Fum Force", "Def TD"]
    },

    // Position stat mappings - ALL STATS A POSITION CAN HAVE
    POSITION_STATS: {
        "QB": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack", "Rush Att", "Rush Yds", "Rush TD", "Fum", "Fum Lost", "2-PT", "40 Yd Comp", "40 Yd Pass TD", "Pass 1st Downs"],
        "RB": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "2-PT", "Fum", "Fum Lost", "Rush 1st Downs", "Rec 1st Downs", "40 Yd Rush", "40 Yd Rush TD", "40 Yd Rec", "40 Yd Rec TD"],
        "WR": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "2-PT", "Fum", "Fum Lost", "Rec 1st Downs", "40 Yd Rush", "40 Yd Rush TD", "40 Yd Rec", "40 Yd Rec TD"],
        "TE": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "2-PT", "Fum", "Fum Lost", "Rec 1st Downs", "40 Yd Rush", "40 Yd Rush TD", "40 Yd Rec", "40 Yd Rec TD"],
        "K": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49", "FG 50+", "FGM 0-19", "FGM 20-29", "FGM 30-39", "FGM 40-49", "FGM 50+", "PAT Made", "PAT Miss", "FG Yds", "FG Made", "FG Miss"],
        "DST": ["Pts Allow", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "Ret Yds", "Ret TD", "Pts Allow 0", "Pts Allow 1-6", "Pts Allow 7-13", "Pts Allow 14-20", "Pts Allow 21-27", "Pts Allow 28-34", "Pts Allow 35+", "Fum Ret TD", "Pick Six", "TO Ret Yds", "4 Dwn Stops", "TFL", "Def Yds Allow", "Yds Allow Neg", "Yds Allow 0-99", "Yds Allow 100-199", "Yds Allow 200-299", "Yds Allow 300-399", "Yds Allow 400-499", "Yds Allow 500+", "3 and Outs"],
        "LB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "TFL"],
        "CB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
        "S": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
        "DE": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "TFL"],
        "DT": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "Ret Yds", "Ret TD", "TFL"]
    },

    // FANTASY CALCULATION HELPERS
    calculateFantasyPoints: function(statId, rawValue, scoringRule) {
        if (!rawValue || rawValue === 0) return 0;
        if (!scoringRule) return rawValue;

        const statConfig = this.STAT_ID_MAPPING[statId];
        if (!statConfig) return rawValue;

        // Base points calculation
        let points = rawValue * parseFloat(scoringRule.points || 0);

        // Apply negative multiplier for negative stats
        if (statConfig.isNegative) {
            // For negative stats, ensure the result is negative
            // If scoring rule is already negative, don't double-negative
            if (points > 0) {
                points = -points;
            }
        }

        // Add bonus points if applicable
        if (scoringRule.bonuses && Array.isArray(scoringRule.bonuses)) {
            scoringRule.bonuses.forEach(bonusRule => {
                const target = parseFloat(bonusRule.bonus.target || 0);
                const bonusPoints = parseFloat(bonusRule.bonus.points || 0);
                
                if (rawValue >= target && target > 0) {
                    const bonusesEarned = Math.floor(rawValue / target);
                    points += bonusesEarned * bonusPoints;
                }
            });
        }

        return Math.round(points * 100) / 100;
    },

    // Get stat name by ID
    getStatName: function(statId) {
        const statConfig = this.STAT_ID_MAPPING[statId];
        return statConfig ? statConfig.name : `Stat ${statId}`;
    },

    // Get stat config by ID
    getStatConfig: function(statId) {
        return this.STAT_ID_MAPPING[statId] || null;
    },

    // Check if stat is negative
    isNegativeStat: function(statId) {
        const statConfig = this.STAT_ID_MAPPING[statId];
        return statConfig ? statConfig.isNegative : false;
    },

    // Get stats for a position
    getStatsForPosition: function(position) {
        if (position === 'ALL') {
            const allStats = new Set();
            Object.values(this.POSITION_STATS).forEach(stats => {
                stats.forEach(stat => allStats.add(stat));
            });
            return Array.from(allStats);
        }
        return this.POSITION_STATS[position] || [];
    },

    // Get key stats for a position
    getKeyStatsForPosition: function(position) {
        return this.POSITION_KEY_STATS[position] || [];
    }
};

// Make mapping available globally for backward compatibility
window.STAT_ID_MAPPING = {};
Object.keys(window.STATS_CONFIG.STAT_ID_MAPPING).forEach(id => {
    window.STAT_ID_MAPPING[id] = window.STATS_CONFIG.STAT_ID_MAPPING[id].name;
});

console.log('✅ Stats configuration loaded - Single source of truth established');
