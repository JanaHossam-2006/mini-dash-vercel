/**
 * Dashboard Module
 *
 * PERFORMANCE STRATEGY:
 *   - Initial load: 1 Supabase fetch → cache allRows in this.cachedRows
 *   - Every filter change: 0 fetches → re-filter cachedRows in-memory
 *   - Explicit refresh (retry): 1 fresh fetch
 */

const Dashboard = {

    currentFilters: {
        employee: 'all', store: 'all', shipmentStatus: 'all',
        clientStatus: 'all', deliveryStatus: 'all', shippingCompany: 'all',
        months: [], days: []
    },

    filterOptions:     null,
    dateFilterOptions: null,
    cachedRows:        null,   // full unfiltered dataset from Supabase

    /* ── init ────────────────────────────────────────────────────────────── */

    async init() {
        if (window.Chart) {
            Chart.defaults.color       = '#9CA3AF';
            Chart.defaults.font.family = "'Tajawal', sans-serif";
        }
        await Filters.init();
        await this.loadDashboard();
    },

    /* ── initial load ────────────────────────────────────────────────────── */

    async loadDashboard() {
        this.showLoading();
        try {
            // ONE fetch; everything else is in-memory
            const result = await API.getDashboardInitData(this.currentFilters);

            if (!result.success) { this.showError(); return; }

            // Cache the full unfiltered dataset for instant re-filtering
            this.cachedRows        = result.allRows;
            this.filterOptions     = result.data.filterOptions;
            this.dateFilterOptions = result.data.dateFilterOptions;

            Filters.populateFilterDropdowns(this.filterOptions);
            Filters.populateDateFilterDropdowns(this.dateFilterOptions);

            this.updateDashboard(result.data.dashboardData);
            this.hideLoading();

        } catch (error) {
            console.error('loadDashboard error:', error);
            this.showError();
        }
    },

    /* ── filter change (zero network calls) ─────────────────────────────── */

    loadData(filters) {
        this.currentFilters = { ...filters };

        document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
            .forEach(el => el?.classList.add('updating'));

        try {
            if (!this.cachedRows) {
                // Fallback: no cache yet — do a fresh fetch
                this.refreshData();
                return;
            }

            // Pure in-memory: 0 network calls
            const result = API.computeFromRows(this.cachedRows, this.currentFilters);

            document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
                .forEach(el => el?.classList.remove('updating'));

            if (result.success) this.updateDashboard(result.data);

        } catch (error) {
            console.error('loadData error:', error);
            document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
                .forEach(el => el?.classList.remove('updating'));
        }
    },

    /* ── explicit refresh (re-fetches from Supabase) ─────────────────────── */

    async refreshData() {
        document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
            .forEach(el => el?.classList.add('updating'));
        try {
            const result = await API.refreshAllData(this.currentFilters);

            document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
                .forEach(el => el?.classList.remove('updating'));

            if (!result.success) { this.showError(); return; }

            this.cachedRows = result.allRows;
            this.updateDashboard(result.data);

        } catch (error) {
            console.error('refreshData error:', error);
            document.querySelectorAll('.table-container, .chart-container, .kpis-grid')
                .forEach(el => el?.classList.remove('updating'));
        }
    },

    /* ── render ──────────────────────────────────────────────────────────── */

    updateDashboard(data) {
        try {
            if (data.kpis)              this.updateKPIs(data.kpis);
            if (data.employeeStats)     { this.updateGenericTable('employeeTableBody',     data.employeeStats,     this.getEmployeeRow);     Charts.updateEmployeeChart(data.employeeStats); }
            if (data.shipmentStats)     { this.updateGenericTable('shipmentTableBody',     data.shipmentStats,     this.getShipmentRow);     Charts.updateShipmentChart(data.shipmentStats); }
            if (data.storeStats)        { this.updateGenericTable('storeTableBody',        data.storeStats,        this.getStoreRow);        Charts.updateStoreChart(data.storeStats); }
            if (data.callAttemptsStats) { this.updateGenericTable('callAttemptsTableBody', data.callAttemptsStats, this.getCallAttemptsRow); Charts.updateCallAttemptsChart(data.callAttemptsStats); }
            if (data.clientStatusStats) { this.updateGenericTable('clientStatusTableBody', data.clientStatusStats, this.getClientStatusRow); Charts.updateClientStatusChart(data.clientStatusStats); }
            if (data.timeSeriesData)    { Charts.updateTimeSeriesChart(data.timeSeriesData); }
        } catch (error) {
            console.error('updateDashboard error:', error);
        }
    },

    updateKPIs(kpis) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('totalOrders',            formatNumberEnglish(kpis.totalOrders));
        set('deliveredOrders',        formatNumberEnglish(kpis.deliveredOrders));
        set('notDeliveredOrders',     formatNumberEnglish(kpis.notDeliveredOrders));
        set('deliveryPercentage',     formatNumberEnglish(parseFloat(kpis.deliveryPercentage).toFixed(1)) + '%');
        set('notDeliveredPercentage', formatNumberEnglish(parseFloat(kpis.notDeliveredPercentage).toFixed(1)) + '%');
        set('averageCallAttempts',    formatNumberEnglish(parseFloat(kpis.averageCallAttempts).toFixed(1)));
    },

    /* ── generic table helper ────────────────────────────────────────────── */

    updateGenericTable(bodyId, stats, rowFn) {
        const body = document.getElementById(bodyId);
        if (!body) return;
        body.innerHTML = '';

        if (!stats || stats.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">لا توجد بيانات</td></tr>';
            return;
        }

        stats.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = rowFn.call(this, item);

            // Excluded rows — no color, dimmed
            if (!item.excluded && item.rankTier) {
                row.classList.add(`row-level-${item.rankTier}`);
            } else if (item.excluded) {
                row.style.opacity = '0.5';
            }

            body.appendChild(row);
        });
    },

    /* ── row generators ──────────────────────────────────────────────────── */

    _rateClass(r) {
        return r >= 90 ? 'delivery-rate-excellent' : r >= 80 ? 'delivery-rate-high' : r >= 70 ? 'delivery-rate-medium' : r >= 60 ? 'delivery-rate-low' : 'delivery-rate-critical';
    },

    getEmployeeRow(item) {
        const c = item.excluded ? '' : `delivery-rate-${item.rankTier}`;
        return `<td>${item.employee}</td><td>${formatNumberEnglish(item.totalOrders)}</td><td>${formatNumberEnglish(item.delivered)}</td><td>${formatNumberEnglish(item.notDelivered)}</td><td class="${c}">${formatNumberEnglish(item.deliveryRate.toFixed(1))}%</td>`;
    },

    getShipmentRow(item) {
        const c = `delivery-rate-${item.rankTier}`;
        return `<td>${item.status}</td><td>${formatNumberEnglish(item.totalOrders)}</td><td>${formatNumberEnglish(item.delivered)}</td><td>${formatNumberEnglish(item.notDelivered)}</td><td class="${c}">${formatNumberEnglish(item.deliveryRate.toFixed(1))}%</td>`;
    },

    getStoreRow(item) {
        const c = `delivery-rate-${item.rankTier}`;
        return `<td>${item.store}</td><td>${formatNumberEnglish(item.totalOrders)}</td><td>${formatNumberEnglish(item.delivered)}</td><td>${formatNumberEnglish(item.notDelivered)}</td><td class="${c}">${formatNumberEnglish(item.deliveryRate.toFixed(1))}%</td>`;
    },

    getCallAttemptsRow(item) {
        const c = `delivery-rate-${item.rankTier}`;
        return `<td>${item.employee}</td><td>${formatNumberEnglish(item.totalOrders)}</td><td>${formatNumberEnglish(item.lowAttempts)}</td><td>${formatNumberEnglish(item.highAttempts)}</td><td class="${c}">${formatNumberEnglish(item.averageAttempts.toFixed(1))}</td>`;
    },

    getClientStatusRow(item) {
        const c = item.excluded ? '' : `delivery-rate-${item.rankTier}`;
        return `<td>${item.status}</td><td>${formatNumberEnglish(item.totalOrders)}</td><td>${formatNumberEnglish(item.percentage.toFixed(1))}%</td><td>${formatNumberEnglish(item.delivered)}</td><td>${formatNumberEnglish(item.notDelivered)}</td><td class="${c}">${formatNumberEnglish(item.deliveryRate.toFixed(1))}%</td>`;
    },

    /* ── loading / error states ──────────────────────────────────────────── */

    showLoading() {
        document.getElementById('loading')?.style.setProperty('display', 'block');
        document.getElementById('dashboard')?.style.setProperty('display', 'none');
        document.getElementById('error')?.style.setProperty('display', 'none');
    },

    hideLoading() {
        document.getElementById('loading')?.style.setProperty('display', 'none');
        document.getElementById('dashboard')?.style.setProperty('display', 'block');
        document.getElementById('error')?.style.setProperty('display', 'none');
    },

    showError() {
        document.getElementById('loading')?.style.setProperty('display', 'none');
        document.getElementById('dashboard')?.style.setProperty('display', 'none');
        document.getElementById('error')?.style.setProperty('display', 'block');
    },

    async retry() { await this.loadDashboard(); }
};

/* ── utility ────────────────────────────────────────────────────────────────── */

function formatNumberEnglish(value) {
    if (value === null || value === undefined || value === '') return '0';
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return String(value).replace(/[٠-٩]/g, c => map[c] || c);
}
