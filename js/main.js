import DataHandler from './data.js';
import { Charts } from './charts.js';

class WheatonDashboard {
    constructor() {
        this.dataHandler = new DataHandler();
        this.charts = new Charts();
        this.currentView = 'monthly';
    }

    async initialize() {
        try {
            await this.showLoading(true);
            const processedData = await this.dataHandler.initialize();
            if (processedData) {
                this.updateVisualizations(processedData);
                this.initializeEventListeners();
                this.updateQuickStats(processedData.quickStats);
            }
            await this.showLoading(false);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    updateVisualizations(data = null) {
        try {
            const processedData = data || this.dataHandler.processAllData();
            this.charts.init(processedData);
        } catch (error) {
            console.error('Error updating visualizations:', error);
        }
    }

    updateQuickStats(stats) {
        try {
            document.getElementById('total-transactions').textContent = stats.totalTransactions || '-';
            document.getElementById('unique-traders').textContent = stats.uniqueTraders || '-';
            document.getElementById('total-commodities').textContent = stats.totalCommodities || '-';
            document.getElementById('date-range').textContent = stats.dateRange.start ? 
                `${stats.dateRange.start.toLocaleDateString()} - ${stats.dateRange.end.toLocaleDateString()}` : 
                '-';
        } catch (error) {
            console.error('Error updating quick stats:', error);
        }
    }

    async showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    showError(message) {
        console.error(message);
        // Implement error display logic here
    }

    initializeEventListeners() {
        // Time period buttons
        document.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                if (view) {
                    this.currentView = view;
                    this.updateVisualizations();
                }
            });
        });

        // Add more event listeners as needed
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new WheatonDashboard();
    dashboard.initialize().catch(error => {
        console.error('Failed to initialize dashboard:', error);
    });
});