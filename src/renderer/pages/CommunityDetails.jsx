import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../hooks/useAdmin';
import { FaArrowLeft, FaUsers, FaLock, FaGlobeAmericas, FaCog, FaCheck, FaTimes, FaShieldAlt, FaUserEdit, FaSave, FaArrowsAltV, FaCamera, FaTrash } from 'react-icons/fa';
import LeaveCommunityModal from '../components/LeaveCommunityModal';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';
import Feed from '../components/community/Feed';

const CommunityDetails = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { isSuperAdmin } = useAdmin();
    const navigate = useNavigate();

    const [community, setCommunity] = useState(null);
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [myMembership, setMyMembership] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'members', 'admin', 'settings'
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showDeleteCommunityModal, setShowDeleteCommunityModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [roleChangeModal, setRoleChangeModal] = useState({ isOpen: false, userId: null, newRole: null });
    const [banModal, setBanModal] = useState({ isOpen: false, memberId: null, username: '' });


    // Settings State
    const [settings, setSettings] = useState({
        name: '',
        description: '',
        is_private: false,
        image_url: '', // Icon
        cover_url: '', // Default or custom
        cover_position: '50% 50%',
        policy_post: 'member',
        policy_comment: 'member',
        policy_invite: 'admin',
        policy_ban: 'admin'
    });
    const [settingsChanged, setSettingsChanged] = useState(false);

    // Reposition State
    const [isRepositioning, setIsRepositioning] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [currentPosition, setCurrentPosition] = useState('50% 50%'); // local temp position

    // Drag handlers
    const handleRepositionStart = (e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag if clicking a button
        e.preventDefault();
        setIsRepositioning(true);
        setDragStart({
            y: e.clientY,
            initialTop: parseFloat(currentPosition.split(' ')[1]) || 50
        });
    };

    const handleRepositionMove = (e) => {
        if (!isRepositioning || !dragStart) return;

        const deltaY = e.clientY - dragStart.y;
        const deltaPercent = deltaY * 0.2;

        let newTop = dragStart.initialTop + deltaPercent;
        newTop = Math.max(0, Math.min(100, newTop));

        setCurrentPosition(`50% ${newTop}%`);
    };

    const handleRepositionEnd = () => {
        setDragStart(null);
    };

    const cancelReposition = () => {
        setIsRepositioning(false);
        setCurrentPosition(settings.cover_position || '50% 50%');
        setDragStart(null);
    };

    const saveReposition = async () => {
        // Save to DB
        setSettings({ ...settings, cover_position: currentPosition });
        setIsRepositioning(false);
        setDragStart(null);

        // Persist immediately
        try {
            const { error } = await supabase
                .from('communities')
                .update({ cover_position: currentPosition })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error saving position:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao salvar posição da capa.' });
        }
    };

    useEffect(() => {
        fetchCommunityDetails();
    }, [id, user]);

    const fetchCommunityDetails = async () => {
        setLoading(true);
        try {
            // 1. Fetch Community Info (including policies)
            const { data: commData, error: commError } = await supabase
                .from('communities')
                .select('*')
                .eq('id', id)
                .single();

            if (commError) throw commError;
            setCommunity(commData);
            setSettings({
                name: commData.name || '',
                description: commData.description || '',
                is_private: commData.is_private || false,
                image_url: commData.image_url || '',
                cover_url: commData.cover_url || '',
                cover_position: commData.cover_position || '50% 50%',
                policy_post: commData.policy_post || 'member',
                policy_comment: commData.policy_comment || 'member',
                policy_invite: commData.policy_invite || 'admin',
                policy_ban: commData.policy_ban || 'admin'
            });

            // 2. Fetch My Membership
            let myRole = null;
            if (user) {
                const { data: myData } = await supabase
                    .from('community_members')
                    .select('*')
                    .eq('community_id', id)
                    .eq('user_id', user.id)
                    .single();
                setMyMembership(myData);
                myRole = myData?.role;
            }

            // 3. Fetch Members
            const { data: memData } = await supabase
                .from('community_members')
                .select('*, profiles(username, avatar_url, equipped_frame, equipped_effect)')
                .eq('community_id', id)
                .eq('status', 'approved')
                .order('role', { ascending: true }); // admin first usually (alphabetical a-z: admin, member)
            setMembers(memData || []);

            // 4. Fetch Requests (Only if Admin)
            if (myRole === 'admin') {
                fetchRequests();
            }

        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch requests separately once we know we are admin
    useEffect(() => {
        if (myMembership?.role === 'admin') {
            fetchRequests();
        }
    }, [myMembership]);

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('community_members')
            .select('*, profiles(username, avatar_url, equipped_frame, equipped_effect)')
            .eq('community_id', id)
            .eq('status', 'pending');
        setRequests(data || []);
    };

    const handleJoin = async () => {
        if (!user || !community) return;
        try {
            const status = community.is_private ? 'pending' : 'approved';
            await supabase.from('community_members').insert({
                community_id: id,
                user_id: user.id,
                status
            });
            fetchCommunityDetails();
        } catch (error) {
            console.error('Join error:', error);
        }
    };

    const handleLeave = async () => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', user.id);
            if (error) throw error;
            navigate('/explore');
        } catch (error) {
            console.error('Leave error:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: `Erro ao sair da comunidade: ${error.message}` });
            setActionLoading(false);
        }
    };

    const handleAdminAction = async (memberId, action, memberUsername = '') => { // action: 'approve' | 'reject' | 'ban'
        if (action === 'ban') {
            setBanModal({ isOpen: true, memberId, username: memberUsername });
            return;
        }

        try {
            if (action === 'approve') {
                await supabase
                    .from('community_members')
                    .update({ status: 'approved' })
                    .eq('id', memberId);
            } else {
                await supabase
                    .from('community_members')
                    .delete()
                    .eq('id', memberId);
            }
            fetchRequests();
            if (action === 'approve') fetchCommunityDetails();
        } catch (error) {
            console.error('Admin action error:', error);
        }
    };

    const confirmBan = async () => {
        const { memberId } = banModal;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('community_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;
            fetchCommunityDetails();
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Membro removido da comunidade.' });
        } catch (error) {
            console.error('Ban error:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível banir o membro.' });
        } finally {
            setActionLoading(false);
            setBanModal({ isOpen: false, memberId: null, username: '' });
        }
    };

    const handleRoleChange = (memberUserId, newRole) => {
        setRoleChangeModal({
            isOpen: true,
            userId: memberUserId,
            newRole: newRole
        });
    };

    const confirmRoleChange = async () => {
        const { userId, newRole } = roleChangeModal;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('community_members')
                .update({ role: newRole })
                .eq('community_id', id)
                .eq('user_id', userId);

            if (error) throw error;
            fetchCommunityDetails();
        } catch (error) {
            console.error('Error changing role:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Não foi possível alterar o cargo.' });
        } finally {
            setActionLoading(false);
            setRoleChangeModal({ isOpen: false, userId: null, newRole: null });
        }
    };

    const saveSettings = async () => {
        if (!settingsChanged) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('communities')
                .update({
                    name: settings.name,
                    description: settings.description,
                    is_private: settings.is_private,
                    image_url: settings.image_url,
                    cover_position: settings.cover_position,
                    policy_post: settings.policy_post,
                    policy_comment: settings.policy_comment,
                    policy_invite: settings.policy_invite,
                    policy_ban: settings.policy_ban
                })
                .eq('id', id);

            if (error) throw error;
            setSettingsChanged(false);
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Configurações salvas com sucesso!' });
        } catch (error) {
            console.error('Save settings error:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: `Erro ao salvar configurações: ${error.message || error.details || 'Erro desconhecido'}` });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteCommunity = async () => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from('communities').delete().eq('id', id);
            if (error) throw error;
            navigate('/explore');
        } catch (error) {
            console.error('Delete community error:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: `Erro ao excluir comunidade: ${error.message}` });
        } finally {
            setActionLoading(false);
            setShowDeleteCommunityModal(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-white">Carregando...</div>;
    if (!community) return <div className="p-10 text-center text-white">Comunidade não encontrada.</div>;

    const isCommunityAdmin = myMembership?.role === 'admin';
    const canManage = isCommunityAdmin || isSuperAdmin;
    const isMember = myMembership?.status === 'approved';
    const isPending = myMembership?.status === 'pending';

    const renderPermissionSelect = (label, key) => (
        <div className="mb-4">
            <label className="block text-sm font-bold text-gray-400 mb-2">{label}</label>
            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                {['admin', 'moderator', 'member'].map(role => (
                    <button
                        key={role}
                        onClick={() => {
                            setSettings({ ...settings, [key]: role });
                            setSettingsChanged(true);
                        }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${settings[key] === role
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {role === 'admin' ? 'Admins' : role === 'moderator' ? 'Mods' : 'Todos'}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-6 text-white animate-fade-in min-h-full">
            <button onClick={() => navigate('/explore')} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <FaArrowLeft /> Voltar para Explorar
            </button>

            {/* Banner / Header */}
            <div
                className={`relative rounded-2xl overflow-hidden bg-gray-800 mb-8 border border-gray-700 group ${isRepositioning ? 'cursor-move' : ''}`}
                onMouseDown={isRepositioning ? handleRepositionStart : null}
                onMouseMove={isRepositioning ? handleRepositionMove : null}
                onMouseUp={isRepositioning ? handleRepositionEnd : null}
                onMouseLeave={isRepositioning ? handleRepositionEnd : null}
            >
                <div className="h-48 bg-gradient-to-r from-purple-900 to-indigo-900 relative">
                    {community.image_url && (
                        <img
                            src={community.image_url}
                            alt=""
                            className="w-full h-full object-cover opacity-60 transition-none select-none pointer-events-none"
                            style={{ objectPosition: isRepositioning ? currentPosition : (settings.cover_position || '50% 50%') }}
                        />
                    )}

                    {/* Reposition Overlay Controls */}
                    {canManage && !isRepositioning && (
                        <button
                            onClick={() => {
                                setIsRepositioning(true);
                                setCurrentPosition(settings.cover_position || '50% 50%');
                            }}
                            className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-white px-6 py-3 rounded-full text-base font-bold transition-all flex items-center gap-3 shadow-xl backdrop-blur-md border border-white/20 hover:scale-105 active:scale-95"
                        >
                            <FaArrowsAltV /> Ajustar Capa
                        </button>
                    )}

                    {isRepositioning && (
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                            <button onClick={cancelReposition} className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
                                Cancelar
                            </button>
                            <button onClick={saveReposition} className="bg-green-500/80 hover:bg-green-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
                                Salvar Posição
                            </button>
                        </div>
                    )}

                    {isRepositioning && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-white/50 text-sm font-bold bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">Arraste para ajustar verticalmente</p>
                        </div>
                    )}
                </div>
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-gray-900 to-transparent p-6 pt-20">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 text-white shadow-sm">{community.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-gray-300">
                                <span className="flex items-center gap-1"><FaUsers /> {members.length} Membros</span>
                                <span className="flex items-center gap-1">
                                    {community.is_private ? <><FaLock className="text-orange-400" /> Privada</> : <><FaGlobeAmericas className="text-green-400" /> Pública</>}
                                </span>
                            </div>
                        </div>

                        <div>
                            {isMember ? (
                                <div className="flex gap-2">
                                    {canManage && (
                                        <button onClick={() => setActiveTab('settings')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                                            <FaCog /> Configurar
                                        </button>
                                    )}
                                    <button onClick={() => setShowLeaveModal(true)} className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-bold">
                                        Sair
                                    </button>
                                </div>
                            ) : isPending ? (
                                <button disabled className="px-6 py-3 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg font-bold cursor-wait">
                                    Solicitação Enviada
                                </button>
                            ) : (
                                <button onClick={handleJoin} className="px-8 py-3 bg-white text-black hover:bg-purple-500 hover:text-white transition-all rounded-lg font-bold shadow-lg">
                                    {community.is_private ? 'Pedir para Entrar' : 'Entrar na Comunidade'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    Visão Geral
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'members' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                >
                    Membros
                </button>
                {canManage && (
                    <>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'admin' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                        >
                            Solicitações ({requests.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                        >
                            Permissões
                        </button>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="bg-[#1e2029] rounded-xl p-6 border border-gray-800">
                {activeTab === 'overview' && (
                    <div>
                        <div className="mb-8">
                            <h3 className="text-xl font-bold mb-4">Sobre</h3>
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{community.description || "Nenhuma descrição fornecida."}</p>
                        </div>
                        <div className="border-t border-gray-700 pt-8">
                            <h3 className="text-xl font-bold mb-6">Feed da Comunidade</h3>
                            <Feed community={community} myRole={myMembership?.role || 'visitor'} />
                        </div>
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {members.map(member => (
                            <div key={member.id} className={`flex items-center gap-4 p-4 bg-gray-800/40 rounded-xl hover:bg-gray-800/60 transition-all duration-300 group relative overflow-hidden border border-white/5 hover:border-white/10 ${member.profiles?.equipped_effect || ''}`}>
                                <div className={`w-12 h-12 rounded-full bg-gray-700/50 overflow-hidden relative z-10 shrink-0 ${member.profiles?.equipped_frame || ''}`}>
                                    {member.profiles?.avatar_url ? (
                                        <img src={member.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-lg">
                                            {member.profiles?.username?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 relative z-10 flex flex-col items-start justify-center min-w-0">
                                    <p className={`font-bold text-base truncate ${member.profiles?.equipped_frame ? (member.profiles.equipped_frame.includes('name-') ? member.profiles.equipped_frame : member.profiles.equipped_frame.replace('avatar-', 'name-')) : 'text-gray-100'}`}>
                                        {member.profiles?.username || 'Usuário'}
                                    </p>
                                    <span className={`text-[9px] mt-2 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${member.role === 'admin' ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' :
                                        member.role === 'moderator' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]' :
                                            'bg-gray-700/80 text-gray-300'
                                        }`}>
                                        {member.role === 'admin' ? 'Admin' : member.role === 'moderator' ? 'Moderador' : 'Membro'}
                                    </span>
                                </div>

                                {/* Menu de Promoção (Apenas Admin vê e não pode mudar seu proprio papel se for o unico) */}
                                {isCommunityAdmin && member.user_id !== user.id && (
                                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 border border-white/10 rounded-lg p-1 flex gap-1 shadow-2xl z-50">
                                        <button
                                            title="Promover a Moderador"
                                            onClick={() => handleRoleChange(member.user_id, 'moderator')}
                                            className="p-1.5 hover:bg-blue-500 hover:text-white rounded text-blue-400"
                                        >
                                            <FaShieldAlt />
                                        </button>
                                        <button
                                            title="Promover a Admin"
                                            onClick={() => handleRoleChange(member.user_id, 'admin')}
                                            className="p-1.5 hover:bg-purple-500 hover:text-white rounded text-purple-400"
                                        >
                                            <FaUserEdit />
                                        </button>
                                        <button
                                            title="Rebaixar a Membro"
                                            onClick={() => handleRoleChange(member.user_id, 'member')}
                                            className="p-1.5 hover:bg-gray-600 hover:text-white rounded text-gray-400"
                                        >
                                            <FaUsers />
                                        </button>
                                        <button
                                            title="Banir"
                                            onClick={() => handleAdminAction(member.id, 'ban', member.profiles?.username)}
                                            className="p-1.5 hover:bg-red-500 hover:text-white rounded text-red-400"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'admin' && canManage && (
                    <div>
                        <h3 className="text-xl font-bold mb-6">Solicitações Pendentes</h3>
                        {requests.length === 0 ? (
                            <p className="text-gray-500">Nenhuma solicitação pendente no momento.</p>
                        ) : (
                            <div className="space-y-3">
                                {requests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full bg-gray-700 overflow-hidden ${req.profiles?.equipped_frame || ''}`}>
                                                {req.profiles?.avatar_url ? (
                                                    <img src={req.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                                                        {req.profiles?.username?.[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className={`font-bold ${req.profiles?.equipped_frame ? req.profiles.equipped_frame.replace('avatar-', 'name-') : ''}`}>{req.profiles?.username}</p>
                                                <p className="text-xs text-gray-400">Solicitou entrada</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAdminAction(req.id, 'reject')}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                title="Rejeitar"
                                            >
                                                <FaTimes />
                                            </button>
                                            <button
                                                onClick={() => handleAdminAction(req.id, 'approve')}
                                                className="p-2 bg-green-500 hover:bg-green-600 text-black rounded-lg transition-colors font-bold shadow-lg shadow-green-500/20"
                                                title="Aprovar"
                                            >
                                                <FaCheck />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && canManage && (
                    <div className="max-w-2xl">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <FaCog className="text-purple-400" /> Dados Gerais
                        </h3>
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Nome da Comunidade</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-700 focus:border-purple-500 outline-none font-bold"
                                    value={settings.name}
                                    onChange={(e) => {
                                        setSettings({ ...settings, name: e.target.value });
                                        setSettingsChanged(true);
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Descrição</label>
                                <textarea
                                    className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-700 focus:border-purple-500 outline-none"
                                    rows="3"
                                    value={settings.description}
                                    onChange={(e) => {
                                        setSettings({ ...settings, description: e.target.value });
                                        setSettingsChanged(true);
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between bg-gray-900 p-4 rounded-lg border border-gray-700">
                                <div>
                                    <span className="block font-bold text-white">Comunidade Privada</span>
                                    <span className="text-xs text-gray-500">Apenas membros aprovados podem ver o conteúdo.</span>
                                </div>
                                <div
                                    onClick={() => {
                                        setSettings({ ...settings, is_private: !settings.is_private });
                                        setSettingsChanged(true);
                                    }}
                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.is_private ? 'bg-purple-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.is_private ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-t border-gray-700 pt-8">
                            <FaCamera className="text-purple-400" /> Aparência
                        </h3>
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">URL da Imagem de Capa</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-700 focus:border-purple-500 outline-none"
                                    value={settings.image_url}
                                    onChange={(e) => {
                                        setSettings({ ...settings, image_url: e.target.value });
                                        setSettingsChanged(true);
                                    }}
                                    placeholder="https://..."
                                />
                                <p className="text-xs text-gray-500 mt-1">Use a função "Ajustar Capa" no topo para posicionar a imagem.</p>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-t border-gray-700 pt-8">
                            <FaShieldAlt className="text-purple-400" /> Configurações de Permissão
                        </h3>

                        <div className="space-y-6">
                            {renderPermissionSelect("Quem pode criar publicações?", 'policy_post')}
                            {renderPermissionSelect("Quem pode comentar?", 'policy_comment')}
                            {renderPermissionSelect("Quem pode aceitar/convidar membros?", 'policy_invite')}
                            {renderPermissionSelect("Quem pode banir membros?", 'policy_ban')}
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-700">
                            <button
                                onClick={saveSettings}
                                disabled={!settingsChanged || actionLoading}
                                className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${settingsChanged
                                    ? 'bg-green-500 hover:bg-green-600 text-black shadow-lg shadow-green-500/20'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                <FaSave /> {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-12 pt-8 border-t border-red-500/30">
                            <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2">
                                <FaTrash /> Zona de Perigo
                            </h3>
                            <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-6">
                                <h4 className="font-bold text-white mb-2">Excluir Comunidade</h4>
                                <p className="text-gray-400 text-sm mb-6">
                                    Esta ação irá excluir permanentemente a comunidade <strong>{community.name}</strong> e todos os seus dados, incluindo publicações, comentários e membros.
                                    Esta ação não pode ser desfeita.
                                </p>
                                <button
                                    onClick={() => setShowDeleteCommunityModal(true)}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Excluir Comunidade
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showLeaveModal && (
                <LeaveCommunityModal
                    communityName={community.name}
                    loading={actionLoading}
                    onClose={() => setShowLeaveModal(false)}
                    onConfirm={handleLeave}
                />
            )}

            {/* Delete Community Modal */}
            <ConfirmationModal
                isOpen={showDeleteCommunityModal}
                onClose={() => setShowDeleteCommunityModal(false)}
                onConfirm={handleDeleteCommunity}
                title="Excluir Comunidade?"
                message={`Tem certeza que deseja excluir a comunidade "${community.name}"? Esta ação apagará TODOS os dados e não pode ser desfeita.`}
                confirmText="Sim, Excluir Comunidade"
                confirmColor="bg-red-600 hover:bg-red-700"
                loading={actionLoading}
            />

            <ConfirmationModal
                isOpen={roleChangeModal.isOpen}
                onClose={() => setRoleChangeModal({ ...roleChangeModal, isOpen: false })}
                onConfirm={confirmRoleChange}
                title="Alterar Cargo?"
                message={`Deseja alterar o cargo deste membro para "${roleChangeModal.newRole}"?`}
                confirmText="Confirmar"
                confirmColor="bg-purple-600 hover:bg-purple-700"
                loading={actionLoading}
            />

            <ConfirmationModal
                isOpen={banModal.isOpen}
                onClose={() => setBanModal({ ...banModal, isOpen: false })}
                onConfirm={confirmBan}
                title="Banir Membro?"
                message={`Tem certeza que deseja remover "${banModal.username}" desta comunidade?`}
                confirmText="Sim, Banir"
                confirmColor="bg-red-600 hover:bg-red-700"
                loading={actionLoading}
            />

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />
        </div>
    );
};

export default CommunityDetails;
