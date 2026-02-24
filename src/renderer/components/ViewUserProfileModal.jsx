import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../hooks/useAdmin';
import { FaTimes, FaUserPlus, FaUserCheck, FaUserTimes, FaComment, FaBan, FaHeart, FaExclamationTriangle, FaTrash, FaArrowLeft } from 'react-icons/fa';
import { formatUserName, getUserAvatar } from '../utils/formatUser';
import AlertModal from './AlertModal';
import ConfirmationModal from './ConfirmationModal';
import AdminWarningsModal from './AdminWarningsModal';
import { useNavigate } from 'react-router-dom';

const ViewUserProfileModal = ({ isOpen, onClose, targetUserId, fromAdminDashboard = false }) => {
    const { user } = useAuth();
    const { isAdmin, isModerator } = useAdmin();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none', 'pending', 'accepted', 'received'
    const [actionLoading, setActionLoading] = useState(false);

    // Admin features
    const [warningsCount, setWarningsCount] = useState(0);
    const [showAdminWarnings, setShowAdminWarnings] = useState(false);

    // Custom Alert/Confirm States
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmState({ isOpen: true, title, message, onConfirm });
    };

    useEffect(() => {
        if (isOpen && targetUserId) {
            fetchProfileAndFriendship();
        }
    }, [isOpen, targetUserId, user]);

    const fetchProfileAndFriendship = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .single();

            if (profileError) throw profileError;
            console.log("Profile Data Fetched:", profileData); // Debug log
            setProfile(profileData);

            // 2. Fetch Friendship Status
            if (user && user.id !== targetUserId) {
                const { data: friendship } = await supabase
                    .from('friendships')
                    .select('*')
                    .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
                    .single();

                if (friendship) {
                    if (friendship.status === 'accepted') {
                        setFriendshipStatus('accepted');
                    } else if (friendship.status === 'pending') {
                        // Check who sent the request
                        if (friendship.user_id === user.id) {
                            setFriendshipStatus('pending'); // I sent it
                        } else {
                            setFriendshipStatus('received'); // They sent it
                        }
                    } else {
                        setFriendshipStatus('none');
                    }
                } else {
                    setFriendshipStatus('none');
                }
            }

            // 3. Admin/Mod: Fetch Warning Count
            if (fromAdminDashboard) {
                const { count } = await supabase
                    .from('user_warnings')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', targetUserId);
                setWarningsCount(count || 0);
            }

        } catch (error) {
            console.error("Error fetching user profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!user) return showAlert('info', 'Atenção', "Faça login para adicionar amigos.");
        setActionLoading(true);
        try {
            const { error } = await supabase.from('friendships').insert([{
                user_id: user.id,
                friend_id: targetUserId,
                requester_name: user.user_metadata?.username || user.email.split('@')[0],
                receiver_name: profile?.username || 'Usuário',
                status: 'pending'
            }]);
            if (error) throw error;
            setFriendshipStatus('pending');
        } catch (error) {
            showAlert('error', 'Erro', "Erro ao enviar solicitação: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAcceptRequest = async () => {
        setActionLoading(true);
        try {
            // Find the specific friendship record first to be safe
            const { data: friendship } = await supabase
                .from('friendships')
                .select('id')
                .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
                .single();

            if (!friendship) throw new Error("Solicitação não encontrada.");

            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted', negotiation_active: false })
                .eq('id', friendship.id);

            if (error) throw error;
            setFriendshipStatus('accepted');
        } catch (error) {
            showAlert('error', 'Erro', "Erro ao aceitar: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFriend = async () => {
        showConfirm('Desfazer Amizade', "Tem certeza que deseja desfazer a amizade?", async () => {
            setActionLoading(true);
            try {
                const { error } = await supabase
                    .from('friendships')
                    .delete()
                    .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`);

                if (error) throw error;
                setFriendshipStatus('none');
            } catch (error) {
                showAlert('error', 'Erro', "Erro ao remover: " + error.message);
            } finally {
                setActionLoading(false);
            }
        });
    };

    const handleSendMessage = () => {
        onClose();
        navigate(`/chat?chatUserId=${targetUserId}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1e1f2b]/95 w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 text-white/50 hover:text-white bg-black/20 hover:bg-black/50 p-2 rounded-full transition-all"
                >
                    <FaTimes size={16} />
                </button>

                {loading ? (
                    <div className="p-12 text-center text-gray-400 animate-pulse">Carregando perfil...</div>
                ) : (
                    <>
                        {/* Banner & Avatar Area */}
                        <div className="h-32 bg-gradient-to-br from-indigo-900 via-purple-900 to-[#1e1f2b] relative">
                            {/* Cover Image */}
                            {profile?.cover_url && (
                                <img src={profile.cover_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                            )}
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1f2b] to-transparent opacity-90"></div>


                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-10">
                                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-xl">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-[#1e1f2b]">
                                        {getUserAvatar(profile) ? (
                                            <img src={getUserAvatar(profile)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white/20">
                                                {profile?.username?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="pt-14 pb-8 px-6 text-center">
                            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                                {profile?.username || 'Usuário'}
                            </h2>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <p className="text-purple-400 text-sm font-medium bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
                                    #{profile?.display_id ?? '...'}
                                </p>

                                {fromAdminDashboard && (
                                    <button
                                        onClick={() => setShowAdminWarnings(true)}
                                        className={`text-sm font-bold px-3 py-1 rounded-full border flex items-center gap-1 transition-all hover:scale-105 active:scale-95 ${warningsCount > 0
                                            ? 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                                            : 'text-gray-400 bg-gray-500/10 border-gray-500/10 hover:bg-gray-400/20'
                                            }`}
                                        title="Gerenciar Alertas do Usuário"
                                    >
                                        <FaExclamationTriangle /> {warningsCount}
                                    </button>
                                )}
                            </div>

                            {/* Bio */}
                            {profile?.bio && (
                                <p className="text-gray-300 text-sm mt-4 px-4 line-clamp-4 italic">
                                    "{profile.bio}"
                                </p>
                            )}

                            {/* Actions */}
                            <div className="mt-8 flex flex-col gap-3">
                                {user && user.id === targetUserId ? (
                                    <div className="text-gray-500 text-sm italic">Este é você.</div>
                                ) : (
                                    <>
                                        {/* Status: NONE */}
                                        {friendshipStatus === 'none' && (
                                            <button
                                                onClick={handleSendRequest}
                                                disabled={actionLoading}
                                                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                                            >
                                                <FaUserPlus /> Adicionar Amigo
                                            </button>
                                        )}

                                        {/* Status: PENDING (Sent) */}
                                        {friendshipStatus === 'pending' && (
                                            <button
                                                onClick={handleRemoveFriend} // Cancel request
                                                disabled={actionLoading}
                                                className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-yellow-500 hover:text-red-400 font-bold flex items-center justify-center gap-2 transition-all border border-yellow-500/30"
                                            >
                                                {actionLoading ? 'Processando...' : <><FaUserTimes /> Cancelar Pedido</>}
                                            </button>
                                        )}

                                        {/* Status: RECEIVED */}
                                        {friendshipStatus === 'received' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleAcceptRequest}
                                                    disabled={actionLoading}
                                                    className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all"
                                                >
                                                    Aceitar
                                                </button>
                                                <button
                                                    onClick={handleRemoveFriend}
                                                    disabled={actionLoading}
                                                    className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-400 font-bold transition-all"
                                                >
                                                    Recusar
                                                </button>
                                            </div>
                                        )}

                                        {/* Status: ACCEPTED */}
                                        {friendshipStatus === 'accepted' && (
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={handleSendMessage}
                                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
                                                >
                                                    <FaComment /> Enviar Mensagem
                                                </button>
                                                <button
                                                    onClick={handleRemoveFriend}
                                                    disabled={actionLoading}
                                                    className="w-full py-2 rounded-xl bg-transparent hover:bg-red-500/10 text-gray-500 hover:text-red-500 text-sm font-bold flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <FaUserTimes /> Desfazer Amizade
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Admin Warnings Modal Form */}
            {showAdminWarnings && profile && (
                <AdminWarningsModal
                    isOpen={showAdminWarnings}
                    user={profile}
                    onClose={() => {
                        setShowAdminWarnings(false);
                        fetchProfileAndFriendship(); // Refresh count
                    }}
                />
            )}

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={() => {
                    confirmState.onConfirm();
                    setConfirmState({ ...confirmState, isOpen: false });
                }}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default ViewUserProfileModal;
