// Scoring Rules - matches the example provided
const scoringRules = {
    "2": {"points": 0.1, "bonuses": null},
    "4": {"points": 0.04, "bonuses": [{"bonus": {"target": 300, "points": "4"}}, {"bonus": {"target": 350, "points": "2"}}, {"bonus": {"target": 400, "points": "2"}}]},
    "5": {"points": 6, "bonuses": null},
    "6": {"points": -4, "bonuses": null},
    "8": {"points": 0.2, "bonuses": null},
    "9": {"points": 0.1, "bonuses": [{"bonus": {"target": 100, "points": "4"}}, {"bonus": {"target": 150, "points": "2"}}, {"bonus": {"target": 200, "points": "2"}}]},
    "10": {"points": 6, "bonuses": null},
    "11": {"points": 1, "bonuses": null},
    "12": {"points": 0.1, "bonuses": [{"bonus": {"target": 100, "points": "4"}}, {"bonus": {"target": 150, "points": "2"}}, {"bonus": {"target": 200, "points": "2"}}]},
    "13": {"points": 6, "bonuses": null},
    "14": {"points": 0.1, "bonuses": [{"bonus": {"target": 70, "points": "3"}}, {"bonus": {"target": 100, "points": "1.5"}}, {"bonus": {"target": 150, "points": "2"}}]},
    "15": {"points": 6, "bonuses": null},
    "16": {"points": 2, "bonuses": null},
    "17": {"points": -2, "bonuses": null},
    "18": {"points": -2, "bonuses": null},
    "19": {"points": 3, "bonuses": null},
    "20": {"points": 3, "bonuses": null},
    "21": {"points": 3, "bonuses": null},
    "22": {"points": 4, "bonuses": null}
};

// Stat ID to stat name mapping based on the stats table
const statIdMapping = {
    1: "Pass Att",
    2: "Comp",
    3: "Inc",
    4: "Pass Yds",
    5: "Pass TD",
    6: "Int",
    7: "Sack",
    8: "Rush Att",
    9: "Rush Yds",
    10: "Rush TD",
    11: "Rec",
    12: "Rec Yds",
    13: "Rec TD",
    14: "Ret Yds",
    15: "Ret TD",
    16: "Off Fum Ret TD",
    17: "2-PT",
    18: "Fum",
    19: "Fum Lost",
    20: "FG",
    21: "FGM",
    22: "Pts Allow"
};

// Sample Data
const samplePlayers = [
    {
        id: 1,
        name: "Patrick Mahomes",
        team: "KC",
        position: "QB",
        stats: {
            "Pass Att": 648,
            "Comp": 435,
            "Inc": 213,
            "Pass Yds": 5250,
            "Pass TD": 41,
            "Int": 12,
            "Sack": 26,
            "Rush Att": 61,
            "Rush Yds": 389,
            "Rush TD": 2,
            "Off Fum Ret TD": 0,
            "2-PT": 1,
            "Fum": 5,
            "Fum Lost": 3
        }
    },
    {
        id: 2,
        name: "Josh Allen",
        team: "BUF",
        position: "QB",
        stats: {
            "Pass Att": 599,
            "Comp": 385,
            "Inc": 214,
            "Pass Yds": 4407,
            "Pass TD": 35,
            "Int": 14,
            "Sack": 33,
            "Rush Att": 124,
            "Rush Yds": 762,
            "Rush TD": 7,
            "Off Fum Ret TD": 0,
            "2-PT": 2,
            "Fum": 8,
            "Fum Lost": 4
        }
    },
    {
        id: 3,
        name: "Christian McCaffrey",
        team: "SF",
        position: "RB",
        stats: {
            "Rush Att": 272,
            "Rush Yds": 1459,
            "Rush TD": 14,
            "Rec": 67,
            "Rec Yds": 564,
            "Rec TD": 5,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 1,
            "Fum": 2,
            "Fum Lost": 1
        }
    },
    {
        id: 4,
        name: "Austin Ekeler",
        team: "LAC",
        position: "RB",
        stats: {
            "Rush Att": 204,
            "Rush Yds": 915,
            "Rush TD": 13,
            "Rec": 107,
            "Rec Yds": 722,
            "Rec TD": 5,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 0,
            "Fum": 3,
            "Fum Lost": 2
        }
    },
    {
        id: 5,
        name: "Tyreek Hill",
        team: "MIA",
        position: "WR",
        stats: {
            "Rush Att": 6,
            "Rush Yds": 47,
            "Rush TD": 0,
            "Rec": 119,
            "Rec Yds": 1710,
            "Rec TD": 7,
            "Ret Yds": 26,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 0,
            "Fum": 1,
            "Fum Lost": 0
        }
    },
    {
        id: 6,
        name: "CeeDee Lamb",
        team: "DAL",
        position: "WR",
        stats: {
            "Rush Att": 2,
            "Rush Yds": 16,
            "Rush TD": 0,
            "Rec": 107,
            "Rec Yds": 1359,
            "Rec TD": 9,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 1,
            "Fum": 2,
            "Fum Lost": 1
        }
    },
    {
        id: 7,
        name: "Travis Kelce",
        team: "KC",
        position: "TE",
        stats: {
            "Rush Att": 0,
            "Rush Yds": 0,
            "Rush TD": 0,
            "Rec": 110,
            "Rec Yds": 1338,
            "Rec TD": 12,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 0,
            "Fum": 1,
            "Fum Lost": 0
        }
    },
    {
        id: 8,
        name: "T.J. Hockenson",
        team: "MIN",
        position: "TE",
        stats: {
            "Rush Att": 0,
            "Rush Yds": 0,
            "Rush TD": 0,
            "Rec": 86,
            "Rec Yds": 914,
            "Rec TD": 6,
            "Ret Yds": 0,
            "Ret TD": 0,
            "Off Fum Ret TD": 0,
            "2-PT": 0,
            "Fum": 0,
            "Fum Lost": 0
        }
    },
    {
        id: 9,
        name: "Justin Tucker",
        team: "BAL",
        position: "K",
        stats: {
            "FG": 37,
            "FGM": 2
        }
    },
    {
        id: 10,
        name: "Harrison Butker",
        team: "KC",
        position: "K",
        stats: {
            "FG": 38,
            "FGM": 3
        }
    },
    {
        id: 11,
        name: "49ers Defense",
        team: "SF",
        position: "DST",
        stats: {
            "Pts Allow": 278
        }
    },
    {
        id: 12,
        name: "Ravens Defense",
        team: "BAL",
        position: "DST",
        stats: {
            "Pts Allow": 255
        }
    },
    {
        id: 13,
        name: "T.J. Watt",
        team: "PIT",
        position: "DE",
        stats: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": 48,
            "Tack Ast": 19,
            "Pass Def": 8,
            "Sack": 19,
            "Int": 0,
            "Fum Rec": 2,
            "Fum Force": 8,
            "TD": 0,
            "Safe": 1,
            "Blk Kick": 0
        }
    },
    {
        id: 14,
        name: "Roquan Smith",
        team: "BAL",
        position: "LB",
        stats: {
            "Ret Yds": 14,
            "Ret TD": 0,
            "Tack Solo": 112,
            "Tack Ast": 46,
            "Pass Def": 4,
            "Sack": 4.5,
            "Int": 1,
            "Fum Rec": 0,
            "Fum Force": 1,
            "TD": 0,
            "Safe": 0,
            "Blk Kick": 0
        }
    },
    {
        id: 15,
        name: "Sauce Gardner",
        team: "NYJ",
        position: "CB",
        stats: {
            "Ret Yds": 0,
            "Ret TD": 0,
            "Tack Solo": 60,
            "Tack Ast": 8,
            "Pass Def": 16,
            "Sack": 0,
            "Int": 2,
            "Fum Rec": 0,
            "Fum Force": 1,
            "TD": 0,
            "Safe": 0,
            "Blk Kick": 0
        }
    }
];

// Position stat mappings - RESTORED ALL STATS
const positionStats = {
    "QB": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack", "Rush Att", "Rush Yds", "Rush TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "RB": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "WR": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "TE": ["Rush Att", "Rush Yds", "Rush TD", "Rec", "Rec Yds", "Rec TD", "Ret Yds", "Ret TD", "Off Fum Ret TD", "2-PT", "Fum", "Fum Lost"],
    "K": ["FG", "FGM"],
    "DST": ["Pts Allow"],
    "LB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "CB": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "S": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "DE": ["Ret Yds", "Ret TD", "Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
    "DT": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick", "Ret Yds", "Ret TD"]
};

// Key stats for card view
const keyStats = {
    "QB": ["Pass Yds", "Pass TD", "Int", "Rush Yds"],
    "RB": ["Rush Yds", "Rush TD", "Rec", "Rec Yds"],
    "WR": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "TE": ["Rec", "Rec Yds", "Rec TD", "Rush Yds"],
    "K": ["FG", "FGM"],
    "DST": ["Pts Allow"],
    "LB": ["Tack Solo", "Sack", "Int", "Fum Force"],
    "CB": ["Tack Solo", "Pass Def", "Int", "TD"],
    "S": ["Tack Solo", "Pass Def", "Int", "TD"],
    "DE": ["Tack Solo", "Sack", "Fum Force", "TD"],
    "DT": ["Tack Solo", "Sack", "Fum Force", "TD"]
};

// State
let currentPosition = 'ALL';
let currentView = 'cards';
let searchQuery = '';

// Fantasy Points Calculation Function
function calculateFantasyPoints(statName, statValue) {
    // Find the stat ID for the given stat name
    const statId = Object.keys(statIdMapping).find(id => statIdMapping[id] === statName);
    
    if (!statId || !scoringRules[statId] || statValue === 0) {
        return 0;
    }
    
    const rule = scoringRules[statId];
    let points = statValue * rule.points;
    
    // Add bonus points if applicable
    if (rule.bonuses && Array.isArray(rule.bonuses)) {
        rule.bonuses.forEach(bonusRule => {
            if (statValue >= bonusRule.bonus.target) {
                points += parseFloat(bonusRule.bonus.points);
            }
        });
    }
    
    return Math.round(points * 100) / 100; // Round to 2 decimal places
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    render();
});

function setupEventListeners() {
    // Position filter
    document.getElementById('positionFilter').addEventListener('click', (e) => {
        if (e.target.classList.contains('position-btn')) {
            document.querySelectorAll('.position-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentPosition = e.target.dataset.position;
            render();
        }
    });

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            render();
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        render();
    });
}

function getFilteredPlayers() {
    return samplePlayers.filter(player => {
        const matchesPosition = currentPosition === 'ALL' || player.position === currentPosition;
        const matchesSearch = searchQuery === '' || 
            player.name.toLowerCase().includes(searchQuery) ||
            player.team.toLowerCase().includes(searchQuery);
        return matchesPosition && matchesSearch;
    });
}

function render() {
    const content = document.getElementById('content');
    const filteredPlayers = getFilteredPlayers();

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

    switch (currentView) {
        case 'cards':
            renderCardsView(filteredPlayers);
            break;
        case 'comparison':
            renderComparisonView(filteredPlayers);
            break;
        case 'stats':
            renderStatsView(filteredPlayers);
            break;
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
    
    return `
        <div class="player-card fade-in">
            <div class="player-header">
                <div class="player-info">
                    <h3>${player.name}</h3>
                    <div class="player-meta">
                        <span class="position-badge">${player.position}</span>
                        <span>${player.team}</span>
                    </div>
                </div>
            </div>
            <div class="stat-grid">
                ${stats.map(stat => {
                    const value = player.stats[stat] || 0;
                    const fantasyPoints = calculateFantasyPoints(stat, value);
                    const isBest = checkIfBestStat(player, stat);
                    return `
                        <div class="stat-item ${isBest ? 'stat-best' : ''}">
                            <span class="stat-value">${formatStatValue(value, stat)}</span>
                            <span class="stat-label">${stat}</span>
                            ${fantasyPoints > 0 ? `<div class="fantasy-points">${fantasyPoints} pts</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderComparisonView(players) {
    const content = document.getElementById('content');
    const stats = getStatsForPosition(currentPosition);
    
    content.innerHTML = `
        <div class="comparison-container fade-in">
            <div class="comparison-header">
                <h2>Player Comparison</h2>
            </div>
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            ${stats.map(stat => `<th>${stat}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(player => `
                            <tr>
                                <td class="player-name-cell">${player.name}</td>
                                ${stats.map(stat => {
                                    const value = player.stats[stat] || 0;
                                    const fantasyPoints = calculateFantasyPoints(stat, value);
                                    const isBest = checkIfBestStat(player, stat);
                                    return `
                                        <td ${isBest ? 'style="color: #2e7d32; font-weight: 600;"' : ''}>
                                            ${formatStatValue(value, stat)}
                                            ${fantasyPoints > 0 ? `<br><span style="font-size: 12px; color: #2a5298;">${fantasyPoints} pts</span>` : ''}
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderStatsView(players) {
    const content = document.getElementById('content');
    const stats = getStatsForPosition(currentPosition);
    const statCategories = categorizeStats(stats);
    
    content.innerHTML = `
        <div class="stats-overview fade-in">
            <h2>Leaders</h2>
            ${Object.entries(statCategories).map(([category, categoryStats]) => `
                <div class="stat-category">
                    <div class="stat-category-title">${category}</div>
                    ${categoryStats.map(stat => {
                        const leaders = getStatLeaders(players, stat, 3);
                        return `
                            <div class="stat-row">
                                <span>${stat}</span>
                                <span>${leaders.map(l => {
                                    const fantasyPoints = calculateFantasyPoints(stat, l.value);
                                    return `${l.name} (${formatStatValue(l.value, stat)}${fantasyPoints > 0 ? `, ${fantasyPoints} pts` : ''})`;
                                }).join(', ')}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function getStatsForPosition(position) {
    if (position === 'ALL') {
        // When ALL is selected, show ALL possible stats from all positions
        const allStats = new Set();
        Object.values(positionStats).forEach(stats => {
            stats.forEach(stat => allStats.add(stat));
        });
        return Array.from(allStats);
    }
    return positionStats[position] || [];
}

function categorizeStats(stats) {
    const categories = {
        "Passing": ["Pass Att", "Comp", "Inc", "Pass Yds", "Pass TD", "Int", "Sack"],
        "Rushing": ["Rush Att", "Rush Yds", "Rush TD"],
        "Receiving": ["Rec", "Rec Yds", "Rec TD"],
        "Defense": ["Tack Solo", "Tack Ast", "Pass Def", "Sack", "Int", "Fum Rec", "Fum Force", "TD", "Safe", "Blk Kick"],
        "Special Teams": ["Ret Yds", "Ret TD", "FG", "FGM", "Pts Allow"],
        "Turnovers": ["Fum", "Fum Lost", "Off Fum Ret TD"],
        "Scoring": ["2-PT"]
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
        .filter(p => p.stats[stat] !== undefined)
        .map(p => ({ name: p.name, value: p.stats[stat] || 0 }))
        .sort((a, b) => {
            // For stats where lower is better
            if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
                return a.value - b.value;
            }
            return b.value - a.value;
        })
        .slice(0, limit);
}

function checkIfBestStat(player, stat) {
    const players = getFilteredPlayers().filter(p => p.position === player.position);
    const values = players.map(p => p.stats[stat] || 0);
    const playerValue = player.stats[stat] || 0;
    
    if (stat === 'Int' || stat === 'Fum Lost' || stat === 'FGM' || stat === 'Pts Allow') {
        return playerValue === Math.min(...values) && playerValue > 0;
    }
    return playerValue === Math.max(...values) && playerValue > 0;
}

function formatStatValue(value, stat) {
    if (stat === 'Sack' || stat === 'Pass Def') {
        return value.toFixed(1);
    }
    if (stat === 'FG') {
        return `${value} Att`;
    }
    if (stat === 'FGM') {
        return `${value} Miss`;
    }
    return value.toString();
}

// Add touch interactions for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    if (Math.abs(swipeDistance) < 50) return;

    const viewBtns = Array.from(document.querySelectorAll('.view-btn'));
    const currentIndex = viewBtns.findIndex(btn => btn.classList.contains('active'));

    if (swipeDistance > 0 && currentIndex > 0) {
        // Swipe right - go to previous view
        viewBtns[currentIndex - 1].click();
    } else if (swipeDistance < 0 && currentIndex < viewBtns.length - 1) {
        // Swipe left - go to next view
        viewBtns[currentIndex + 1].click();
    }
}
