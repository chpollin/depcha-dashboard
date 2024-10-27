// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public')); // Serve your static files from 'public' directory

// Proxy endpoint for contexts
app.get('/api/contexts', async (req, res) => {
    try {
        const response = await fetch(
            'https://gams.uni-graz.at/archive/risearch?type=tuples&lang=sparql&format=Sparql&query=http://fedora:8380/archive/get/context:depcha/QUERY'
        );
        const data = await response.text();
        res.type('application/xml').send(data);
    } catch (error) {
        console.error('Error fetching contexts:', error);
        res.status(500).send(error.message);
    }
});

// Proxy endpoint for books in a context
app.get('/api/context/:contextId/books', async (req, res) => {
    try {
        const response = await fetch(
            `https://gams.uni-graz.at/archive/risearch?type=tuples&lang=sparql&format=Sparql&query=http://fedora:8380/archive/get/${req.params.contextId}/QUERY`
        );
        const data = await response.text();
        res.type('application/xml').send(data);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).send(error.message);
    }
});

// Proxy endpoint for transaction data
app.get('/api/transactions/:bookId', async (req, res) => {
    try {
        const response = await fetch(
            `https://gams.uni-graz.at/archive/objects/query:depcha.transactions/methods/sdef:Query/getJSON?params=$1|<https://gams.uni-graz.at/${req.params.bookId}>`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send(error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});