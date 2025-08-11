// table-sorting.js - Universal table sorting functionality
class TableSorter {
    constructor() {
        this.currentSort = {
            column: null,
            direction: 'desc' // Start with descending (big numbers first)
        };
    }

    // Initialize sorting for all tables
    initializeSorting() {
        // Main stats table
        const mainTable = document.querySelector('.research-table');
        if (mainTable) {
            this.setupTableSorting(mainTable, 'main');
        }

        // Player stats table
        const playerTable = document.querySelector('.player-stats-table');
        if (playerTable) {
            this.setupTableSorting(playerTable, 'player');
        }
    }

    setupTableSorting(table, tableType) {
        const headers = table.querySelectorAll('th');
        
        headers.forEach((header, index) => {
            // Skip if already has sorting or is marked as no-sort
            if (header.classList.contains('sorting-enabled') || header.classList.contains('no-sort')) return;
            
            header.classList.add('sorting-enabled', 'sortable');
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.style.position = 'relative';
            
            // Add sort indicator
            this.addSortIndicator(header);
            
            header.addEventListener('click', (e) => {
                e.preventDefault();
                this.sortTable(table, index, tableType);
            });
        });
    }

    addSortIndicator(header) {
        if (header.querySelector('.sort-indicator')) return;
        
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 12 12" style="margin-left: 4px; opacity: 0.5;">
                <path d="M6 2l3 3H3l3-3z" fill="currentColor"/>
                <path d="M6 10l3-3H3l3 3z" fill="currentColor"/>
            </svg>
        `;
        header.appendChild(indicator);
    }

    updateSortIndicator(header, direction) {
        const indicator = header.querySelector('.sort-indicator');
        if (!indicator) return;
        
        // Reset all indicators
        header.closest('table').querySelectorAll('.sort-indicator').forEach(ind => {
            ind.style.opacity = '0.5';
            ind.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="margin-left: 4px;">
                    <path d="M6 2l3 3H3l3-3z" fill="currentColor"/>
                    <path d="M6 10l3-3H3l3 3z" fill="currentColor"/>
                </svg>
            `;
        });
        
        // Update current indicator
        indicator.style.opacity = '1';
        if (direction === 'asc') {
            indicator.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="margin-left: 4px;">
                    <path d="M6 2l3 3H3l3-3z" fill="currentColor"/>
                </svg>
            `;
        } else {
            indicator.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="margin-left: 4px;">
                    <path d="M6 10l3-3H3l3 3z" fill="currentColor"/>
                </svg>
            `;
        }
    }

    sortTable(table, columnIndex, tableType) {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const header = table.querySelectorAll('th')[columnIndex];
        
        // Determine sort direction
        let direction = 'desc'; // Default to descending (big numbers first)
        if (this.currentSort.column === columnIndex) {
            direction = this.currentSort.direction === 'desc' ? 'asc' : 'desc';
        }
        
        this.currentSort = { column: columnIndex, direction };
        
        // Sort rows
        const sortedRows = rows.sort((a, b) => {
            const aValue = this.getCellValue(a, columnIndex);
            const bValue = this.getCellValue(b, columnIndex);
            
            const comparison = this.compareValues(aValue, bValue);
            return direction === 'asc' ? comparison : -comparison;
        });
        
        // Update DOM
        sortedRows.forEach(row => tbody.appendChild(row));
        
        // Update sort indicators
        this.updateSortIndicator(header, direction);
        
        console.log(`🔄 Sorted table by column ${columnIndex} (${direction})`);
    }

    getCellValue(row, columnIndex) {
        const cell = row.children[columnIndex];
        if (!cell) return '';
        
        // Get text content, excluding any YoY indicators
        let text = cell.textContent || cell.innerText || '';
        
        // Remove YoY percentage indicators like "(+15%)" or "NEW"
        text = text.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s*NEW\s*/g, '').trim();
        
        // Remove "pts" suffix for fantasy stats
        text = text.replace(/\s*pts\s*$/i, '').trim();
        
        // Remove "#" prefix for ranks
        text = text.replace(/^#/, '').trim();
        
        return text;
    }

    compareValues(a, b) {
        // Handle empty values
        if (a === '' && b === '') return 0;
        if (a === '') return 1;
        if (b === '') return -1;
        
        // Try numeric comparison first
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        
        // Fallback to string comparison
        return a.toString().localeCompare(b.toString(), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }
}

// Initialize table sorting when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const tableSorter = new TableSorter();
    
    // Initialize immediately if tables exist
    tableSorter.initializeSorting();
    
    // Also reinitialize when tables are re-rendered
    const observer = new MutationObserver(() => {
        tableSorter.initializeSorting();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Make globally available
    window.tableSorter = tableSorter;
});
