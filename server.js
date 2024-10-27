const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

// Common XML parser configuration
const parserOptions = {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
    explicitRoot: true,
    tagNameProcessors: [xml2js.processors.stripPrefix]
};

// Single helper function for processing XML results
function processResults(results) {
    if (!results) return [];
    
    const resultsArray = Array.isArray(results) ? results : [results];
    const uniqueObjects = new Map();
    
    resultsArray.forEach(result => {
        try {
            const identifier = result.identifier;
            const pid = result.pid?.uri || result.pid?.['$']?.uri;
            
            if (identifier && !uniqueObjects.has(identifier)) {
                uniqueObjects.set(identifier, {
                    pid: pid,
                    identifier: identifier,
                    title: result.title || '',
                    container: result.container || '',
                    date: result.date || '',
                    source: result.source || '',
                    creator: result.creator || '',
                    language: result.language || '',
                    format: result.format || ''
                });
            }
        } catch (err) {
            console.error("Error processing result:", err);
        }
    });
    
    return Array.from(uniqueObjects.values());
}

// Proxy endpoint for contexts
app.get('/api/contexts', async (req, res) => {
    try {
        console.log("Fetching contexts");
        const response = await fetch(
            'https://gams.uni-graz.at/archive/risearch?type=tuples&lang=sparql&format=Sparql&query=http://fedora:8380/archive/get/context:depcha/QUERY'
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlData = await response.text();
        const parser = new xml2js.Parser(parserOptions);
        
        parser.parseString(xmlData, (err, result) => {
            if (err) {
                throw new Error('Failed to parse XML');
            }
            
            const contexts = processResults(result?.sparql?.results?.result);
            res.json(contexts);
        });
    } catch (error) {
        console.error('Error fetching contexts:', error);
        res.status(500).json({error: error.message});
    }
});

// Proxy endpoint for books in a context
app.get('/api/context/:contextId/books', async (req, res) => {
    try {
        console.log("Fetching books for context:", req.params.contextId);
        
        const response = await fetch(
            `https://gams.uni-graz.at/archive/risearch?type=tuples&lang=sparql&format=Sparql&query=http://fedora:8380/archive/get/${req.params.contextId}/QUERY`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlData = await response.text();
        const parser = new xml2js.Parser(parserOptions);
        
        parser.parseString(xmlData, (err, result) => {
            if (err) {
                throw new Error('Failed to parse XML');
            }
            
            const books = processResults(result?.sparql?.results?.result);
            console.log(`Processed ${books.length} unique books`);
            res.json(books);
        });
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({error: error.message});
    }
});

// Proxy endpoint for transaction data
app.get('/api/transactions/:bookId', async (req, res) => {
    try {
        const bookId = req.params.bookId;
        console.log("Fetching transactions for book:", bookId);
        
        const url = `https://gams.uni-graz.at/archive/objects/query:depcha.transactions/methods/sdef:Query/getJSON?params=$1|<https://gams.uni-graz.at/${bookId}>`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.length} transactions for book ${bookId}`);
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            error: error.message,
            bookId: req.params.bookId
        });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});