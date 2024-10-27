// contextService.js
const ContextService = {
    baseUrl: 'http://localhost:3000/api', // Point to local proxy
    contexts: null,
    selectedContext: null,

    async getContexts() {
        try {
            const response = await fetch(`${this.baseUrl}/contexts`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            // Process results
            const results = xmlDoc.querySelectorAll('result');
            const contexts = new Map();

            results.forEach(result => {
                const pid = result.querySelector('pid').getAttribute('uri');
                const contextId = pid.split('/')[1];
                
                if (!contexts.has(contextId)) {
                    contexts.set(contextId, {
                        id: contextId,
                        title: result.querySelector('title').textContent.trim(),
                        date: result.querySelector('date')?.textContent?.trim(),
                        coverage: result.querySelector('coverage')?.textContent?.trim(),
                        description: result.querySelector('description')?.textContent?.trim(),
                        contributors: [],
                        books: []
                    });
                }

                // Add contributor if exists and not already added
                const contributor = result.querySelector('contributor')?.textContent?.trim();
                if (contributor && !contexts.get(contextId).contributors.includes(contributor)) {
                    contexts.get(contextId).contributors.push(contributor);
                }
            });

            this.contexts = Array.from(contexts.values());
            return this.contexts;
        } catch (error) {
            console.error('Error fetching contexts:', error);
            throw error;
        }
    },

    async getBooksForContext(contextId) {
        try {
            const response = await fetch(`${this.baseUrl}/context/${contextId}/books`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            const books = Array.from(xmlDoc.querySelectorAll('result')).map(result => {
                const identifier = result.querySelector('identifier').textContent.trim();
                return {
                    id: identifier,
                    title: result.querySelector('title')?.textContent?.trim(),
                    date: result.querySelector('date')?.textContent?.trim(),
                    description: result.querySelector('description')?.textContent?.trim()
                };
            });

            // Update the context with its books
            const contextIndex = this.contexts.findIndex(c => c.id === contextId);
            if (contextIndex !== -1) {
                this.contexts[contextIndex].books = books;
            }

            return books;
        } catch (error) {
            console.error(`Error fetching books for context ${contextId}:`, error);
            throw error;
        }
    },

    async selectContext(contextId) {
        try {
            this.selectedContext = this.contexts.find(c => c.id === contextId);
            if (!this.selectedContext) {
                throw new Error(`Context ${contextId} not found`);
            }

            // Get books if not already loaded
            if (!this.selectedContext.books.length) {
                await this.getBooksForContext(contextId);
            }

            return this.selectedContext;
        } catch (error) {
            console.error(`Error selecting context ${contextId}:`, error);
            throw error;
        }
    }
};