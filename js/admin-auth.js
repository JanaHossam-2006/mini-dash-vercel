/**
 * Admin Authentication Middleware
 * Ensures admin pages require authentication
 */

const AdminAuth = {
    // Check if user is authenticated, redirect if not
    async requireAuth() {
        const isAuth = await AuthHelper.isAuthenticated();
        if (!isAuth) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // Initialize admin page with auth check
    async init() {
        const isAuth = await this.requireAuth();
        if (isAuth) {
            // Load user info
            await this.loadUserInfo();
        }
    },

    // Load and display user info
    async loadUserInfo() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
            // You can display user info if needed
            console.log('Admin user:', user.email);
        }
    },

    // Handle logout
    async handleLogout() {
        const confirmLogout = confirm('هل تريد تسجيل الخروج؟');
        if (!confirmLogout) return;

        const result = await AuthHelper.signOut();
        if (result.success) {
            window.location.href = 'login.html';
        } else {
            alert('خطأ في تسجيل الخروج: ' + result.error);
        }
    },

    // Check auth on page load and listen for changes
    setup() {
        // Check auth on page load
        this.init();

        // Listen for auth state changes
        AuthHelper.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                window.location.href = 'login.html';
            }
        });
    }
};

// Export to global scope
window.AdminAuth = AdminAuth;