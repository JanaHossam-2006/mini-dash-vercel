/**
 * Charts Module - Chart.js configurations and updates
 * All stats are arrays: [{ key, totalOrders, delivered, notDelivered, deliveryRate }, ...]
 */

const Charts = {
    charts: {
        employee: null,
        shipment: null,
        store: null,
        callAttempts: null,
        clientStatus: null,
        timeSeries: null
    },

    /**
     * Update employee statistics chart
     */
    updateEmployeeChart(stats) {
        const ctx = document.getElementById('employeeChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.employee) this.charts.employee.destroy();

        if (!stats || stats.length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض');
            return;
        }

        // Top 10 by totalOrders
        const top10 = stats.slice(0, 10);
        const labels = top10.map(d => d.employee);
        const deliveredData = top10.map(d => d.delivered);
        const notDeliveredData = top10.map(d => d.notDelivered);

        this.charts.employee = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'مسلم',     data: deliveredData,    backgroundColor: 'rgba(16,185,129,0.8)', borderColor: 'rgba(16,185,129,1)', borderWidth: 2, borderRadius: 6 },
                    { label: 'غير مسلم', data: notDeliveredData, backgroundColor: 'rgba(239,68,68,0.8)',  borderColor: 'rgba(239,68,68,1)',  borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: this.getBarChartOptions('إحصائيات الموظفين')
        });
    },

    /**
     * Update shipment status chart (Doughnut)
     */
    updateShipmentChart(stats) {
        const ctx = document.getElementById('shipmentChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.shipment) this.charts.shipment.destroy();

        if (!stats || stats.length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض');
            return;
        }

        const totalDelivered    = stats.reduce((s, d) => s + d.delivered,    0);
        const totalNotDelivered = stats.reduce((s, d) => s + d.notDelivered, 0);

        this.charts.shipment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['مسلم', 'غير مسلم'],
                datasets: [{
                    data: [totalDelivered, totalNotDelivered],
                    backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'],
                    borderColor:     ['rgba(16,185,129,1)',   'rgba(239,68,68,1)'],
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: this.getDoughnutChartOptions('توزيع حالة التسليم')
        });
    },

    /**
     * Update store chart (Stacked bar)
     */
    updateStoreChart(stats) {
        const ctx = document.getElementById('storeChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.store) this.charts.store.destroy();

        if (!stats || stats.length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض');
            return;
        }

        const top10 = stats.slice(0, 10);
        const labels = top10.map(d => d.store);
        const deliveredData    = top10.map(d => d.delivered);
        const notDeliveredData = top10.map(d => d.notDelivered);

        this.charts.store = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'مسلم',     data: deliveredData,    backgroundColor: 'rgba(16,185,129,0.8)', borderColor: 'rgba(16,185,129,1)', borderWidth: 2, borderRadius: 6 },
                    { label: 'غير مسلم', data: notDeliveredData, backgroundColor: 'rgba(239,68,68,0.8)',  borderColor: 'rgba(239,68,68,1)',  borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: this.getStackedBarChartOptions('إحصائيات المتاجر')
        });
    },

    /**
     * Update call attempts chart (Stacked bar)
     */
    updateCallAttemptsChart(stats) {
        const ctx = document.getElementById('callAttemptsChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.callAttempts) this.charts.callAttempts.destroy();

        if (!stats || stats.length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض');
            return;
        }

        const top10 = stats.slice(0, 10);
        const labels       = top10.map(d => d.employee);
        const lessEqual5   = top10.map(d => d.lowAttempts);
        const moreThan5    = top10.map(d => d.highAttempts);

        this.charts.callAttempts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: '≤5 محاولات', data: lessEqual5, backgroundColor: 'rgba(16,185,129,0.8)', borderColor: 'rgba(16,185,129,1)', borderWidth: 2, borderRadius: 6 },
                    { label: '>5 محاولات', data: moreThan5,  backgroundColor: 'rgba(239,68,68,0.8)',  borderColor: 'rgba(239,68,68,1)',  borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: this.getStackedBarChartOptions('محاولات الاتصال حسب الموظف')
        });
    },

    /**
     * Update client status chart (Doughnut)
     */
    updateClientStatusChart(stats) {
        const ctx = document.getElementById('clientStatusChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.clientStatus) this.charts.clientStatus.destroy();

        if (!stats || stats.length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض');
            return;
        }

        const labels = stats.map(d => d.status);
        const data   = stats.map(d => d.totalOrders);

        const colors = [
            'rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)',
            'rgba(59,130,246,0.8)', 'rgba(245,158,11,0.8)',
            'rgba(139,92,246,0.8)', 'rgba(236,72,153,0.8)',
            'rgba(14,165,233,0.8)', 'rgba(34,197,94,0.8)'
        ];

        this.charts.clientStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor:     colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'توزيع حالات العملاء', font: { size: 18, weight: 'bold' }, color: '#F3F4F6' },
                    legend: { position: 'bottom', labels: { font: { size: 12, weight: '600' }, padding: 15, usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((s, v) => s + v, 0);
                                const pct   = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${formatNumberEnglish(value)} (${formatNumberEnglish(pct)}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Update time series chart
     */
    updateTimeSeriesChart(timeSeriesData) {
        const ctx = document.getElementById('timeSeriesChart')?.getContext('2d');
        if (!ctx) return;
        if (this.charts.timeSeries) this.charts.timeSeries.destroy();

        if (!timeSeriesData || !timeSeriesData.data || Object.keys(timeSeriesData.data).length === 0) {
            this.showEmptyState(ctx, 'لا توجد بيانات للعرض في هذه الفترة');
            return;
        }

        const data          = timeSeriesData.data;
        const isDaily       = timeSeriesData.isDaily;
        const selectedMonth = timeSeriesData.selectedMonth;

        // Info text
        const infoEl = document.getElementById('timeSeriesInfo');
        if (infoEl) {
            if (isDaily && selectedMonth) {
                const names = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
                infoEl.innerHTML = `<i class="ri-calendar-event-line"></i> عرض البيانات اليومية لشهر ${names[selectedMonth]}`;
            } else {
                infoEl.innerHTML = '<i class="ri-calendar-line"></i> عرض البيانات الشهرية';
            }
        }

        const labels           = Object.values(data).map(d => d.label);
        const deliveredData    = Object.values(data).map(d => d.delivered    || 0);
        const notDeliveredData = Object.values(data).map(d => d.notDelivered || 0);

        const totalDelivered    = deliveredData.reduce((s, v) => s + v, 0);
        const totalNotDelivered = notDeliveredData.reduce((s, v) => s + v, 0);
        const totalOrders       = totalDelivered + totalNotDelivered;
        const overallRate       = totalOrders > 0 ? ((totalDelivered / totalOrders) * 100).toFixed(1) : 0;

        // Summary bar
        let summaryHTML = `
            <div class="summary-item delivered"><i class="ri-checkbox-circle-fill"></i><span>مسلم: ${formatNumberEnglish(totalDelivered)}</span></div>
            <div class="summary-item not-delivered"><i class="ri-close-circle-fill"></i><span>غير مسلم: ${formatNumberEnglish(totalNotDelivered)}</span></div>
            <div class="summary-item rate"><i class="ri-percent-line"></i><span>النسبة: ${formatNumberEnglish(overallRate)}%</span></div>
        `;

        if (timeSeriesData.stats) {
            const s = timeSeriesData.stats;
            summaryHTML += `
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);width:100%;">
                    <div class="summary-item" style="color:#10B981;border-color:rgba(16,185,129,0.3);">
                        <i class="ri-arrow-up-line"></i>
                        <span>أعلى ${s.periodType}: ${s.highest.period} (${formatNumberEnglish(s.highest.rate)}%)</span>
                    </div>
                    <div class="summary-item" style="color:#EF4444;border-color:rgba(239,68,68,0.3);">
                        <i class="ri-arrow-down-line"></i>
                        <span>أقل ${s.periodType}: ${s.lowest.period} (${formatNumberEnglish(s.lowest.rate)}%)</span>
                    </div>
                </div>`;
        }

        const summaryEl = document.getElementById('timeSeriesSummary');
        if (summaryEl) summaryEl.innerHTML = summaryHTML;

        this.charts.timeSeries = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'مسلم',     data: deliveredData,    backgroundColor: 'rgba(16,185,129,0.8)', borderColor: 'rgba(16,185,129,1)', borderWidth: 2, borderRadius: 6 },
                    { label: 'غير مسلم', data: notDeliveredData, backgroundColor: 'rgba(239,68,68,0.8)',  borderColor: 'rgba(239,68,68,1)',  borderWidth: 2, borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: isDaily ? 'الطلبات اليومية' : 'الطلبات الشهرية', font: { size: 18, weight: 'bold' }, color: '#F3F4F6' },
                    legend: { position: 'top', labels: { font: { size: 14, weight: '600' } } },
                    tooltip: {
                        mode: 'index', intersect: false,
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumberEnglish(ctx.parsed.y)}` }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => formatNumberEnglish(v) }, grid: { color: 'rgba(255,255,255,0.08)' } },
                    x: { grid: { display: false } }
                },
                interaction: { mode: 'index', intersect: false }
            }
        });
    },

    // ── helpers ──────────────────────────────────────────────────────────────

    showEmptyState(ctx, message) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = '16px Tajawal, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
    },

    getBarChartOptions(title) {
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 18, weight: 'bold' }, color: '#F3F4F6' },
                legend: { position: 'top', labels: { font: { size: 14, weight: '600' } } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => formatNumberEnglish(v) }, grid: { color: 'rgba(255,255,255,0.08)' } },
                x: { ticks: { maxRotation: 45 }, grid: { display: false } }
            },
            interaction: { intersect: false, mode: 'index' }
        };
    },

    getStackedBarChartOptions(title) {
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 18, weight: 'bold' }, color: '#F3F4F6' },
                legend: { position: 'top', labels: { font: { size: 14, weight: '600' } } }
            },
            scales: {
                x: { stacked: true, ticks: { maxRotation: 45 }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { callback: v => formatNumberEnglish(v) }, grid: { color: 'rgba(255,255,255,0.08)' } }
            },
            interaction: { intersect: false, mode: 'index' }
        };
    },

    getDoughnutChartOptions(title) {
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title, font: { size: 18, weight: 'bold' }, color: '#F3F4F6' },
                legend: { position: 'bottom', labels: { font: { size: 14, weight: '600' }, padding: 20 } },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((s, v) => s + v, 0);
                            const pct   = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatNumberEnglish(value)} (${formatNumberEnglish(pct)}%)`;
                        }
                    }
                }
            }
        };
    },

    destroyAll() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) { this.charts[key].destroy(); this.charts[key] = null; }
        });
    }
};

window.Charts = Charts;
