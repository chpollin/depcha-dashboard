// data.js
const DataService = {
    baseUrl: 'http://localhost:3000/api',
    data: null,
    processedData: null,
    currentContext: null,
    loadedBooks: new Map(),

    async fetchDataForBook(bookId) {
        try {
            console.log("Fetching data for book:", bookId); // Debug log
            const response = await fetch(`${this.baseUrl}/transactions/${encodeURIComponent(bookId)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.loadedBooks.set(bookId, true);
            return data;
        } catch (error) {
            console.error(`Error fetching data for book ${bookId}:`, error);
            this.loadedBooks.set(bookId, false);
            return null;
        }
    },

    async loadContext(context) {
        try {
            console.log("Loading context:", context);
            if (!context || !context.id) {
                throw new Error('Invalid context object');
            }
    
            this.currentContext = context;
            this.data = [];
            this.loadedBooks.clear();
    
            // First fetch the books
            const booksResponse = await fetch(`/api/context/${context.id}/books`);
            if (!booksResponse.ok) {
                throw new Error(`Failed to fetch books: ${booksResponse.status}`);
            }
            
            const books = await booksResponse.json();
            console.log(`Fetched ${books.length} books`);
            
            // Then load transactions for each book
            const bookData = await Promise.all(
                books.map(async book => {
                    try {
                        const data = await this.fetchDataForBook(book.identifier);
                        console.log(`Loaded ${data?.length || 0} transactions for book ${book.identifier}`);
                        
                        // Emit progress event
                        const event = new CustomEvent('loadingProgress', {
                            detail: { 
                                loaded: this.loadedBooks.size,
                                total: books.length,
                                bookId: book.identifier,
                                success: !!data
                            }
                        });
                        window.dispatchEvent(event);
                        
                        return data;
                    } catch (err) {
                        console.error(`Error loading book ${book.identifier}:`, err);
                        return null;
                    }
                })
            );
    
            // Combine and filter out nulls
            this.data = bookData.filter(Boolean).flat();
            console.log(`Loaded ${this.data.length} total transactions`);
            
            this.processData();
            return this.processedData;
        } catch (error) {
            console.error('Error in loadContext:', error);
            throw error;
        }
    },

    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Handle different date formats
        const formats = {
            full: /^\d{4}-\d{2}-\d{2}$/, // 1829-04-21
            monthYear: /^\d{4}-\d{2}$/,   // 1829-04
            yearOnly: /^\d{4}$/           // 1829
        };

        try {
            if (formats.full.test(dateStr)) {
                return new Date(dateStr);
            } else if (formats.monthYear.test(dateStr)) {
                return new Date(dateStr + '-01');
            } else if (formats.yearOnly.test(dateStr)) {
                return new Date(dateStr + '-01-01');
            }
        } catch (error) {
            console.warn(`Invalid date format: ${dateStr}`);
        }

        return null;
    },

    classifyResource(transaction) {
        switch(transaction.ml?.toLowerCase()) {
            case 'monetary value':
                return 'bk:Money';
            case 'service':
                return 'bk:ServiceRight';
            case 'commodity':
                return 'bk:EconomicGood';
            default:
                return 'bk:EconomicGood';
        }
    },

    extractIdFromUri(uri) {
        if (!uri) return null;
        const hashIndex = uri.indexOf('#');
        return hashIndex !== -1 ? uri.substring(hashIndex + 1) : null;
    },

    getTransactionId(transferId) {
        return transferId ? transferId.split('T').slice(0, -1).join('T') : null;
    },

    processData() {
        if (!Array.isArray(this.data)) {
            throw new Error('Invalid data structure - expected array');
        }

        // First, process individual transfers
        const transfers = this.data
            .map(transfer => {
                const date = this.parseDate(transfer.w);
                if (!date) return null; // Skip transfers with invalid dates

                const transactionUri = transfer.t || '';
                const bookId = transactionUri.split('#')[0].split('/').pop();

                return {
                    id: this.extractIdFromUri(transfer.tr), // Transfer ID
                    transactionId: this.extractIdFromUri(transfer.t), // Parent Transaction ID
                    bookId: bookId,
                    date: date,
                    type: this.classifyResource(transfer),
                    from: {
                        id: this.extractIdFromUri(transfer.f),
                        name: transfer.fn,
                        uri: transfer.f,
                        type: 'bk:EconomicAgent'
                    },
                    to: {
                        id: this.extractIdFromUri(transfer.to),
                        name: transfer.tn,
                        uri: transfer.to,
                        type: 'bk:EconomicAgent'
                    },
                    details: transfer.e,
                    commodity: transfer.cl ? {
                        id: this.extractIdFromUri(transfer.c),
                        name: transfer.cl,
                        measure: transfer.measure
                    } : null,
                    value: this.extractValue(transfer.e),
                    raw: transfer
                };
            })
            .filter(t => t !== null); // Remove invalid transfers

        // Group transfers by transaction ID
        const transactionGroups = d3.group(transfers, d => d.transactionId);

        // Create consolidated transactions
        const transactions = Array.from(transactionGroups, ([transactionId, groupTransfers]) => {
            const primaryTransfer = groupTransfers[0];
            return {
                id: transactionId,
                bookId: primaryTransfer.bookId,
                date: primaryTransfer.date,
                transfers: groupTransfers,
                type: [...new Set(groupTransfers.map(t => t.type))],
                agents: {
                    from: [...new Set(groupTransfers.map(t => t.from.id))].map(id => {
                        const transfer = groupTransfers.find(t => t.from.id === id);
                        return transfer ? transfer.from : null;
                    }).filter(Boolean),
                    to: [...new Set(groupTransfers.map(t => t.to.id))].map(id => {
                        const transfer = groupTransfers.find(t => t.to.id === id);
                        return transfer ? transfer.to : null;
                    }).filter(Boolean)
                },
                commodities: groupTransfers
                    .map(t => t.commodity)
                    .filter(Boolean),
                totalValue: d3.sum(groupTransfers, t => t.value || 0)
            };
        });

        // Sort by date
        const sortedTransactions = transactions.sort((a, b) => a.date - b.date);

        this.processedData = {
            transactions: sortedTransactions,
            transfers: transfers,
            timeSeriesData: this.generateTimeSeriesData(sortedTransactions),
            networkData: this.generateNetworkData(sortedTransactions),
            topTraders: this.getTopTraders(sortedTransactions),
            recentTransactions: this.getRecentTransactions(sortedTransactions),
            statistics: this.generateStatistics(sortedTransactions),
            bookStats: this.generateBookStatistics(sortedTransactions)
        };

        console.log('Processed Data:', this.processedData);
    },

    generateTimeSeriesData(transactions) {
        const groupedData = d3.group(transactions, 
            d => d3.timeFormat("%Y-%m")(d.date)
        );

        return Array.from(groupedData, ([date, transactions]) => ({
            date: date,
            count: transactions.length,
            byType: d3.group(transactions, d => d.type[0]),
            byBook: d3.group(transactions, d => d.bookId),
            transfers: d3.sum(transactions, d => d.transfers.length),
            commodities: new Set(transactions.flatMap(t => 
                t.commodities.map(c => c.name)
            )),
            totalValue: d3.sum(transactions, d => d.totalValue)
        }))
        .sort((a, b) => {
            const [yearA, monthA] = a.date.split('-');
            const [yearB, monthB] = b.date.split('-');
            return (yearA - yearB) || (monthA - monthB);
        });
    },

    generateNetworkData(transactions) {
        const nodes = new Map();
        const links = [];

        // Create nodes for each unique agent
        transactions.forEach(t => {
            t.agents.from.forEach(agent => {
                if (agent?.id) {
                    nodes.set(agent.id, {
                        id: agent.id,
                        name: agent.name,
                        type: agent.type,
                        uri: agent.uri,
                        group: 1
                    });
                }
            });
            t.agents.to.forEach(agent => {
                if (agent?.id) {
                    nodes.set(agent.id, {
                        id: agent.id,
                        name: agent.name,
                        type: agent.type,
                        uri: agent.uri,
                        group: 2
                    });
                }
            });
        });

        // Create links between agents
        transactions.forEach(t => {
            t.agents.from.forEach(fromAgent => {
                t.agents.to.forEach(toAgent => {
                    if (fromAgent?.id && toAgent?.id) {
                        const existingLink = links.find(l => 
                            l.source === fromAgent.id && l.target === toAgent.id
                        );

                        if (existingLink) {
                            existingLink.value += 1;
                            existingLink.transactions.push(t);
                        } else {
                            links.push({
                                source: fromAgent.id,
                                target: toAgent.id,
                                value: 1,
                                transactions: [t]
                            });
                        }
                    }
                });
            });
        });

        return {
            nodes: Array.from(nodes.values()),
            links
        };
    },

    generateStatistics(transactions) {
        const startDate = d3.min(transactions, d => d.date);
        const endDate = d3.max(transactions, d => d.date);
        
        // Get unique commodities
        const commodities = new Set(transactions.flatMap(t => 
            t.commodities.map(c => c.name)
        ).filter(Boolean));
        
        // Get unique traders
        const uniqueTraders = new Set(transactions.flatMap(t => [
            ...t.agents.from.map(a => a.id),
            ...t.agents.to.map(a => a.id)
        ]).filter(Boolean));

        // Get transaction types
        const transactionTypes = new Set(transactions.flatMap(t => t.type));
        
        return {
            totalTransactions: transactions.length,
            totalTransfers: d3.sum(transactions, d => d.transfers.length),
            uniqueTraders: uniqueTraders.size,
            uniqueCommodities: commodities.size,
            transactionTypes: Array.from(transactionTypes),
            dateRange: {
                start: startDate,
                end: endDate
            },
            commodityTypes: Array.from(commodities),
            totalValue: d3.sum(transactions, d => d.totalValue)
        };
    },

    generateBookStatistics(transactions) {
        const bookStats = d3.group(transactions, d => d.bookId);
        
        return Array.from(bookStats, ([bookId, bookTransactions]) => ({
            bookId,
            transactionCount: bookTransactions.length,
            transferCount: d3.sum(bookTransactions, t => t.transfers.length),
            dateRange: {
                start: d3.min(bookTransactions, t => t.date),
                end: d3.max(bookTransactions, t => t.date)
            },
            uniqueTraders: new Set(bookTransactions.flatMap(t => [
                ...t.agents.from.map(a => a.id),
                ...t.agents.to.map(a => a.id)
            ])).size,
            totalValue: d3.sum(bookTransactions, t => t.totalValue)
        }));
    },

    getTopTraders(transactions, limit = 10) {
        const traderCounts = new Map();
        
        transactions.forEach(t => {
            t.agents.from.forEach(agent => {
                if (agent?.id) {
                    const trader = traderCounts.get(agent.id) || {
                        id: agent.id,
                        name: agent.name,
                        count: 0,
                        transfers: 0,
                        value: 0,
                        books: new Set()
                    };
                    trader.count += 1;
                    trader.transfers += t.transfers.length;
                    trader.value += t.totalValue || 0;
                    trader.books.add(t.bookId);
                    traderCounts.set(agent.id, trader);
                }
            });
            
            t.agents.to.forEach(agent => {
                if (agent?.id) {
                    const trader = traderCounts.get(agent.id) || {
                        id: agent.id,
                        name: agent.name,
                        count: 0,
                        transfers: 0,
                        value: 0,
                        books: new Set()
                    };
                    trader.count += 1;
                    trader.transfers += t.transfers.length;
                    trader.value += t.totalValue || 0;
                    trader.books.add(t.bookId);
                    traderCounts.set(agent.id, trader);
                }
            });
        });

        return Array.from(traderCounts.values())
            .map(trader => ({
                ...trader,
                books: Array.from(trader.books)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    },

    getRecentTransactions(transactions, limit = 10) {
        return [...transactions]
            .sort((a, b) => b.date - a.date)
            .slice(0, limit);
    },

    extractValue(details) {
        if (!details) return null;
        const matches = details.match(/\d+(\.\d+)?/g);
        return matches ? parseFloat(matches[matches.length - 1]) : null;
    },

    getLoadedBooks() {
        return Array.from(this.loadedBooks.entries()).map(([bookId, success]) => ({
            bookId,
            success
        }));
    },

    getLoadingStatus() {
        const total = this.currentContext?.books?.length || 0;
        const loaded = this.loadedBooks.size;
        const successful = Array.from(this.loadedBooks.values()).filter(Boolean).length;
        
        return {
            total,
            loaded,
            successful,
            failed: loaded - successful,
            isComplete: loaded === total
        };
    }
};