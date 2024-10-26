// charts.js
class Charts {
    constructor() {
        this.colors = {
            commodity: '#69b3a2',
            service: '#404080',
            monetary: '#b36969',
            default: '#cccccc'
        };
        this.margins = {
            default: { top: 20, right: 30, bottom: 50, left: 60 }
        };
    }

    init(data) {
        if (!data) {
            console.error('No data provided to charts initialization');
            return;
        }

        try {
            this.createTimeSeries('#timeSeriesChart', data.timeSeriesData);
            this.createDistribution('#distributionChart', data.distributionData);
            this.createSeasonalHeatmap('#seasonalHeatmap', data.seasonalData);
            this.createTopTraders('#topTradersChart', data.traderData);
            this.updateTransactionTable(data.recentTransactions);
        } catch (error) {
            console.error('Error initializing charts:', error);
        }
    }

    createTimeSeries(selector, data) {
        const container = d3.select(selector);
        const margin = this.margins.default;
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        // Clear previous content
        container.selectAll('*').remove();

        // Handle empty data
        if (!data || data.length === 0) {
            this.showNoData(container);
            return;
        }

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count) * 1.1])
            .range([height, 0])
            .nice();

        // Create line generators
        const line = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Add grid lines
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat('')
            )
            .style('stroke-dasharray', '3,3')
            .style('stroke-opacity', 0.2);

        // Add X axis
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickFormat(d3.timeFormat('%b %Y')))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        // Add Y axis
        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(y));

        // Add the line
        svg.append('path')
            .datum(data)
            .attr('class', 'time-series-line')
            .attr('d', line)
            .style('stroke', this.colors.commodity)
            .style('fill', 'none')
            .style('stroke-width', 2);

        // Add dots
        const dots = svg.selectAll('.dot')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d.count))
            .attr('r', 4)
            .style('fill', '#fff')
            .style('stroke', this.colors.commodity)
            .style('stroke-width', 2);

        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        dots.on('mouseover', (event, d) => {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d3.timeFormat('%B %Y')(d.date)}</strong><br/>
                Total: ${d.count}<br/>
                Commodity: ${d.commodity}<br/>
                Service: ${d.service}<br/>
                Monetary: ${d.monetary}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Add axis labels
        svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${-margin.left/1.5},${height/2}) rotate(-90)`)
            .text('Number of Transactions');

        svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${width/2},${height + margin.bottom - 5})`)
            .text('Time Period');
    }

    createDistribution(selector, data) {
        const container = d3.select(selector);
        const width = container.node().getBoundingClientRect().width;
        const height = 300;
        const radius = Math.min(width, height) / 2;

        // Clear previous content
        container.selectAll('*').remove();

        if (!data || data.length === 0) {
            this.showNoData(container);
            return;
        }

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        // Create color scale
        const color = d3.scaleOrdinal()
            .domain(['Commodity', 'Service', 'Monetary Value'])
            .range([this.colors.commodity, this.colors.service, this.colors.monetary]);

        // Create pie chart
        const pie = d3.pie()
            .value(d => d.count);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius * 0.8);

        const labelArc = d3.arc()
            .innerRadius(radius * 0.9)
            .outerRadius(radius * 0.9);

        // Add the arcs
        const arcs = svg.selectAll('arc')
            .data(pie(data))
            .enter()
            .append('g');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.type))
            .attr('stroke', 'white')
            .style('stroke-width', '2px')
            .style('transition', 'opacity 0.3s');

        // Add labels
        arcs.append('text')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .attr('dy', '.35em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(d => `${d.data.type} (${d.data.percentage}%)`);

        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        arcs.on('mouseover', (event, d) => {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                ${d.data.type}<br/>
                Count: ${d.data.count}<br/>
                Percentage: ${d.data.percentage}%
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');

            // Highlight segment
            d3.select(event.currentTarget)
                .style('opacity', 0.8);
        })
            .on('mouseout', (event) => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);

                // Reset highlight
                d3.select(event.currentTarget)
                    .style('opacity', 1);
            });
    }

    createSeasonalHeatmap(selector, data) {
        const container = d3.select(selector);
        const margin = this.margins.default;
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Clear previous content
        container.selectAll('*').remove();

        if (!data || data.length === 0) {
            this.showNoData(container);
            return;
        }

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.month))
            .range([0, width])
            .padding(0.05);

        const y = d3.scaleBand()
            .domain(['Commodity', 'Service', 'Monetary'])
            .range([height, 0])
            .padding(0.05);

        const color = d3.scaleSequential()
            .interpolator(d3.interpolateBlues)
            .domain([0, d3.max(data, d => Math.max(d.commodity, d.service, d.monetary))]);

        // Add cells
        const types = ['commodity', 'service', 'monetary'];
        types.forEach(type => {
            svg.selectAll(`.${type}-cell`)
                .data(data)
                .enter()
                .append('rect')
                .attr('class', `${type}-cell`)
                .attr('x', d => x(d.month))
                .attr('y', y(type.charAt(0).toUpperCase() + type.slice(1)))
                .attr('width', x.bandwidth())
                .attr('height', y.bandwidth())
                .style('fill', d => color(d[type]))
                .style('stroke', '#fff')
                .style('stroke-width', 1);
        });

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .call(d3.axisLeft(y));

        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        svg.selectAll('rect')
            .on('mouseover', (event, d) => {
                const type = event.target.classList[0].split('-')[0];
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    ${d.month}<br/>
                    ${type.charAt(0).toUpperCase() + type.slice(1)}: ${d[type]}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    }

    createTopTraders(selector, data) {
        const container = d3.select(selector);
        const margin = this.margins.default;
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Clear previous content
        container.selectAll('*').remove();

        if (!data || data.length === 0) {
            this.showNoData(container);
            return;
        }

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const x = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .range([height, 0])
            .nice();

        // Add bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.name))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d.count))
            .style('fill', this.colors.commodity);

        // Add axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end');

        svg.append('g')
            .call(d3.axisLeft(y));

        // Add tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        svg.selectAll('.bar')
            .on('mouseover', (event, d) => {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    ${d.name}<br/>
                    Transactions: ${d.count}<br/>
                                        Percentage: ${d.percentage}%
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    }

    showNoData(container) {
        container.append('text')
            .attr('class', 'no-data-text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('dy', '-0.3em')
            .style('text-anchor', 'middle')
            .style('font-size', '16px')
            .text('No data available');
    }

    updateTransactionTable(data) {
        const container = d3.select('#transactionTable');
        container.selectAll('*').remove();

        if (!data || data.length === 0) {
            this.showNoData(container);
            return;
        }

        const table = container.append('table').attr('class', 'transaction-table');
        const thead = table.append('thead');
        const tbody = table.append('tbody');

        // Define columns
        const columns = ['Date', 'Type', 'Commodity', 'Service', 'Monetary', 'Count'];

        // Create header
        thead.append('tr')
            .selectAll('th')
            .data(columns)
            .enter()
            .append('th')
            .text(d => d);

        // Fill rows
        data.forEach(row => {
            const tr = tbody.append('tr');
            columns.forEach(column => {
                tr.append('td').text(row[column.toLowerCase()]);
            });
        });
    }
}
