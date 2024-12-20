const App = {
    currentFilters: {
        dateRange: 'all',
        transactionType: 'all',
        commodityType: 'all'
    },
    currentView: 'overview',
    currentTimeFrame: 'monthly',
    filteredData: null,

    async initialize() {
        try {
            if (!this.debug.validateSetup()) {
                throw new Error('Required DOM elements missing');
            }
            await this.loadInitialContext();
            this.setupEventListeners();
            ChartsService.initializeCharts();
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    },

    async loadInitialContext() {
        try {
            this.showLoading(true);
            const contexts = await ContextService.getContexts();
            this.populateContextSelector(contexts);
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading initial context:', error);
            this.showError('Failed to load available contexts. Please try again later.');
            this.showLoading(false);
        }
    },

    populateContextSelector(contexts) {
        const selector = document.getElementById('contextSelector');
        if (!selector) return;

        const options = contexts.map(context => `
            <option value="${context.id}">
                ${context.title} (${context.date})
            </option>
        `);

        selector.innerHTML = `
            <option value="">Select a Collection...</option>
            ${options.join('')}
        `;
    },

    setupEventListeners() {
        // Context Selection
        const contextSelector = document.getElementById('contextSelector');
        if (contextSelector) {
            contextSelector.addEventListener('change', (e) => this.handleContextChange(e.target.value));
        }

        // Loading Progress
        window.addEventListener('loadingProgress', (e) => this.updateLoadingProgress(e.detail));

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavigation(e.target.dataset.view);
            });
        });

        // Time period buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            if (button.classList.contains('btn')) {
                button.addEventListener('click', (e) => {
                    const view = e.target.dataset.view;
                    if (view === 'monthly' || view === 'quarterly' || view === 'yearly') {
                        this.handleTimeFrameChange(view);
                    }
                });
            }
        });

        // Filters
        this.setupFilterListeners();

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Help modal
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('helpModal'));
                modal.show();
            });
        }

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    },

    setupFilterListeners() {
        // Date Range Filter
        const dateRange = document.getElementById('dateRange');
        if (dateRange) {
            dateRange.addEventListener('change', () => this.applyFilters());
        }

        // Transaction Type Filter
        const transactionType = document.getElementById('transactionType');
        if (transactionType) {
            transactionType.addEventListener('change', () => this.applyFilters());
        }

        // Commodity Filter
        const commodityType = document.getElementById('commodityType');
        if (commodityType) {
            commodityType.addEventListener('change', () => this.applyFilters());
        }

        // Reset Filters
        const resetButton = document.getElementById('resetFilters');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetFilters());
        }
    },
    async handleContextChange(contextId) {
        if (!contextId) return;

        try {
            this.showLoading(true);
            this.showLoadingProgress(true);
            
            // Select context and get its books
            const context = await ContextService.selectContext(contextId);
            
            // Update context info display
            this.updateContextInfo(context);
            
            // Load data for all books in the context
            await this.loadContextData(context);
            
            this.showLoadingProgress(false);
            this.showLoading(false);
        } catch (error) {
            console.error('Error changing context:', error);
            this.showError('Failed to load selected context. Please try again.');
            this.showLoading(false);
            this.showLoadingProgress(false);
        }
    },

    updateContextInfo(context) {
        const infoElement = document.getElementById('contextInfo');
        if (!infoElement) return;

        infoElement.innerHTML = `
            <h6>${context.title}</h6>
            <p class="text-muted mb-1">${context.date}</p>
            ${context.description ? `<p class="small mb-1">${context.description}</p>` : ''}
            <div class="small">
                <strong>Location:</strong> ${context.coverage || 'N/A'}<br>
                ${context.contributors?.length ? 
                    `<strong>Contributors:</strong> ${context.contributors.join(', ')}` : ''}
            </div>
        `;
    },

    async loadContextData(context) {
        try {
            // Reset loaded books display
            this.resetLoadedBooks();
            
            // Load data for all books
            const data = await DataService.loadContext(context);
            
            // Setup filters based on new data
            this.setupFilters();
            
            // Update UI with new data
            this.updateUI(data);
            
            // Show success message
            this.showSuccess(`Successfully loaded ${context.books.length} books from ${context.title}`);
        } catch (error) {
            console.error('Error loading context data:', error);
            this.showError('Error loading context data. Some books may be missing.');
        }
    },

    setupFilters() {
        if (!DataService.processedData) return;

        // Setup date range options
        const dateSelect = document.getElementById('dateRange');
        if (dateSelect) {
            const years = new Set(
                DataService.processedData.transactions.map(t => 
                    t.date.getFullYear()
                )
            );
            
            dateSelect.innerHTML = '<option value="all">All Time</option>';
            Array.from(years).sort().forEach(year => {
                dateSelect.innerHTML += `<option value="${year}">${year}</option>`;
            });
        }

        // Setup transaction type options
        const typeSelect = document.getElementById('transactionType');
        if (typeSelect) {
            const types = new Set(DataService.processedData.transactions.flatMap(t => t.type));
            typeSelect.innerHTML = '<option value="all">All Types</option>';
            Array.from(types).sort().forEach(type => {
                typeSelect.innerHTML += `<option value="${type}">${type.replace('bk:', '')}</option>`;
            });
        }

        // Setup commodity filter
        const commoditySelect = document.getElementById('commodityType');
        if (commoditySelect) {
            const commodities = new Set(
                DataService.processedData.transactions.flatMap(t => 
                    t.commodities.map(c => c.name)
                )
            );
            commoditySelect.innerHTML = '<option value="all">All Commodities</option>';
            Array.from(commodities).sort().forEach(commodity => {
                commoditySelect.innerHTML += `<option value="${commodity}">${commodity}</option>`;
            });
        }
    },

    applyFilters() {
        if (!DataService.processedData) return;

        const dateRange = document.getElementById('dateRange').value;
        const transactionType = document.getElementById('transactionType').value;
        const commodityType = document.getElementById('commodityType').value;

        let filteredTransactions = [...DataService.processedData.transactions];

        // Apply date filter
        if (dateRange !== 'all') {
            const year = parseInt(dateRange);
            filteredTransactions = filteredTransactions.filter(t => 
                t.date.getFullYear() === year
            );
        }

        // Apply transaction type filter
        if (transactionType !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => 
                t.type.includes(transactionType)
            );
        }

        // Apply commodity filter
        if (commodityType !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => 
                t.commodities.some(c => c.name === commodityType)
            );
        }

        this.filteredData = {
            transactions: filteredTransactions,
            timeSeriesData: DataService.generateTimeSeriesData(filteredTransactions),
            networkData: DataService.generateNetworkData(filteredTransactions),
            statistics: DataService.generateStatistics(filteredTransactions)
        };

        this.updateUI(this.filteredData);
    },

    resetFilters() {
        document.getElementById('dateRange').value = 'all';
        document.getElementById('transactionType').value = 'all';
        document.getElementById('commodityType').value = 'all';
        
        this.filteredData = null;
        this.updateUI(DataService.processedData);
    },
    handleTimeFrameChange(timeFrame) {
        this.currentTimeFrame = timeFrame;
        
        // Update active state of buttons
        document.querySelectorAll('[data-view].btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === timeFrame) {
                btn.classList.add('active');
            }
        });

        // Update chart with new timeframe
        const data = this.filteredData || DataService.processedData;
        if (data) {
            ChartsService.updateTimeSeriesChart(data.timeSeriesData, timeFrame);
        }
    },

    handleNavigation(view) {
        this.currentView = view;
        
        // Hide all sections
        document.querySelectorAll('div[id$="-section"]').forEach(section => {
            section.classList.add('d-none');
        });

        // Show selected section
        const selectedSection = document.getElementById(`${view}-section`);
        if (selectedSection) {
            selectedSection.classList.remove('d-none');
        }

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === view) {
                link.classList.add('active');
            }
        });

        // Trigger resize to redraw charts
        this.handleResize();
    },

    updateUI(data) {
        if (!data) return;
    
        const stats = data.statistics;
        
        // Update quick stats
        document.getElementById('total-transactions').textContent = 
            (stats.totalTransactions || 0).toLocaleString();
        document.getElementById('unique-traders').textContent = 
            (stats.uniqueTraders || 0).toLocaleString();
        document.getElementById('total-commodities').textContent = 
            (stats.uniqueCommodities || 0).toLocaleString();
        
        // Update date range
        const dateRangeText = stats.dateRange && stats.dateRange.start && stats.dateRange.end
            ? `${stats.dateRange.start.getFullYear()}-${stats.dateRange.end.getFullYear()}`
            : 'No date range available';
        document.getElementById('date-range').textContent = dateRangeText;
    
        // Update charts with current timeframe
        if (data.timeSeriesData) {
            ChartsService.updateTimeSeriesChart(data.timeSeriesData, this.currentTimeFrame);
        }
        
        if (data.networkData) {
            ChartsService.updateNetworkChart(data.networkData);
        }
        
        // Update transactions table
        this.updateTransactionsTable(data.transactions.slice(0, 10));
    },

    updateTransactionsTable(transactions) {
        const tbody = document.querySelector('#transactionTable tbody');
        if (!tbody) return;

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No transactions available</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(t => `
            <tr>
                <td>${d3.timeFormat("%Y-%m-%d")(t.date)}</td>
                <td>${t.agents.from.map(a => a.name).join(', ') || '-'}</td>
                <td>${t.agents.to.map(a => a.name).join(', ') || '-'}</td>
                <td>${t.type.map(type => type.replace('bk:', '')).join(', ')}</td>
                <td>${t.transfers.map(tr => tr.details).join('; ')}</td>
                <td>${t.totalValue?.toFixed(2) || '-'}</td>
            </tr>
        `).join('');
    },

    handleResize() {
        ChartsService.initializeCharts();
        
        const data = this.filteredData || DataService.processedData;
        if (data) {
            this.updateUI(data);
        }
    },

    updateLoadingProgress(detail) {
        if (!detail) return;
        
        const { loaded, total, bookId, success } = detail;
        
        // Update progress bar
        const progressBar = document.querySelector('#loadingProgress .progress-bar');
        if (progressBar) {
            const percentage = (loaded / total) * 100;
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
            progressBar.textContent = `Loading: ${loaded}/${total} books`;
        }

        // Update books list
        this.updateLoadedBooks(bookId, success);
    },

    updateLoadedBooks(bookId, success) {
        const booksListElement = document.getElementById('booksList');
        if (!booksListElement) return;

        const bookElement = document.createElement('div');
        bookElement.className = success ? 'text-success' : 'text-danger';
        bookElement.innerHTML = `${success ? '✓' : '✗'} ${bookId}`;
        booksListElement.appendChild(bookElement);
    },

    resetLoadedBooks() {
        const booksListEl = document.getElementById('booksList');
        if (!booksListEl) {
            console.warn('Books list element not found, skipping reset');
            return;
        }
        booksListEl.innerHTML = 'No books loaded yet.';
    },

    showLoadingProgress(show) {
        const progress = document.getElementById('loadingProgress');
        if (progress) {
            progress.classList.toggle('d-none', !show);
            if (show) {
                const progressBar = progress.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = '0%';
                    progressBar.setAttribute('aria-valuenow', 0);
                }
            }
        }
    },

    exportData() {
        const data = this.filteredData || DataService.processedData;
        if (!data?.transactions?.length) return;

        const csvContent = this.generateCSV(data.transactions);
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'transactions.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    generateCSV(transactions) {
        const headers = ['Date', 'From', 'To', 'Type', 'Details', 'Value', 'Commodities'];
        const rows = transactions.map(t => [
            d3.timeFormat("%Y-%m-%d")(t.date),
            t.agents.from.map(a => a.name).join('; '),
            t.agents.to.map(a => a.name).join('; '),
            t.type.join('; '),
            t.transfers.map(tr => tr.details).join('; '),
            t.totalValue || '',
            t.commodities.map(c => `${c.name} (${c.measure})`).join('; ')
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    },

    showSuccess(message) {
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        const container = document.querySelector('.container-fluid');
        if (container) {
            container.insertAdjacentHTML('afterbegin', alertHtml);
        }
    },

    showError(message) {
        console.error(message);
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        const container = document.getElementById('errorContainer') || document.querySelector('.container-fluid');
        if (container) {
            container.insertAdjacentHTML('afterbegin', alertHtml);
        }
    },

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.toggle('d-none', !show);
        }
    },

    debug: {
        validateSetup() {
            const requiredElements = [
                'contextSelector',
                'loadingSpinner',
                'booksList',
                'contextInfo',
                'loadingProgress',
                'timeSeriesChart',
                'transactionTable'
            ];
            
            const missing = requiredElements.filter(id => !document.getElementById(id));
            if (missing.length > 0) {
                console.error('Missing required elements:', missing);
                return false;
            }
            return true;
        },

        logState() {
            console.log('Current App State:', {
                currentView: this.currentView,
                currentTimeFrame: this.currentTimeFrame,
                currentFilters: this.currentFilters,
                filteredData: this.filteredData,
                processedData: DataService.processedData
            });
        }
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.initialize();
});
   