import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [isBanned, setIsBanned] = useState(false);
    const [banInfo, setBanInfo] = useState(null);

    // Fetch Profile Data (Avatar, Frame, etc.)
    const fetchProfile = async (userId) => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, equipped_effect, user_bans!user_bans_user_id_fkey(reason, expires_at)')
                .eq('id', userId)
                .single();

            if (!error && data) {
                // Check for active bans
                const activeBans = data.user_bans?.filter(ban => !ban.expires_at || new Date(ban.expires_at) > new Date()) || [];
                if (activeBans.length > 0) {
                    setIsBanned(true);
                    setBanInfo(activeBans[0]); // Consider using the most recent or longest ban
                } else {
                    setIsBanned(false);
                    setBanInfo(null);
                }

                // Cleanup user_bans before setting profile to avoid polluting state if unwanted
                const { user_bans, ...profileData } = data;
                setUserProfile(profileData);
            }
        } catch (error) {
            console.error('Error fetching profile in context:', error);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    useEffect(() => {
        // Check active session
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setLoading(false);

            if (session?.user) {
                // Fetch profile data immediately
                fetchProfile(session.user.id);

                // Update last_seen on initial load if user is logged in (non-blocking)
                supabase
                    .from('profiles')
                    .update({ last_seen: new Date().toISOString() })
                    .eq('id', session.user.id)
                    .then(() => { }) // Fire and forget
                    .catch(() => { }); // Silently ignore errors
            }
        };

        getSession();

        // Safety timeout in case getSession hangs (e.g. storage issues)
        const safetyTimeout = setTimeout(() => {
            setLoading((currentLoading) => {
                if (currentLoading) {
                    console.warn('[AuthContext] Session check timed out, forcing app load.');
                    return false;
                }
                return currentLoading;
            });
        }, 3000);

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // ... existing logic ...
                setUser(session?.user ?? null);
                setLoading(false);
                if (safetyTimeout) clearTimeout(safetyTimeout); // Clear timeout if auth resolves

                if (session?.user) {
                    // Fetch profile on auth change (login)
                    fetchProfile(session.user.id);
                } else {
                    setUserProfile(null);
                    setIsBanned(false);
                    setBanInfo(null);
                }

                // Update last_seen on login (non-blocking)
                if (event === 'SIGNED_IN' && session?.user) {
                    supabase
                        .from('profiles')
                        .update({ last_seen: new Date().toISOString() })
                        .eq('id', session.user.id)
                        .then(() => { }) // Fire and forget
                        .catch(() => { }); // Silently ignore errors
                }

                // Clear last_seen on logout (set to far past to show offline immediately)
                if (event === 'SIGNED_OUT') {
                    // User is already null at this point, so we can't update
                    // The heartbeat will stop naturally
                }
            }
        );

        return () => {
            clearTimeout(safetyTimeout);
            subscription?.unsubscribe();
        };
    }, []);

    // ... (rest of code: Heartbeat, signUp, signIn, signOut) ...

    // Heartbeat: Update last_seen and presence with activity detection
    useEffect(() => {
        if (!user || isBanned) return;

        let lastActivityTime = Date.now();
        let currentPresence = 'online';

        const updatePresence = async (status) => {
            currentPresence = status;
            supabase
                .from('profiles')
                .update({
                    last_seen: new Date().toISOString(),
                    presence: status
                })
                .eq('id', user.id)
                .then(() => { })
                .catch(() => { });
        };

        const handleHeartbeat = async () => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivityTime;

            let newPresence = 'online';
            if (timeSinceActivity > 60000) { // 1 minute of inactivity
                newPresence = 'away';
            }

            // Always update last_seen, but only update presence if it changed or it's been a while
            updatePresence(newPresence);
        };

        const handleActivity = () => {
            const now = Date.now();
            // If we were away, return to online immediately
            if (currentPresence === 'away') {
                updatePresence('online');
            }
            lastActivityTime = now;
        };

        const handleUnload = () => {
            // Attempt a final "offline" update on window close (best effort)
            supabase
                .from('profiles')
                .update({ presence: 'offline' })
                .eq('id', user.id)
                .then(() => { })
                .catch(() => { });
        };

        // Listen for user activity
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('beforeunload', handleUnload);

        // Initial update
        updatePresence('online');

        // Regular heartbeat (every 15 seconds)
        const interval = setInterval(handleHeartbeat, 15000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [user]);

    const signUp = async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                },
            },
        });
        if (error) throw error;
        return data;
    };

    const signIn = async (email, password, rememberMe = true) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        if (user) {
            await supabase
                .from('profiles')
                .update({ presence: 'offline' })
                .eq('id', user.id);
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUserProfile(null); // Clear profile on sign out
        setIsBanned(false);
        setBanInfo(null);
    };

    const value = {
        signUp,
        signIn,
        signOut,
        user,
        userProfile,
        isBanned,
        banInfo,
        refreshProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
