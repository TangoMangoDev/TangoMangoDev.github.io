// table-sorting.js - Universal table sorting functionality
class TableSorter {
    constructor() {
        this.currentSort = {
            column: null,
            direction: 'desc'
        };
    }

// In table-sorting.js, update the initializeSorting method
initializeSorting() {
    // Main stats table
    const mainTable = document.querySelector('.research-table');
    if (mainTable) {
        this.setupTableSorting(mainTable, 'main');
    }

    // Player stats table - ADD THIS
    const playerTable = document.querySelector('.player-stats-table');
    if (playerTable) {
        this.setupTableSorting(playerTable, 'player');
    }
}

    setupTableSorting(table, tableType) {
        const headers = table.querySelectorAll('th');
        
        headers.forEach((header, index) => {
            if (header.classList.contains('sorting-enabled') || header.classList.contains('no-sort')) return;
            
            header.classList.add('sorting-enabled', 'sortable');
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.style.position = 'relative';
            
            this.addSortIndicator(header);
            
            // Don't add click listener if there's already an onclick attribute
            if (!header.getAttribute('onclick')) {
                header.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.sortTable(table, index, tableType);
                });
            }
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
        
        header.closest('table').querySelectorAll('.sort-indicator').forEach(ind => {
            ind.style.opacity = '0.5';
            ind.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 12 12" style="margin-left: 4px;">
                    <path d="M6 2l3 3H3l3-3z" fill="currentColor"/>
                    <path d="M6 10l3-3H3l3 3z" fill="currentColor"/>
                </svg>
            `;
        });
        
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
        
        let direction = 'desc';
        if (this.currentSort.column === columnIndex) {
            direction = this.currentSort.direction === 'desc' ? 'asc' : 'desc';
        }
        
        this.currentSort = { column: columnIndex, direction };
        
        const sortedRows = rows.sort((a, b) => {
            const aValue = this.getCellValue(a, columnIndex);
            const bValue = this.getCellValue(b, columnIndex);
            
            const comparison = this.compareValues(aValue, bValue);
            return direction === 'asc' ? comparison : -comparison;
        });
        
        sortedRows.forEach(row => tbody.appendChild(row));
        this.updateSortIndicator(header, direction);
        
        console.log(`🔄 Sorted table by column ${columnIndex} (${direction})`);
    }

    // NEW: Global sort function for onclick handlers
    globalSort(columnName) {
        console.log(`🎯 Global sort called for: ${columnName}`);
        
        // Update the global tableSort state in stats.js
        if (window.tableSort) {
            if (window.tableSort.column === columnName) {
                window.tableSort.direction = window.tableSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                window.tableSort.column = columnName;
                window.tableSort.direction = 'desc';
            }
            
            // Call the render function from stats.js
            if (window.render) {
                window.render();
            }
        }
    }

    getCellValue(row, columnIndex) {
        const cell = row.children[columnIndex];
        if (!cell) return '';
        
        let text = cell.textContent || cell.innerText || '';
        text = text.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s*NEW\s*/g, '').trim();
        text = text.replace(/\s*pts\s*$/i, '').trim();
        text = text.replace(/^#/, '').trim();
        
        return text;
    }

    compareValues(a, b) {
        if (a === '' && b === '') return 0;
        if (a === '') return 1;
        if (b === '') return -1;
        
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        
        return a.toString().localeCompare(b.toString(), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }
}

// Initialize table sorting when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const tableSorter = new TableSorter();
    tableSorter.initializeSorting();
    
    const observer = new MutationObserver(() => {
        tableSorter.initializeSorting();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    window.tableSorter = tableSorter;
    
    // Expose global sortTable function for onclick handlers
    window.sortTable = (columnName) => {
        tableSorter.globalSort(columnName);
    };
});
