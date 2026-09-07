/**
 * Supabase Client Configuration with Auth
 */

// Supabase project config
const DEFAULT_SUPABASE_URL = 'https://sylulmlqsqhyujprjups.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mJHllHfX125IsngquC4YJw_G5oIVUDT';


const getSupabaseConfig = () => {
    return {
        url: DEFAULT_SUPABASE_URL,
        anonKey: DEFAULT_SUPABASE_ANON_KEY
    };
};


const config = getSupabaseConfig();


// Initialize Supabase client
const supabaseClient = window.supabase.createClient(
    config.url,
    config.anonKey
);


// Export globally
window.supabaseClient = supabaseClient;
window.SUPABASE_CONFIG = config;


// Auth helper functions
window.AuthHelper = {

    async getSession() {
        try {
            const { data, error } = await supabaseClient.auth.getSession();

            if (error) throw error;

            return {
                success: true,
                session: data.session
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },


    async isAuthenticated() {
        const {
            data: { user }
        } = await supabaseClient.auth.getUser();

        return !!user;
    },


    async signIn(email, password) {
        try {

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });


            if (error) throw error;


            return {
                success: true,
                user: data.user,
                session: data.session
            };


        } catch (error) {

            return {
                success: false,
                error: error.message
            };

        }
    },


    async signOut() {

        try {

            const { error } =
                await supabaseClient.auth.signOut();


            if (error) throw error;


            return {
                success: true
            };


        } catch (error) {

            return {
                success: false,
                error: error.message
            };

        }
    },


    onAuthStateChange(callback) {

        return supabaseClient.auth.onAuthStateChange(
            (event, session) => {
                callback(event, session);
            }
        );

    }

};