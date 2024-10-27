// charts.js
const ChartsService = {
    margin: { top: 20, right: 30, bottom: 50, left: 60 },
    colors: d3.schemeCategory10,
    timeSeriesChart: null,
    networkChart: null,
    distributionChart: null,
    seasonalChart: null,

    initializeCharts() {
        this.createTimeSeriesChart();
        this.createNetworkChart();
        this.createDistributionChart();
        this.createSeasonalChart();
    },

    createTimeSeriesChart() {
        const container = document.getElementById('timeSeriesChart');
        if (!container) return;
        
        container.innerHTML = '';
        const width = container.clientWidth - this.margin.left - this.margin.right;
        const height = 400 - this.margin.top - this.margin.bottom;

        const svg = d3.select('#timeSeriesChart')
            .append('svg')
            .attr('width', width + this.margin.left + this.margin.right)
            .attr('height', height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Add axes groups
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        svg.append('g')
            .attr('class', 'y-axis');

        // Add labels
        svg.append('text')
            .attr('class', 'x-label')
            .attr('text-anchor', 'middle')
            .attr('x', width / 2)
            .attr('y', height + this.margin.bottom - 5)
            .text('Date');

        svg.append('text')
            .attr('class', 'y-label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -this.margin.left + 15)
            .text('Number of Transactions');

        this.timeSeriesChart = svg;
    },

    updateTimeSeriesChart(data, timeFrame = 'monthly') {
        if (!data || !this.timeSeriesChart) return;

        const container = document.getElementById('timeSeriesChart');
        const width = container.clientWidth - this.margin.left - this.margin.right;
        const height = 400 - this.margin.top - this.margin.bottom;

        // Parse dates
        const parseDate = d3.timeParse("%Y-%m");
        const formatDate = d3.timeFormat("%Y-%m");

        // Scales
        const x = d3.scaleTime()
            .domain(d3.extent(data, d => parseDate(d.date)))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .range([height, 0])
            .nice();

        // Line generator
        const line = d3.line()
            .defined(d => !isNaN(d.count))
            .x(d => x(parseDate(d.date)))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Update axes
        const xAxis = d3.axisBottom(x)
            .ticks(width > 600 ? 10 : 5)
            .tickFormat(d3.timeFormat(timeFrame === 'yearly' ? "%Y" : "%Y-%m"));

        const yAxis = d3.axisLeft(y)
            .ticks(height / 50);

        this.timeSeriesChart.select('.x-axis')
            .transition()
            .duration(1000)
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        this.timeSeriesChart.select('.y-axis')
            .transition()
            .duration(1000)
            .call(yAxis);

        // Update or create line
        const path = this.timeSeriesChart.selectAll('.line')
            .data([data.filter(d => d.count != null)]);

        path.enter()
            .append('path')
            .attr('class', 'line')
            .merge(path)
            .transition()
            .duration(1000)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5);

        // Update points
        const points = this.timeSeriesChart.selectAll('.point')
            .data(data.filter(d => d.count != null));

        const pointsEnter = points.enter()
            .append('circle')
            .attr('class', 'point');

        points.merge(pointsEnter)
            .transition()
            .duration(1000)
            .attr('cx', d => x(parseDate(d.date)))
            .attr('cy', d => y(d.count))
            .attr('r', 4)
            .attr('fill', 'steelblue');

        // Add tooltips
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'white')
            .style('padding', '10px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '3px')
            .style('pointer-events', 'none');

        points.merge(pointsEnter)
            .on('mouseover', (event, d) => {
                const typeBreakdown = Array.from(d.byType.entries())
                    .map(([type, transactions]) => `${type}: ${transactions.length}`)
                    .join('<br>');

                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`
                    <strong>Date:</strong> ${d.date}<br>
                    <strong>Transactions:</strong> ${d.count}<br>
                    <strong>Transfers:</strong> ${d.transfers}<br>
                    <strong>Total Value:</strong> ${d.totalValue?.toFixed(2) || 'N/A'}<br>
                    <br>
                    <strong>By Type:</strong><br>
                    ${typeBreakdown}
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        points.exit().remove();
        path.exit().remove();
    },

    createNetworkChart() {
        const container = document.getElementById('networkChart');
        if (!container) return;

        container.innerHTML = '';
        const width = container.clientWidth;
        const height = 400;

        const svg = d3.select('#networkChart')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        this.networkChart = svg;
    },

    updateNetworkChart(data) {
        if (!data || !this.networkChart) return;

        const container = document.getElementById('networkChart');
        const width = container.clientWidth;
        const height = 400;

        // Clear existing content
        this.networkChart.selectAll('*').remove();

        // Create force simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links)
                .id(d => d.id)
                .distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Create links
        const link = this.networkChart.append('g')
            .selectAll('line')
            .data(data.links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.sqrt(d.value));

        // Create nodes
        const node = this.networkChart.append('g')
            .selectAll('g')
            .data(data.nodes)
            .enter()
            .append('g')
            .call(d3.drag()
                .on('start', this.dragstarted(simulation))
                .on('drag', this.dragged())
                .on('end', this.dragended(simulation)));

        // Add circles to nodes
        node.append('circle')
            .attr('r', 10)
            .attr('fill', d => this.colors[d.group % this.colors.length]);

        // Add labels to nodes
        node.append('text')
            .text(d => d.name)
            .attr('x', 12)
            .attr('y', 4)
            .style('font-size', '10px');

        // Add tooltips
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        node.on('mouseover', (event, d) => {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`
                <strong>${d.name}</strong><br>
                Type: ${d.type}<br>
                Connections: ${data.links.filter(l => 
                    l.source.id === d.id || l.target.id === d.id
                ).length}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => Math.max(0, Math.min(width, d.source.x)))
                .attr('y1', d => Math.max(0, Math.min(height, d.source.y)))
                .attr('x2', d => Math.max(0, Math.min(width, d.target.x)))
                .attr('y2', d => Math.max(0, Math.min(height, d.target.y)));

            node
                .attr('transform', d => `translate(${
                    Math.max(0, Math.min(width, d.x))
                },${
                    Math.max(0, Math.min(height, d.y))
                })`);
        });
    },

    dragstarted(simulation) {
        return function(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        };
    },

    dragged() {
        return function(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        };
    },

    dragended(simulation) {
        return function(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        };
    },

    createDistributionChart() {
        const container = document.getElementById('distributionChart');
        if (!container) return;

        container.innerHTML = '';
        const width = container.clientWidth - this.margin.left - this.margin.right;
        const height = 300 - this.margin.top - this.margin.bottom;

        const svg = d3.select('#distributionChart')
            .append('svg')
            .attr('width', width + this.margin.left + this.margin.right)
            .attr('height', height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.distributionChart = svg;
    },

    updateDistributionChart(data) {
        // Implementation for distribution chart
        // Will be added in next iteration
    },

    createSeasonalChart() {
        const container = document.getElementById('seasonalHeatmap');
        if (!container) return;

        container.innerHTML = '';
        const width = container.clientWidth - this.margin.left - this.margin.right;
        const height = 300 - this.margin.top - this.margin.bottom;

        const svg = d3.select('#seasonalHeatmap')
            .append('svg')
            .attr('width', width + this.margin.left + this.margin.right)
            .attr('height', height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.seasonalChart = svg;
    },

    updateSeasonalChart(data, normalize = false) {
        // Implementation for seasonal heatmap
        // Will be added in next iteration
    },

    updateAllCharts(data) {
        if (!data) return;

        this.updateTimeSeriesChart(data.timeSeriesData);
        this.updateNetworkChart(data.networkData);
        // Add other chart updates as needed
    }
};