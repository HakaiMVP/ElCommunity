import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '../hooks/useAdmin';

const AdminRoute = ({ children }) => {
    const { isAdmin, loading } = useAdmin();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0b0c15]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;
