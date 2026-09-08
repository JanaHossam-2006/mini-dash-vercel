/**
 * API Layer - Database Operations
 * All Supabase operations are centralized here
 *
 * IMPORTANT: Dashboard reads directly from orders table.
 * Calculated columns (delivered, filter, delivery_filter, dashboard_filter)
 * are stored in the database — NOT recalculated in the frontend.
 *
 * PERFORMANCE: fetchAllWithPagination is called ONCE per user action.
 * All filter/stat/timeseries logic runs in-memory on the cached rows.
 */

var supabase = window.supabaseClient;

const BATCH_SIZE = 1000;

/* ─────────────────────────────────────────────────────────────────────────────
   FETCH — single source of truth for reading orders from Supabase
───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch every visible order (dashboard_filter IS NULL or != 'Ignore').
 * Automatically pages through 1000-row batches until all rows are loaded.
 */
async function fetchAllOrders() {
    let allData = [];
    let from = 0;
    let totalCount = null;

    while (true) {
        const to = from + BATCH_SIZE - 1;

        const { data, error, count } = await supabase
            .from('orders')
            .select('*', { count: 'exact' })
            .or('dashboard_filter.is.null,dashboard_filter.neq.Ignore')
            .range(from, to);

        if (error) {
            if (allData.length === 0) throw error;
            break;
        }

        if (data && data.length > 0) {
            allData = allData.concat(data);
        }

        if (totalCount === null && count !== null) totalCount = count;

        const fetched = allData.length;
        const more    = totalCount !== null ? fetched < totalCount : (data && data.length === BATCH_SIZE);
        if (!more) break;

        from = to + 1;
    }

    return allData;
}

/* ─────────────────────────────────────────────────────────────────────────────
   IN-MEMORY HELPERS  (pure functions — no network calls)
───────────────────────────────────────────────────────────────────────────── */

/**
 * Parse an order_date string (YYYY-MM-DD) safely into a UTC Date.
 * Returns null if the value is missing or invalid.
 */
function parseOrderDate(raw) {
    if (!raw) return null;
    const d = typeof raw === 'string' ? new Date(raw + 'T00:00:00Z') : new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Apply the current filter selections to a flat rows array.
 * Returns a new sorted array — does NOT mutate the input.
 */
function applyFilters(rows, filters) {
    let out = rows;

    const match = (value, filter) => {
        if (!filter || filter === 'all') return true;
        if (Array.isArray(filter)) return filter.length === 0 || filter.includes(value);
        return value === filter;
    };

    if (!match(null, filters.employee))       out = out.filter(r => match(r.employee_name,    filters.employee));
    if (!match(null, filters.store))          out = out.filter(r => match(r.store,             filters.store));
    if (!match(null, filters.clientStatus))   out = out.filter(r => match(r.client_status,     filters.clientStatus));
    if (!match(null, filters.shipmentStatus)) out = out.filter(r => match(r.shipment_status,   filters.shipmentStatus));
    if (!match(null, filters.shippingCompany))out = out.filter(r => match(r.shipping_company,  filters.shippingCompany));
    if (!match(null, filters.deliveryStatus)) out = out.filter(r => match(r.delivered,          filters.deliveryStatus));

    if (filters.months && filters.months.length > 0) {
        out = out.filter(r => {
            const d = parseOrderDate(r.order_date);
            return d && filters.months.includes(d.getUTCMonth() + 1);
        });
    }

    if (filters.days && filters.days.length > 0) {
        out = out.filter(r => {
            const d = parseOrderDate(r.order_date);
            return d && filters.days.includes(d.getUTCDate());
        });
    }

    // Sort newest-first (string comparison works for YYYY-MM-DD)
    out = out.slice().sort((a, b) => {
        if (!a.order_date) return  1;
        if (!b.order_date) return -1;
        return b.order_date < a.order_date ? -1 : b.order_date > a.order_date ? 1 : 0;
    });

    return out;
}

/**
 * Derive dropdown filter options from a full-dataset array.
 */
function extractFilterOptions(rows) {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    return {
        employees:        uniq(rows.map(r => r.employee_name)),
        stores:           uniq(rows.map(r => r.store)),
        clientStatuses:   uniq(rows.map(r => r.client_status)),
        shipmentStatuses: uniq(rows.map(r => r.shipment_status)),
        shippingCompanies:uniq(rows.map(r => r.shipping_company)),
        deliveryStatuses: ['yes', 'no']
    };
}

/**
 * Derive date filter options (unique months + days) from a full-dataset array.
 */
function extractDateFilterOptions(rows) {
    const months = new Set();
    const days   = new Set();
    rows.forEach(r => {
        const d = parseOrderDate(r.order_date);
        if (d) { months.add(d.getUTCMonth() + 1); days.add(d.getUTCDate()); }
    });
    return {
        months: [...months].sort((a, b) => a - b),
        days:   [...days].sort((a, b) => a - b)
    };
}

/**
 * Build time-series aggregation from pre-filtered rows.
 * Returns the same shape that Charts.updateTimeSeriesChart expects.
 */
function buildTimeSeriesFromRows(filteredRows, filters) {
    const showDaily     = filters.months && filters.months.length === 1 && (!filters.days || filters.days.length === 0);
    const selectedMonth = showDaily ? filters.months[0] : null;

    const buckets = {};

    filteredRows.forEach(row => {
        const d = parseOrderDate(row.order_date);
        if (!d) return;

        let key, label;

        if (showDaily) {
            if (d.getUTCMonth() + 1 !== selectedMonth) return;
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            key = label = `${d.getUTCFullYear()}-${mm}-${dd}`;
        } else {
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            key = label = `${d.getUTCFullYear()}-${mm}`;
        }

        if (!buckets[key]) {
            buckets[key] = { label, totalOrders: 0, delivered: 0, notDelivered: 0, deliveryRate: 0 };
        }

        buckets[key].totalOrders++;
        if (row.delivered === 'yes') buckets[key].delivered++;
        else                         buckets[key].notDelivered++;
    });

    // Delivery rates
    Object.values(buckets).forEach(b => {
        const t = b.delivered + b.notDelivered;
        b.deliveryRate = t > 0 ? (b.delivered / t) * 100 : 0;
    });

    // Sort chronologically
    const sorted = {};
    Object.keys(buckets)
        .sort((a, b) => a < b ? -1 : a > b ? 1 : 0)
        .forEach(k => { sorted[k] = buckets[k]; });

    // Stats (highest / lowest delivery rate)
    const vals = Object.values(sorted);
    let highest = vals[0], lowest = vals[0];
    vals.forEach(v => {
        if (v.deliveryRate > highest.deliveryRate) highest = v;
        if (v.deliveryRate < lowest.deliveryRate)  lowest  = v;
    });

    const stats = vals.length ? {
        highest:    { period: highest.label, rate: highest.deliveryRate.toFixed(1), total: highest.totalOrders, delivered: highest.delivered },
        lowest:     { period: lowest.label,  rate: lowest.deliveryRate.toFixed(1),  total: lowest.totalOrders,  delivered: lowest.delivered  },
        periodType: showDaily ? 'يوم' : 'شهر'
    } : null;

    return { data: sorted, isDaily: showDaily, selectedMonth, stats };
}

/* ─────────────────────────────────────────────────────────────────────────────
   STAT CALCULATORS  (pure, no network)
───────────────────────────────────────────────────────────────────────────── */

function calculateKPIs(rows) {
    let delivered = 0, notDelivered = 0, withData = 0;

    rows.forEach(r => {
        if (r.delivered != null) {
            withData++;
            if (r.delivered === 'yes') delivered++;
            else notDelivered++;
        }
    });

    const noResp = rows.filter(r => r.client_status === 'لم يرد إطلاقا');
    let totalAttempts = 0, validRows = 0;
    noResp.forEach(r => {
        const a = parseInt(r.call_attempts) || 0;
        if (a > 0) { totalAttempts += a; validRows++; }
    });

    return {
        totalOrders:               rows.length,
        totalOrdersWithDeliveryData: withData,
        deliveredOrders:           delivered,
        notDeliveredOrders:        notDelivered,
        deliveryPercentage:        withData > 0 ? ((delivered    / withData) * 100).toFixed(1) : '0',
        notDeliveredPercentage:    withData > 0 ? ((notDelivered / withData) * 100).toFixed(1) : '0',
        averageCallAttempts:       validRows > 0 ? (totalAttempts / validRows).toFixed(1) : '0',
        noResponseOrdersCount:     noResp.length
    };
}

function getEmployeeStats(rows) {
    const EXCLUDED = ['موظفات سابقات', 'احتياطي'];
    const m = {};
    rows.forEach(r => {
        const k = r.employee_name; if (!k) return;
        if (!m[k]) m[k] = { employee: k, totalOrders: 0, delivered: 0, notDelivered: 0, deliveryOrders: 0, deliveryRate: 0, excluded: EXCLUDED.includes(k) };
        m[k].totalOrders++;
        if (r.delivered != null) {
            m[k].deliveryOrders++;
            if (r.delivered === 'yes') m[k].delivered++; else m[k].notDelivered++;
        }
    });

    const all = Object.values(m).map(s => {
        s.deliveryRate = s.deliveryOrders > 0 ? (s.delivered / s.deliveryOrders) * 100 : 0;
        return s;
    });

    // Separate active vs excluded
    const active   = all.filter(s => !s.excluded).sort((a, b) => b.deliveryRate - a.deliveryRate);
    const excluded = all.filter(s =>  s.excluded).sort((a, b) => b.totalOrders  - a.totalOrders);

    // Assign rank-based color tier to active employees
    const count = active.length;
    active.forEach((s, i) => {
        const pct = count > 1 ? i / (count - 1) : 0; // 0 = top, 1 = bottom
        if      (pct <= 0.20) s.rankTier = 'excellent'; // top 20%
        else if (pct <= 0.40) s.rankTier = 'high';
        else if (pct <= 0.60) s.rankTier = 'medium';
        else if (pct <= 0.80) s.rankTier = 'low';
        else                  s.rankTier = 'critical';  // bottom 20%
    });

    return [...active, ...excluded];
}

function getStoreStats(rows) {
    const m = {};
    rows.forEach(r => {
        const k = r.store; if (!k) return;
        if (!m[k]) m[k] = { store: k, totalOrders: 0, delivered: 0, notDelivered: 0, deliveryOrders: 0, deliveryRate: 0 };
        m[k].totalOrders++;
        if (r.delivered != null) {
            m[k].deliveryOrders++;
            if (r.delivered === 'yes') m[k].delivered++; else m[k].notDelivered++;
        }
    });

    const all = Object.values(m).map(s => {
        s.deliveryRate = s.deliveryOrders > 0 ? (s.delivered / s.deliveryOrders) * 100 : 0;
        return s;
    }).sort((a, b) => b.deliveryRate - a.deliveryRate);

    const count = all.length;
    all.forEach((s, i) => {
        const pct = count > 1 ? i / (count - 1) : 0;
        s.rankTier = pct <= 0.20 ? 'excellent' : pct <= 0.40 ? 'high' : pct <= 0.60 ? 'medium' : pct <= 0.80 ? 'low' : 'critical';
    });

    return all;
}

function getShipmentStats(rows) {
    const m = {};
    rows.filter(r => r.client_status === 'رد و يستلم').forEach(r => {
        const k = r.shipment_status; if (!k) return;
        if (!m[k]) m[k] = { status: k, totalOrders: 0, delivered: 0, notDelivered: 0, deliveryRate: 0 };
        m[k].totalOrders++;
        if (r.delivered === 'yes') m[k].delivered++; else m[k].notDelivered++;
    });

    const all = Object.values(m).map(s => {
        const t = s.delivered + s.notDelivered;
        s.deliveryRate = t > 0 ? (s.delivered / t) * 100 : 0;
        return s;
    }).sort((a, b) => b.deliveryRate - a.deliveryRate);

    const count = all.length;
    all.forEach((s, i) => {
        const pct = count > 1 ? i / (count - 1) : 0;
        s.rankTier = pct <= 0.20 ? 'excellent' : pct <= 0.40 ? 'high' : pct <= 0.60 ? 'medium' : pct <= 0.80 ? 'low' : 'critical';
    });

    return all;
}

function getClientStatusStats(rows) {
    const EXCLUDED = ['استلم'];
    const m = {}, total = rows.length;
    rows.forEach(r => {
        const k = r.client_status; if (!k) return;
        if (!m[k]) m[k] = { status: k, totalOrders: 0, delivered: 0, notDelivered: 0, deliveryRate: 0, percentage: 0, excluded: EXCLUDED.includes(k) };
        m[k].totalOrders++;
        if (r.delivered === 'yes') m[k].delivered++;
        else if (r.delivered === 'no') m[k].notDelivered++;
    });

    const all = Object.values(m).map(s => {
        const t = s.delivered + s.notDelivered;
        s.deliveryRate = t > 0 ? (s.delivered / t) * 100 : 0;
        s.percentage   = total > 0 ? (s.totalOrders / total) * 100 : 0;
        return s;
    });

    const active   = all.filter(s => !s.excluded).sort((a, b) => b.deliveryRate - a.deliveryRate);
    const excluded = all.filter(s =>  s.excluded).sort((a, b) => b.totalOrders  - a.totalOrders);

    const count = active.length;
    active.forEach((s, i) => {
        const pct = count > 1 ? i / (count - 1) : 0;
        s.rankTier = pct <= 0.20 ? 'excellent' : pct <= 0.40 ? 'high' : pct <= 0.60 ? 'medium' : pct <= 0.80 ? 'low' : 'critical';
    });

    return [...active, ...excluded];
}

function getCallAttemptsStats(rows) {
    const m = {};
    rows.filter(r => r.client_status === 'لم يرد إطلاقا').forEach(r => {
        const k = r.employee_name; if (!k) return;
        if (!m[k]) m[k] = { employee: k, totalOrders: 0, lowAttempts: 0, highAttempts: 0, totalCallAttempts: 0, averageAttempts: 0 };
        m[k].totalOrders++;
        const a = parseInt(r.call_attempts) || 0;
        if (a > 0) {
            m[k].totalCallAttempts += a;
            if (a <= 5) m[k].lowAttempts++; else m[k].highAttempts++;
        }
    });
    const result = Object.values(m).map(s => {
        s.averageAttempts = s.totalOrders > 0 ? s.totalCallAttempts / s.totalOrders : 0;
        return s;
    }).sort((a, b) => b.averageAttempts - a.averageAttempts);

    // Rank-based color tier (higher average = better)
    const count = result.length;
    result.forEach((s, i) => {
        const pct = count > 1 ? i / (count - 1) : 0;
        s.rankTier = pct <= 0.20 ? 'excellent' : pct <= 0.40 ? 'high' : pct <= 0.60 ? 'medium' : pct <= 0.80 ? 'low' : 'critical';
    });

    return result;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────────────────────────── */

const API = {

    applyFilters,

    /**
     * Initial load: ONE Supabase fetch, everything else is in-memory.
     * Returns filterOptions, dateFilterOptions, dashboardData (+ timeSeriesData).
     */
    async getDashboardInitData(filters) {
        try {
            const allRows = await fetchAllOrders();               // ← 1 fetch only

            const filterOptions     = extractFilterOptions(allRows);
            const dateFilterOptions = extractDateFilterOptions(allRows);
            const filteredRows      = applyFilters(allRows, filters);
            const dashboardData     = this.processDashboardData(filteredRows);
            dashboardData.timeSeriesData = buildTimeSeriesFromRows(filteredRows, filters);

            return {
                success: true,
                allRows,                                          // returned so Dashboard can cache it
                data: { filterOptions, dateFilterOptions, dashboardData }
            };
        } catch (error) {
            console.error('getDashboardInitData error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Re-filter cached rows and recompute everything in-memory — no network call.
     * Falls back to a fresh fetch if no cached rows are provided.
     */
    computeFromRows(cachedRows, filters) {
        const filteredRows  = applyFilters(cachedRows, filters);
        const dashboardData = this.processDashboardData(filteredRows);
        dashboardData.timeSeriesData = buildTimeSeriesFromRows(filteredRows, filters);
        return { success: true, data: dashboardData };
    },

    /**
     * Refresh: force a new fetch and recompute everything.
     * Use when the underlying data may have changed.
     */
    async refreshAllData(filters) {
        try {
            const allRows       = await fetchAllOrders();         // ← 1 fresh fetch
            const filteredRows  = applyFilters(allRows, filters);
            const dashboardData = this.processDashboardData(filteredRows);
            dashboardData.timeSeriesData = buildTimeSeriesFromRows(filteredRows, filters);
            return { success: true, allRows, data: dashboardData };
        } catch (error) {
            console.error('refreshAllData error:', error);
            return { success: false, error: error.message };
        }
    },

    processDashboardData(rows) {
        return {
            kpis:              calculateKPIs(rows),
            employeeStats:     getEmployeeStats(rows),
            storeStats:        getStoreStats(rows),
            shipmentStats:     getShipmentStats(rows),
            clientStatusStats: getClientStatusStats(rows),
            callAttemptsStats: getCallAttemptsStats(rows),
            timeSeriesData:    null    // filled by caller
        };
    }
};

window.API = API;
