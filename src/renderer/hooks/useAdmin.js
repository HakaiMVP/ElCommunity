import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export const useAdmin = () => {
    const { user } = useAuth();
    const [globalRole, setGlobalRole] = useState('user');
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setGlobalRole('user');
            setPermissions([]);
            setLoading(false);
            return;
        }

        const fetchIsAdmin = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('global_role, custom_permissions')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setGlobalRole(data.global_role || 'user');
                setPermissions(data.custom_permissions || []);
            } catch (err) {
                console.error('Error fetching admin role:', err);
                setGlobalRole('user');
            } finally {
                setLoading(false);
            }
        };

        fetchIsAdmin();
    }, [user]);

    const isSuperAdmin = globalRole === 'super_admin';
    const isAdmin = globalRole === 'admin' || isSuperAdmin;
    const isModerator = globalRole === 'moderator' || isAdmin;

    const hasPermission = (permissionName) => {
        if (isSuperAdmin) return true;
        if (permissions.includes(permissionName)) return true;

        // Define default permissions for roles if needed, or rely on explicit 'custom_permissions'
        // For example, moderators might implicitly have 'delete_comments'
        if (isModerator && (permissionName === 'delete_comments' || permissionName === 'delete_posts')) return true;

        return false;
    };

    return {
        role: globalRole,
        isSuperAdmin,
        isAdmin,
        isModerator,
        hasPermission,
        loading
    };
};
