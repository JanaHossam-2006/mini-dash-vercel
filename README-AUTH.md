# Authentication Setup Guide

## Setup Steps

### 1. Configure Supabase Authentication
1. Go to your Supabase Dashboard > Authentication
2. Enable Email/Password provider
3. Create an admin user:
   - Email: admin@example.com (use your email)
   - Password: strong password

### 2. Update Environment Variables
For local development, create `.env.local`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

For Vercel deployment, add environment variables in Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 3. Update Supabase.js
Edit `js/supabase.js` with your actual values:
```javascript
const config = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
};
```

## Access Flow

### Public Users (Dashboard)
- **Access**: `index.html`
- **Permissions**: Read-only access to visible orders
- **No login required**

### Admin Users
- **Login**: `login.html`
- **Credentials**: Email + Password created in Supabase
- **Access after login**: `admin.html`
- **Permissions**:
  - Upload deliveries CSV
  - Upload test orders CSV  
  - Run manual recalculation
  - View admin statistics

## Security Notes

### RLS Policies
The database has Row Level Security policies:
- **orders**: Public can read (only visible rows)
- **deliveries**: Public can read, Admin can manage
- **test_orders**: Public can read, Admin can manage

### Admin Protection
- Admin pages (`admin.html`) redirect to `login.html` if not authenticated
- Login requires valid Supabase credentials
- Sessions managed by Supabase Auth

## Troubleshooting

### Admin cannot upload CSV
1. Check if user is logged in (look for Sign Out button)
2. Verify RLS policies allow authenticated users to insert
3. Check browser console for errors

### Login not working
1. Verify credentials in Supabase Authentication
2. Check network tab for API errors
3. Ensure Supabase URL and Key are correct

### Vercel deployment issues
1. Verify environment variables are set in Vercel
2. Check Vercel logs for errors
3. Ensure all files are properly deployed