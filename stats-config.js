// stats-config.js - CORRECTED VERSION
window.STATS_CONFIG = {
    // OFFICIAL STAT ID MAPPING - Simplified without isNegative flag
    STAT_ID_MAPPING: {
        "0": { name: "Games Played", type: "count", calculation: "sum" },
        "1": { name: "Pass Att", type: "count", calculation: "sum" },
        "2": { name: "Comp", type: "count", calculation: "sum" },
        "3": { name: "Inc", type: "count", calculation: "sum" },
        "4": { name: "Pass Yds", type: "yards", calculation: "sum" },
        "5": { name: "Pass TD", type: "count", calculation: "sum" },
        "6": { name: "Int", type: "count", calculation: "sum" },
        "7": { name: "Sack", type: "count", calculation: "sum" },
        "8": { name: "Rush Att", type: "count", calculation: "sum" },
        "9": { name: "Rush Yds", type: "yards", calculation: "sum" },
        "10": { name: "Rush TD", type: "count", calculation: "sum" },
        "11": { name: "Rec", type: "count", calculation: "sum" },
        "12": { name: "Rec Yds", type: "yards", calculation: "sum" },
        "13": { name: "Rec TD", type: "count", calculation: "sum" },
        "14": { name: "Ret Yds", type: "yards", calculation: "sum" },
        "15": { name: "Ret TD", type: "count", calculation: "sum" },
        "16": { name: "2-PT", type: "count", calculation: "sum" },
        "17": { name: "Fum", type: "count", calculation: "sum" },
        "18": { name: "Fum Lost", type: "count", calculation: "sum" },
        "19": { name: "FG 0-19", type: "count", calculation: "sum" },
        "20": { name: "FG 20-29", type: "count", calculation: "sum" },
        "21": { name: "FG 30-39", type: "count", calculation: "sum" },
        "22": { name: "FG 40-49", type: "count", calculation: "sum" },
        "23": { name: "FG 50+", type: "count", calculation: "sum" },
        "24": { name: "FGM 0-19", type: "count", calculation: "sum" },
        "25": { name: "FGM 20-29", type: "count", calculation: "sum" },
        "26": { name: "FGM 30-39", type: "count", calculation: "sum" },
        "27": { name: "FGM 40-49", type: "count", calculation: "sum" },
        "28": { name: "FGM 50+", type: "count", calculation: "sum" },
        "29": { name: "PAT Made", type: "count", calculation: "sum" },
        "30": { name: "PAT Miss", type: "count", calculation: "sum" },
        "31": { name: "Pts Allow", type: "points", calculation: "sum" },
        "32": { name: "Sack", type: "count", calculation: "sum" },
        "33": { name: "Int", type: "count", calculation: "sum" },
        "34": { name: "Fum Rec", type: "count", calculation: "sum" },
        "35": { name: "TD", type: "count", calculation: "sum" },
        "36": { name: "Safe", type: "count", calculation: "sum" },
        "37": { name: "Blk Kick", type: "count", calculation: "sum" },
        "38": { name: "Tack Solo", type: "count", calculation: "sum" },
        "39": { name: "Tack Ast", type: "count", calculation: "sum" },
        "40": { name: "Sack", type: "count", calculation: "sum" },
        "41": { name: "Int", type: "count", calculation: "sum" },
        "42": { name: "Fum Force", type: "count", calculation: "sum" },
        "43": { name: "Fum Rec", type: "count", calculation: "sum" },
        "44": { name: "TD", type: "count", calculation: "sum" },
        "45": { name: "Safe", type: "count", calculation: "sum" },
        "46": { name: "Pass Def", type: "count", calculation: "sum" },
        "47": { name: "Blk Kick", type: "count", calculation: "sum" },
        "48": { name: "Ret Yds", type: "yards", calculation: "sum" },
        "49": { name: "Ret TD", type: "count", calculation: "sum" },
        "50": { name: "Pts Allow 0", type: "count", calculation: "sum" },
        "51": { name: "Pts Allow 1-6", type: "count", calculation: "sum" },
        "52": { name: "Pts Allow 7-13", type: "count", calculation: "sum" },
        "53": { name: "Pts Allow 14-20", type: "count", calculation: "sum" },
        "54": { name: "Pts Allow 21-27", type: "count", calculation: "sum" },
        "55": { name: "Pts Allow 28-34", type: "count", calculation: "sum" },
        "56": { name: "Pts Allow 35+", type: "count", calculation: "sum" },
        "57": { name: "Fum Ret TD", type: "count", calculation: "sum" },
        "58": { name: "Pick Six", type: "count", calculation: "sum" },
        "59": { name: "40 Yd Comp", type: "count", calculation: "sum" },
        "60": { name: "40 Yd Pass TD", type: "count", calculation: "sum" },
        "61": { name: "40 Yd Rush", type: "count", calculation: "sum" },
        "62": { name: "40 Yd Rush TD", type: "count", calculation: "sum" },
        "63": { name: "40 Yd Rec", type: "count", calculation: "sum" },
        "64": { name: "40 Yd Rec TD", type: "count", calculation: "sum" },
        "65": { name: "TFL", type: "count", calculation: "sum" },
        "66": { name: "TO Ret Yds", type: "yards", calculation: "sum" },
        "67": { name: "4 Dwn Stops", type: "count", calculation: "sum" },
        "68": { name: "TFL", type: "count", calculation: "sum" },
        "69": { name: "Def Yds Allow", type: "yards", calculation: "sum" },
        "70": { name: "Yds Allow Neg", type: "yards", calculation: "sum" },
        "71": { name: "Yds Allow 0-99", type: "count", calculation: "sum" },
        "72": { name: "Yds Allow 100-199", type: "count", calculation: "sum" },
        "73": { name: "Yds Allow 200-299", type: "count", calculation: "sum" },
        "74": { name: "Yds Allow 300-399", type: "count", calculation: "sum" },
        "75": { name: "Yds Allow 400-499", type: "count", calculation: "sum" },
        "76": { name: "Yds Allow 500+", type: "count", calculation: "sum" },
        "77": { name: "3 and Outs", type: "count", calculation: "sum" },
        "78": { name: "Targets", type: "count", calculation: "sum" },
        "79": { name: "Pass 1st Downs", type: "count", calculation: "sum" },
        "80": { name: "Rec 1st Downs", type: "count", calculation: "sum" },
        "81": { name: "Rush 1st Downs", type: "count", calculation: "sum" },
        "82": { name: "XPR", type: "count", calculation: "sum" },
        "83": { name: "XPR", type: "count", calculation: "sum" },
        "84": { name: "FG Yds", type: "yards", calculation: "sum" },
        "85": { name: "FG Made", type: "count", calculation: "sum" },
        "86": { name: "FG Miss", type: "count", calculation: "sum" }
    },

    // Position-specific key stats for card displays
    POSITION_KEY_STATS: {
        "QB": ["Pass Yds", "Pass TD", "Int", "Rush Yds"],
        "RB": ["Rush Yds", "Rush TD", "Rec", "Rec Yds"],
        "WR": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
        "TE": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
        "K": ["FG 0-19", "FG 20-29", "FG 30-39", "FG 40-49"],
        "DST": ["Pts Allow 0", "Sack", "Int", "TD"],
        "LB": ["Tack Solo", "Sack", "Int", "Fum Force"],
        "CB": ["Tack Solo", "Pass Def", "Int", "TD"],
        "S": ["Tack Solo", "Pass Def", "Int", "TD"],
        "DE": ["Tack Solo", "Sack", "Fum Force", "TD"],
        "DT": ["Tack Solo", "Sack", "Fum Force", "TD"]
    },

    // Position stat mappings - ALL STATS A POSITION CAN HAVE
    POSITION_STATS: {
        "QB": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Rush Att", "Rush Yds", "Rush TD", "Fum", "Fum Lost", "2-PT", "40 Yd Comp", "40 Yd Pass TD", "Pass 1st Downs"],
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

    // FANTASY CALCULATION - SIMPLE AND CORRECT
    calculateFantasyPoints: function(statId, rawValue, scoringRule) {
        if (!rawValue || rawValue === 0) return 0;
        if (!scoringRule) return 0;

        // Base points calculation - EXACTLY as your scoring rules define
        let points = rawValue * parseFloat(scoringRule.points || 0);

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
