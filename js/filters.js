/**
 * Filters Module - Multi-select dropdown handling and filter management
 */

const Filters = {
    // Current filter state
    currentFilters: {
        employee: 'all',
        store: 'all',
        shipmentStatus: 'all',
        clientStatus: 'all',
        deliveryStatus: 'all',
        shippingCompany: 'all',
        months: [],
        days: []
    },

    // Multi-select state
    selectedEmployees: ['all'],
    selectedStores: ['all'],
    selectedShipmentStatuses: ['all'],
    selectedClientStatuses: ['all'],
    selectedDeliveryStatuses: ['all'],
    selectedMonths: [],
    selectedDays: [],

    /**
     * Initialize filters
     */
    async init() {
        // Set initial state
        this.selectedEmployees = ['all'];
        this.selectedStores = ['all'];
        this.selectedShipmentStatuses = ['all'];
        this.selectedClientStatuses = ['all'];
        this.selectedDeliveryStatuses = ['all'];
        this.selectedMonths = [];
        this.selectedDays = [];

        // Add event listeners
        this.addEventListeners();
    },

    /**
     * Add event listeners for dropdowns and outside clicks
     */
    addEventListeners() {
        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.multi-select-dropdown')) {
                this.closeAllDropdowns();
            }
        });
    },

    /**
     * Toggle dropdown visibility
     */
    toggleDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const button = dropdown.querySelector('.multi-select-button');
        const options = dropdown.querySelector('.multi-select-options');

        // Close other dropdowns
        document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
            if (dd.id !== dropdownId) {
                dd.querySelector('.multi-select-button')?.classList.remove('active');
                dd.querySelector('.multi-select-options')?.classList.remove('show');
                dd.classList.remove('active');
            }
        });

        // Toggle current dropdown
        button?.classList.toggle('active');
        options?.classList.toggle('show');

        if (!button?.classList.contains('active')) {
            dropdown.classList.remove('active');
        } else {
            dropdown.classList.add('active');
        }
    },

    /**
     * Close all dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
            dropdown.querySelector('.multi-select-button')?.classList.remove('active');
            dropdown.querySelector('.multi-select-options')?.classList.remove('show');
            dropdown.classList.remove('active');
        });
    },

    /**
     * Create safe ID for HTML elements
     */
    createSafeId(value) {
        if (!value) return 'empty';
        return value.toString().replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF_]/g, '');
    },

    /**
     * Populate filter dropdowns with options
     */
    populateFilterDropdowns(options) {
        // Employee filter
        this.populateMultiSelect('employee', options.employees, 'جميع الموظفين');

        // Store filter
        this.populateMultiSelect('store', options.stores, 'جميع المتاجر');

        // Shipment Status filter
        this.populateMultiSelect('shipmentStatus', options.shipmentStatuses, 'جميع الحالات');

        // Client Status filter
        this.populateMultiSelect('clientStatus', options.clientStatuses, 'جميع الحالات');

        // Delivery Status filter
        this.populateMultiSelect('deliveryStatus', options.deliveryStatuses.map(s => ({
            value: s,
            display: s === 'yes' ? 'مسلم' : s === 'no' ? 'غير مسلم' : s
        })), 'جميع الحالات');

        // Set default "All" selections
        this.selectAllOption('employee');
        this.selectAllOption('store');
        this.selectAllOption('shipmentStatus');
        this.selectAllOption('clientStatus');
        this.selectAllOption('deliveryStatus');
    },

    /**
     * Populate a multi-select dropdown
     */
    populateMultiSelect(type, items, allText) {
        const optionsContainer = document.getElementById(`${type}Options`);
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

        // Add "All" option
        const allOption = document.createElement('div');
        allOption.className = 'multi-select-option all-option';
        allOption.innerHTML = `
            <input type="checkbox" id="${type}_all" value="all" onchange="Filters.updateMultiSelect('${type}', 'all')">
            <label for="${type}_all">${allText}</label>
        `;
        optionsContainer.appendChild(allOption);

        // Add items
        items.forEach(item => {
            const value = typeof item === 'object' ? item.value : item;
            const display = typeof item === 'object' ? item.display : item;

            const option = document.createElement('div');
            option.className = 'multi-select-option';
            const safeId = this.createSafeId(value);
            option.innerHTML = `
                <input type="checkbox" id="${type}_${safeId}" value="${value}" onchange="Filters.updateMultiSelect('${type}', '${value}')">
                <label for="${type}_${safeId}">${display || value}</label>
            `;
            optionsContainer.appendChild(option);
        });
    },

    /**
     * Populate date filter dropdowns
     */
    populateDateFilterDropdowns(options) {
        if (!options || !options.months) return;

        const monthOptions = document.getElementById('monthOptions');
        if (monthOptions) {
            monthOptions.innerHTML = '';
            const monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            options.months.forEach(month => {
                const option = document.createElement('div');
                option.className = 'multi-select-option';
                option.innerHTML = `
                    <input type="checkbox" id="month_${month}" value="${month}" onchange="Filters.updateMultiSelect('month', ${month})">
                    <label for="month_${month}">${month} - ${monthNames[month]}</label>
                `;
                monthOptions.appendChild(option);
            });
        }

        const dayOptions = document.getElementById('dayOptions');
        if (dayOptions) {
            dayOptions.innerHTML = '';
            options.days.forEach(day => {
                const option = document.createElement('div');
                option.className = 'multi-select-option';
                option.innerHTML = `
                    <input type="checkbox" id="day_${day}" value="${day}" onchange="Filters.updateMultiSelect('day', ${day})">
                    <label for="day_${day}">${day}</label>
                `;
                dayOptions.appendChild(option);
            });
        }
    },

    /**
     * Select "All" option for a filter
     */
    selectAllOption(type) {
        const allCheckbox = document.getElementById(`${type}_all`);
        if (allCheckbox) {
            allCheckbox.checked = true;
            allCheckbox.parentElement?.classList.add('selected');
        }
    },

    /**
     * Update multi-select value
     */
    updateMultiSelect(type, value) {
        const checkboxId = `${type}_${value}`;
        let checkbox = document.getElementById(checkboxId);

        if (!checkbox) {
            // Try with safe ID
            const safeId = this.createSafeId(value);
            checkbox = document.getElementById(`${type}_${safeId}`);
        }

        if (!checkbox) return;

        const option = checkbox.parentElement;

        if (type === 'employee') {
            this.updateArraySelection('employee', 'selectedEmployees', value);
        } else if (type === 'store') {
            this.updateArraySelection('store', 'selectedStores', value);
        } else if (type === 'shipmentStatus') {
            this.updateArraySelection('shipmentStatus', 'selectedShipmentStatuses', value);
        } else if (type === 'clientStatus') {
            this.updateArraySelection('clientStatus', 'selectedClientStatuses', value);
        } else if (type === 'deliveryStatus') {
            this.updateArraySelection('deliveryStatus', 'selectedDeliveryStatuses', value);
        } else if (type === 'month') {
            this.updateNumberSelection('selectedMonths', 'month', parseInt(value));
        } else if (type === 'day') {
            this.updateNumberSelection('selectedDays', 'day', parseInt(value));
        }

        // Update visual state
        if (checkbox.checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }

        this.updateDropdownDisplay(type);
    },

    /**
     * Update array-based selection
     */
    updateArraySelection(type, arrayName, value) {
        const selectedArray = this[arrayName];

        if (value === 'all') {
            if (selectedArray.includes('all')) {
                // Deselect "All"
                this[arrayName] = [];
            } else {
                // Select "All" and deselect others
                this[arrayName] = ['all'];
                // Uncheck all other options
                document.querySelectorAll(`#${type}Options input[type="checkbox"]:not(#${type}_all)`).forEach(cb => {
                    cb.checked = false;
                    cb.parentElement.classList.remove('selected');
                });
            }
        } else {
            // Deselect "All" if selecting specific value
            if (selectedArray.includes('all')) {
                this[arrayName] = [];
                const allCheckbox = document.getElementById(`${type}_all`);
                if (allCheckbox) {
                    allCheckbox.checked = false;
                    allCheckbox.parentElement?.classList.remove('selected');
                }
            }

            const index = selectedArray.indexOf(value);
            if (index === -1) {
                this[arrayName].push(value);
            } else {
                this[arrayName].splice(index, 1);
            }
        }
    },

    /**
     * Update number array selection
     */
    updateNumberSelection(arrayName, type, value) {
        const selectedArray = this[arrayName];
        const index = selectedArray.indexOf(value);

        if (index === -1) {
            selectedArray.push(value);
        } else {
            selectedArray.splice(index, 1);
        }

        // Update visual state
        const checkbox = document.getElementById(`${type}_${value}`);
        if (checkbox) {
            if (checkbox.checked) {
                checkbox.parentElement.classList.add('selected');
            } else {
                checkbox.parentElement.classList.remove('selected');
            }
        }
    },

    /**
     * Update dropdown display text
     */
    updateDropdownDisplay(type) {
        let selectedArray, selectedElement, defaultText;

        switch (type) {
            case 'employee':
                selectedArray = this.selectedEmployees;
                selectedElement = document.getElementById('employeeSelected');
                defaultText = 'جميع الموظفين';
                break;
            case 'store':
                selectedArray = this.selectedStores;
                selectedElement = document.getElementById('storeSelected');
                defaultText = 'جميع المتاجر';
                break;
            case 'shipmentStatus':
                selectedArray = this.selectedShipmentStatuses;
                selectedElement = document.getElementById('shipmentStatusSelected');
                defaultText = 'جميع الحالات';
                break;
            case 'clientStatus':
                selectedArray = this.selectedClientStatuses;
                selectedElement = document.getElementById('clientStatusSelected');
                defaultText = 'جميع الحالات';
                break;
            case 'deliveryStatus':
                selectedArray = this.selectedDeliveryStatuses;
                selectedElement = document.getElementById('deliveryStatusSelected');
                defaultText = 'جميع الحالات';
                break;
            case 'month':
                selectedArray = this.selectedMonths;
                selectedElement = document.getElementById('monthSelected');
                defaultText = 'اختر الشهر';
                break;
            case 'day':
                selectedArray = this.selectedDays;
                selectedElement = document.getElementById('daySelected');
                defaultText = 'اختر اليوم';
                break;
            default:
                return;
        }

        if (!selectedElement) return;

        if (selectedArray.length === 0) {
            selectedElement.innerHTML = defaultText;
        } else if (selectedArray.length === 1 && selectedArray[0] === 'all') {
            selectedElement.innerHTML = defaultText;
        } else if (selectedArray.length === 1) {
            selectedElement.innerHTML = selectedArray[0].toString();
        } else {
            selectedElement.innerHTML = `
                <span class="multi-select-selected-count">${selectedArray.length}</span>
                عناصر محددة
            `;
        }
    },

    /**
     * Apply filters and reload dashboard data
     */
    async applyFilters() {
        // Get filter values
        this.currentFilters.employee = this.selectedEmployees.includes('all') ? 'all' : this.selectedEmployees;
        this.currentFilters.store = this.selectedStores.includes('all') ? 'all' : this.selectedStores;
        this.currentFilters.shipmentStatus = this.selectedShipmentStatuses.includes('all') ? 'all' : this.selectedShipmentStatuses;
        this.currentFilters.clientStatus = this.selectedClientStatuses.includes('all') ? 'all' : this.selectedClientStatuses;
        this.currentFilters.deliveryStatus = this.selectedDeliveryStatuses.includes('all') ? 'all' : this.selectedDeliveryStatuses;

        // Date filters
        this.currentFilters.months = [...this.selectedMonths];
        this.currentFilters.days = [...this.selectedDays];

        // Reload dashboard
        await Dashboard.loadData(this.currentFilters);
    },

    /**
     * Clear all filters
     */
    async clearFilters() {
        // Reset selections
        this.selectedEmployees = ['all'];
        this.selectedStores = ['all'];
        this.selectedShipmentStatuses = ['all'];
        this.selectedClientStatuses = ['all'];
        this.selectedDeliveryStatuses = ['all'];
        this.selectedMonths = [];
        this.selectedDays = [];

        // Reset checkboxes
        document.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.parentElement.classList.remove('selected');
        });

        // Select "All" options
        this.selectAllOption('employee');
        this.selectAllOption('store');
        this.selectAllOption('shipmentStatus');
        this.selectAllOption('clientStatus');
        this.selectAllOption('deliveryStatus');

        // Reset dropdown displays
        const elements = {
            employeeSelected: 'جميع الموظفين',
            storeSelected: 'جميع المتاجر',
            shipmentStatusSelected: 'جميع الحالات',
            clientStatusSelected: 'جميع الحالات',
            deliveryStatusSelected: 'جميع الحالات',
            monthSelected: 'اختر الشهر',
            daySelected: 'اختر اليوم'
        };

        Object.keys(elements).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = elements[id];
        });

        // Close all dropdowns
        this.closeAllDropdowns();

        // Reset current filters
        this.currentFilters = {
            employee: 'all',
            store: 'all',
            shipmentStatus: 'all',
            clientStatus: 'all',
            deliveryStatus: 'all',
            shippingCompany: 'all',
            months: [],
            days: []
        };

        // Reload dashboard
        await Dashboard.loadData(this.currentFilters);
    }
};

// Export Filters to global scope
window.Filters = Filters;