# Mini Dash - Supabase + Vercel

A production-ready dashboard migrated from Google Apps Script to Supabase PostgreSQL and Vercel.

## Project Structure

```
Mini Dash Vercel/
├── index.html              # Main HTML file
├── vercel.json             # Vercel configuration
├── README.md               # This file
├── database/
│   └── schema.sql          # Supabase database schema
├── css/
│   └── style.css           # Dashboard styles
├── js/
│   ├── supabase.js         # Supabase client configuration
│   ├── api.js              # Database operations layer
│   ├── charts.js           # Chart.js configurations
│   ├── filters.js          # Multi-select filter handling
│   └── dashboard.js        # Main dashboard logic
└── assets/
    └── (static assets)
```

## Supabase Setup

### 1. Create Supabase Project
1. Go to https://supabase.com and create a new project
2. Note your project URL and anon key

### 2. Run Database Schema
Execute the SQL in `database/schema.sql` in your Supabase SQL editor:

```sql
-- This will create:
-- - orders table with all columns including calculated ones
-- - deliveries table
-- - test_orders table
-- - Database functions and triggers
-- - RLS policies
-- - Views for dashboard
```

### 3. Configure Security (RLS)
The schema includes Row Level Security policies:
- Public read access to orders (excludes Ignore rows)
- Authenticated write access to deliveries and test_orders

### 4. Populate Initial Data
Upload your orders data to the `orders` table, and deliveries to `deliverys` table.

### 5. Trigger Initial Calculation
After populating data, run:
```sql
SELECT recalculate_calculated_columns();
```

## Frontend Setup

### 1. Configure Supabase Client
Edit `js/supabase.js` and replace with your credentials:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 2. Deploy to Vercel

Option A: Using Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

Option B: Using Vercel Dashboard
1. Go to https://vercel.com
2. Import your GitHub repository
3. Add the project
4. Deploy

### 3. Environment Variables
For production, consider using Vercel environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then update `supabase.js` to use:
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
```

## Business Logic

### Calculated Columns
All calculated columns are managed at database level:

- `delivered` - Boolean, true if order is delivered
- `filter` - 'yes' if order in test_orders, 'no' otherwise
- `delivery_filter` - Delivery status: 'تم التسليم بنفس الكود', 'استلم بكود آخر', or 'Ignore'
- `dashboard_filter` - 'Ignore' for rows that should be hidden from dashboard

### Dashboard Query
Dashboard only shows rows where:
```sql
dashboard_filter IS NULL OR dashboard_filter != 'Ignore'
```

### Data Refresh
When updating orders, deliveries, or test_orders tables:
```sql
SELECT recalculate_calculated_columns();
```

Or trigger via API when implementing a refresh endpoint.

## Features

- **KPIs**: Total orders, delivered, not delivered, percentages, average call attempts
- **Employee Statistics**: Performance by employee with color-coded delivery rates
- **Store Statistics**: Performance by store
- **Shipment Statistics**: Shipping status breakdown
- **Client Status Statistics**: Customer response breakdown
- **Call Attempts**: Call statistics for "لم يرد إطلاقا" status
- **Time Series**: Monthly/daily order trends
- **Filters**: Multi-select filters for all dimensions
- **Responsive**: Works on desktop and mobile

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- Chart.js for visualizations
- Supabase JS client for database
- Remix Icons
- Tajawal font
- Vercel for hosting

## Deployment Checklist

### Before Deploying to Production:

#### 1. Supabase Configuration:
- [ ] Create Supabase project
- [ ] Run `database/schema.sql` in SQL Editor
- [ ] Enable Email/Password authentication in Auth settings
- [ ] Create admin user (or use existing users for authentication)
- [ ] Import your orders data to `orders` table
- [ ] Run initial calculation: `SELECT recalculate_calculated_columns();`

#### 2. Environment Configuration:
- [ ] Update `js/supabase.js` with your Supabase URL and anon key
- [ ] For Vercel: Set environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] Test authentication flow (login with admin credentials)

#### 3. CSV Upload Testing:
- [ ] Verify Arabic headers are accepted: `كود_الطلب`, `رقم_العميل`, `المتجر`, `تاريخ_التسليم`
- [ ] Test date format conversion: DD/MM/YYYY → YYYY-MM-DD
- [ ] Confirm order_code leading zeros are preserved
- [ ] Test duplicate order_code handling

#### 4. Security Verification:
- [ ] Confirm no `service_role` key exists in frontend files
- [ ] Verify RLS policies allow public read but require auth for write
- [ ] Test that unauthenticated users cannot access `admin.html`
- [ ] Verify logout functionality works

#### 5. Dashboard Verification:
- [ ] Confirm dashboard only shows visible rows (`dashboard_filter != 'Ignore'`)
- [ ] Test all filters (employee, store, client status, etc.)
- [ ] Verify charts display correct data
- [ ] Check KPI calculations match original Google Sheets

#### 6. Admin Features:
- [ ] Test CSV upload for deliveries
- [ ] Test CSV upload for test_orders
- [ ] Verify manual recalculation triggers database updates

### Post-Deployment Tasks:
- [ ] Set up daily data import process (CSV upload)
- [ ] Create Edge Function for secure recalculation
- [ ] Monitor performance and adjust indexes if needed
- [ ] Set up database backups

## Migration Notes

This project was migrated from Google Apps Script + Google Sheets to:
- Supabase PostgreSQL (database)
- Vanilla JavaScript (frontend)
- Vercel (hosting)

Key changes:
- Removed all `google.script.run` calls
- Replaced `SpreadsheetApp` with Supabase client
- Calculated columns now live in database (PL/pgSQL)
- Frontend only reads final calculated values
- No server-side Apps Script needed