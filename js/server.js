import DataHandler from './data.js';
import Charts from './charts.js';

class WheatonDashboard {
    constructor() {
        this.dataHandler = new DataHandler();
        this.charts = new Charts();
        this.currentView = 'monthly';
        this.filters = {
            dateRange: 'all',
            transactionType: 'all',
            commodity: 'all'
        };
    }

    // Initialize the dashboard
    async initialize() {
        try {
            await this.showLoading(true);
            // Initialize data
            await this.dataHandler.initialize();
            // Render initial charts
            this.updateVisualizations();
            // Setup event listeners
            this.initializeEventListeners();
            // Update quick stats
            this.updateQuickStats();
            await this.showLoading(false);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    // Update all visualizations
    updateVisualizations() {
        const processedData = this.dataHandler.processAllData();
        
        // Update time series
        this.charts.createTimeSeries(
            '#timeSeriesChart', 
            processedData.timeSeriesData,
            this.currentView
        );

        // Update distribution chart
        this.charts.createDistribution(
            '#distributionChart',
            processedData.distributionData
        );

        // Update seasonal heatmap
        this.charts.createSeasonalHeatmap(
            '#seasonalHeatmap',
            processedData.seasonalData
        );

        // Update top traders
        this.charts.createTopTraders(
            '#topTradersChart',
            processedData.traderData
        );

        // Update transaction table
        this.charts.updateTransactionTable(
            processedData.recentTransactions
        );
    }

    // Update quick stats display
    updateQuickStats() {
        const stats = this.dataHandler.getMetadata();
        document.getElementById('total-transactions').textContent = stats.totalRecords;
        document.getElementById('unique-traders').textContent = stats.traderCount;
        document.getElementById('total-commodities').textContent = stats.commodityCount;
        document.getElementById('date-range').textContent = 
            `${this.formatDate(stats.dateRange[0])} - ${this.formatDate(stats.dateRange[1])}`;
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Time period buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                if (e.target.dataset.view) {
                    this.updateTimeView(e.target.dataset.view);
                }
            });
        });

        // Filters
        document.getElementById('dateRange')?.addEventListener('change', (e) => {
            this.filters.dateRange = e.target.value;
            this.updateDashboard();
        });

        document.getElementById('transactionType')?.addEventListener('change', (e) => {
            this.filters.transactionType = e.target.value;
            this.updateDashboard();
        });

        document.getElementById('commodityType')?.addEventListener('change', (e) => {
            this.filters.commodity = e.target.value;
            this.updateDashboard();
        });

        // Reset filters
        document.getElementById('resetFilters')?.addEventListener('click', () => {
            this.resetFilters();
        });

        // Export button
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.exportData();
        });

        // Help button
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            this.showHelp();
        });

        // Window resize
        window.addEventListener('resize', this.debounce(() => {
            this.updateVisualizations();
        }, 250));
    }

    // Update time view (monthly/quarterly/yearly)
    updateTimeView(view) {
        this.currentView = view;
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        this.updateVisualizations();
    }

    // Update dashboard with new filters
    updateDashboard() {
        this.dataHandler.updateFilters(this.filters);
        this.updateVisualizations();
        this.updateQuickStats();
    }

    // Reset all filters
    resetFilters() {
        this.filters = {
            dateRange: 'all',
            transactionType: 'all',
            commodity: 'all'
        };
        
        // Reset select elements
        document.getElementById('dateRange').value = 'all';
        document.getElementById('transactionType').value = 'all';
        document.getElementById('commodityType').value = 'all';

        this.updateDashboard();
    }

    // Export data as CSV
    exportData() {
        const data = this.dataHandler.processedData.recentTransactions;
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Date,From,To,Type,Details,Value\n"
            + data.map(t => 
                `${t.date},${t.from},${t.to},${t.type},${t.details},${t.value}`
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "wheaton_transactions.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    // Show help modal
    showHelp() {
        const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
        helpModal.show();
    }

    // Loading spinner
    async showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (show) {
            spinner.classList.remove('d-none');
        } else {
            spinner.classList.add('d-none');
        }
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Format date helper
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short'
        });
    }

    // Utility method for debouncing
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Error handling
    showError(message) {
        console.error(message);
        // You could add a toast or alert here
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new WheatonDashboard();
    dashboard.initialize();
});

export default WheatonDashboard;