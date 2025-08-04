class FantasyDashboard {
    constructor() {
        this.leagues = [];
        this.selectedLeagues = new Set();
        this.isLoading = false;
        this.isSubmitting = false;
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        this.elements = {
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
            importResultsContainer: document.getElementById('import-results-container')
        };
    }
    
    bindEvents() {
        // Bind events that exist at page load
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
    }
    
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
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FantasyDashboard();
});
