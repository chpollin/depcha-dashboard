// data.js
class DataHandler {
    constructor() {
        this.API_URL = 'https://gams.uni-graz.at/archive/objects/query:depcha.transactions/methods/sdef:Query/getJSON?params=%241%7C%3Chttps%3A%2F%2Fgams.uni-graz.at%2Fo%3Adepcha.wheaton.1%3E';
        this.rawData = [];
        this.processedData = {
            timeSeriesData: [],
            distributionData: [],
            seasonalData: [],
            traderData: [],
            recentTransactions: [],
            quickStats: {}
        };
        this.filters = {
            dateRange: 'all',
            transactionType: 'all',
            commodity: 'all'
        };

        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.loadData = this.loadData.bind(this);
        this.processAllData = this.processAllData.bind(this);
        this.normalizeTransaction = this.normalizeTransaction.bind(this);
        this.extractValue = this.extractValue.bind(this);
        this.normalizeMeasure = this.normalizeMeasure.bind(this);
    }

    async initialize() {
        try {
            console.log('Initializing DataHandler...');
            await this.loadData();
            return this.processAllData();
        } catch (error) {
            console.error('Error in DataHandler initialization:', error);
            throw error;
        }
    }

    async loadData() {
        try {
            const response = await fetch(this.API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Loaded transactions:', data.length);
            
            // Store raw data and normalize
            this.rawData = Array.isArray(data) ? data : [];
            this.rawData = this.rawData.map(this.normalizeTransaction);
            
            return this.rawData;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    normalizeTransaction(transaction) {
        try {
            return {
                ...transaction,
                date: new Date(transaction.w),
                value: this.extractValue(transaction.e),
                normalized_measure: this.normalizeMeasure(transaction.measure)
            };
        } catch (error) {
            console.error('Error normalizing transaction:', error);
            return transaction;
        }
    }

    extractValue(entry) {
        if (!entry) return '';
        const matches = entry.match(/\d+(\s*\/\s*\d+)?$/);
        return matches ? matches[0] : '';
    }

    normalizeMeasure(measure) {
        if (!measure) return null;
        const parts = measure.split(' ');
        return {
            value: parseFloat(parts[0]) || 0,
            unit: parts[1] || ''
        };
    }

    processAllData() {
        try {
            console.log('Processing all data...');
            const filteredData = this.filterData(this.rawData);
            
            const processedData = {
                timeSeriesData: this.processTimeSeriesData(filteredData),
                distributionData: this.processDistributionData(filteredData),
                seasonalData: this.processSeasonalData(filteredData),
                traderData: this.processTraderData(filteredData),
                recentTransactions: this.processRecentTransactions(filteredData),
                quickStats: this.calculateQuickStats(filteredData)
            };

            this.processedData = processedData;
            console.log('Data processing complete:', processedData);
            return processedData;
        } catch (error) {
            console.error('Error processing data:', error);
            throw error;
        }
    }

    processTimeSeriesData(data) {
        const groupedData = d3.group(data, d => {
            const date = new Date(d.w);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        });

        return Array.from(groupedData, ([yearMonth, transactions]) => {
            const [year, month] = yearMonth.split('-').map(Number);
            return {
                date: new Date(year, month - 1),
                count: transactions.length,
                commodity: transactions.filter(t => t.ml === 'Commodity').length,
                service: transactions.filter(t => t.ml === 'Service').length,
                monetary: transactions.filter(t => t.ml === 'Monetary Value').length
            };
        }).sort((a, b) => a.date - b.date);
    }

    processDistributionData(data) {
        const typeGroups = d3.group(data, d => d.ml);
        return Array.from(typeGroups, ([type, items]) => ({
            type,
            count: items.length,
            percentage: (items.length / data.length * 100).toFixed(1)
        }));
    }

    processSeasonalData(data) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        return months.map(month => {
            const monthData = data.filter(d => {
                const date = new Date(d.w);
                return months[date.getMonth()] === month;
            });

            return {
                month,
                commodity: monthData.filter(d => d.ml === 'Commodity').length,
                service: monthData.filter(d => d.ml === 'Service').length,
                monetary: monthData.filter(d => d.ml === 'Monetary Value').length,
                total: monthData.length
            };
        });
    }

    processTraderData(data) {
        const traderCounts = new Map();
        data.forEach(d => {
            traderCounts.set(d.fn, (traderCounts.get(d.fn) || 0) + 1);
        });

        return Array.from(traderCounts, ([name, count]) => ({
            name,
            count,
            percentage: (count / data.length * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    processRecentTransactions(data) {
        return [...data]
            .sort((a, b) => new Date(b.w) - new Date(a.w))
            .slice(0, 10)
            .map(t => ({
                date: t.w,
                from: t.fn,
                to: t.tn,
                type: t.ml,
                details: t.cl ? `${t.cl} (${t.measure})` : t.measure,
                value: this.extractValue(t.e)
            }));
    }

    calculateQuickStats(data) {
        const dateRange = d3.extent(data, d => new Date(d.w));
        const uniqueTraders = new Set(data.map(d => d.fn));
        const uniqueCommodities = new Set(data.filter(d => d.ml === 'Commodity').map(d => d.cl));

        return {
            totalTransactions: data.length,
            uniqueTraders: uniqueTraders.size,
            totalCommodities: uniqueCommodities.size,
            dateRange: {
                start: dateRange[0],
                end: dateRange[1]
            }
        };
    }

    filterData(data) {
        return data.filter(d => {
            const dateMatch = this.filters.dateRange === 'all' || 
                            d.w.startsWith(this.filters.dateRange);
            const typeMatch = this.filters.transactionType === 'all' || 
                            d.ml === this.filters.transactionType;
            const commodityMatch = this.filters.commodity === 'all' || 
                                 d.cl === this.filters.commodity;
            return dateMatch && typeMatch && commodityMatch;
        });
    }

    updateFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        return this.processAllData();
    }

    getFilterOptions() {
        return {
            years: [...new Set(this.rawData.map(d => d.w.split('-')[0]))].sort(),
            types: [...new Set(this.rawData.map(d => d.ml))].sort(),
            commodities: [...new Set(this.rawData.filter(d => d.cl).map(d => d.cl))].sort()
        };
    }
}

// Export a single instance
const dataHandler = new DataHandler();
export default dataHandler;