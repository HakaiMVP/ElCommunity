import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAdmin } from '../hooks/useAdmin';
import { FaUserShield, FaUsers, FaSearch, FaBan, FaCheck, FaTimes, FaEdit, FaStar, FaExclamationTriangle, FaBoxOpen } from 'react-icons/fa';
import AlertModal from '../components/AlertModal';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminInventoryModal from '../components/AdminInventoryModal';
import ViewUserProfileModal from '../components/ViewUserProfileModal';
import AdminWarningsModal from '../components/AdminWarningsModal';
import { COMMUNITY_RULES } from '../constants/communityRules';

const AdminDashboard = () => {
    const { isSuperAdmin, isAdmin, loading: adminLoading } = useAdmin();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [inventoryUser, setInventoryUser] = useState(null);
    const [viewingUser, setViewingUser] = useState(null);

    // Edit User State
    const [selectedRole, setSelectedRole] = useState('user');
    const [permissions, setPermissions] = useState([]);

    // Moderation State
    const [adminWarningsUser, setAdminWarningsUser] = useState(null);
    const [banningUser, setBanningUser] = useState(null);
    const [moderationReason, setModerationReason] = useState('');
    const [banDuration, setBanDuration] = useState('permanent');

    // Stars Grant State
    const [grantStarsUser, setGrantStarsUser] = useState(null);
    const [starsAmount, setStarsAmount] = useState('');

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
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('*, user_bans!user_bans_user_id_fkey(id, expires_at)') // Fetch expires_at
                // .order('created_at', { ascending: false }) // Might not exist
                .order('id', { ascending: true }) // Safer fallback
                .limit(50); // Pagination needed for production

            if (searchTerm) {
                const term = searchTerm.trim();
                // If it starts with #, search by Display ID
                if (term.startsWith('#')) {
                    const idStr = term.substring(1);
                    // Only query if it's a valid number
                    if (!isNaN(idStr) && idStr !== '') {
                        query = query.eq('display_id', parseInt(idStr));
                    }
                } else {
                    // Otherwise search by username as before
                    query = query.ilike('username', `%${term}%`);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            showAlert('error', 'Erro', 'Erro ao carregar usuários: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers();
    };

    const openEditUser = (user) => {
        setEditingUser(user);
        setSelectedRole(user.global_role || 'user');
        setPermissions(user.custom_permissions || []);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    global_role: selectedRole,
                    custom_permissions: permissions
                })
                .eq('id', editingUser.id);

            if (error) throw error;

            showAlert('success', 'Sucesso', 'Usuário atualizado com sucesso!');
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao atualizar usuário: ' + error.message);
        }
    };

    const togglePermission = (perm) => {
        if (permissions.includes(perm)) {
            setPermissions(permissions.filter(p => p !== perm));
        } else {
            setPermissions([...permissions, perm]);
        }
    };

    // --- Moderation Actions ---

    const handleBanUser = async () => {
        if (!banningUser || !moderationReason.trim()) return showAlert('info', 'Atenção', "Digite o motivo do banimento.");
        try {
            let expiresAt = null;
            if (banDuration !== 'permanent') {
                const days = parseInt(banDuration);
                const date = new Date();
                date.setDate(date.getDate() + days);
                expiresAt = date.toISOString();
            }

            // 1. Insert Ban Record (Assuming user_bans is what determines if a user is banned)
            const { error: banError } = await supabase.from('user_bans').insert({
                user_id: banningUser.id,
                admin_id: (await supabase.auth.getUser()).data.user.id,
                reason: moderationReason,
                expires_at: expiresAt
            });
            if (banError) throw banError;

            showAlert('success', 'Banido', `Usuário ${banningUser.username} banido com sucesso.`);
            setBanningUser(null);
            setModerationReason('');
            setBanDuration('permanent');
            fetchUsers();
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao banir usuário: ' + error.message);
        }
    };

    const handleForgiveUser = async (user) => {
        showConfirm(
            'Perdoar Usuário',
            `Tem certeza que deseja perdoar (desbanir) ${user.username}?`,
            async () => {
                try {
                    console.log(`[Admin] Attempting to forgive user: ${user.username} (ID: ${user.id})`);

                    // Tentativa 1: Soft Delete (forçando que expire no passado)
                    const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
                    const { error: updateError } = await supabase
                        .from('user_bans')
                        .update({ expires_at: pastDate })
                        .eq('user_id', user.id);

                    if (updateError) {
                        console.error('[Admin] Soft delete failed:', updateError);
                    }

                    // Tentativa 2: Hard Delete (remove a entrada permanentemente)
                    // Tentamos deletar todas as entradas de ban deste usuário para garantir
                    const { error: deleteError } = await supabase
                        .from('user_bans')
                        .delete()
                        .eq('user_id', user.id);

                    if (deleteError) {
                        console.error('[Admin] Hard delete failed:', deleteError);
                        // Se o update funcionou, ainda podemos considerar sucesso visual
                        if (updateError) throw new Error(deleteError.message || "Falha ao remover registro de banimento");
                    }

                    showAlert('success', 'Perdoado', `Usuário ${user.username} perdoado!`);
                    fetchUsers();
                } catch (error) {
                    console.error('[Admin] Error in handleForgiveUser:', error);
                    showAlert('error', 'Erro', 'Erro ao perdoar usuário: ' + (error.message || 'Erro desconhecido'));
                }
            }
        );
    };

    const handleGrantStars = async () => {
        const amount = parseInt(starsAmount, 10);
        if (!grantStarsUser || isNaN(amount) || amount === 0) return showAlert('info', 'Atenção', 'Digite um valor válido.');
        try {
            const currentStars = grantStarsUser.stars ?? 0;
            const newStars = Math.max(0, currentStars + amount);
            const { error } = await supabase
                .from('profiles')
                .update({ stars: newStars })
                .eq('id', grantStarsUser.id);
            if (error) throw error;
            showAlert('success', 'Saldo Atualizado', `${amount > 0 ? '+' : ''}${amount} ⭐ para ${grantStarsUser.username}. Novo saldo: ${newStars.toLocaleString('pt-BR')} ⭐`);
            setGrantStarsUser(null);
            setStarsAmount('');
            fetchUsers();
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao conceder estrelas: ' + error.message);
        }
    };

    if (adminLoading) return <div className="p-10 text-center text-white">Verificando credenciais...</div>;
    if (!isAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado.</div>;

    return (
        <div className="p-6 text-white max-w-6xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <FaUserShield className="text-purple-500" /> Painel Administrativo
            </h1>

            {/* Stats Overview (Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#1e1f2b] p-6 rounded-xl border border-white/10">
                    <h3 className="text-gray-400 text-sm font-bold uppercase">Total de Usuários</h3>
                    <p className="text-3xl font-bold text-white mt-2">{users.length}{users.length === 50 ? '+' : ''}</p>
                </div>
                {/* Add more stats here */}
            </div>

            {/* User Management */}
            <div className="bg-[#1e1f2b] rounded-xl border border-white/10 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FaUsers className="text-blue-400" /> Gerenciar Usuários
                    </h2>
                    <form onSubmit={handleSearch} className="relative w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Buscar usuário..."
                            className="bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm w-full focus:border-purple-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </form>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20 text-gray-400 text-xs uppercase">
                                <th className="p-4">Usuário</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">#</th>
                                <th className="p-4"><FaStar className="text-yellow-400 inline" /> Stars</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {users.map((user, index) => (
                                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden cursor-pointer" onClick={() => setViewingUser(user)}>
                                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> :
                                                <div className="w-full h-full flex items-center justify-center font-bold">{user.username?.[0]}</div>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white cursor-pointer hover:underline transition-all" onClick={() => setViewingUser(user)}>{user.username}</p>
                                            <p className="text-xs text-gray-500">{user.email || 'Email oculto'}</p>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.global_role === 'super_admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            user.global_role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                user.global_role === 'moderator' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                    'bg-gray-700/50 text-gray-400'
                                            }`}>
                                            {user.global_role || 'user'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${user.user_bans && user.user_bans.some(b => !b.expires_at || new Date(b.expires_at) > new Date()) ? 'bg-red-600 text-white' : 'bg-green-500/20 text-green-400'}`}>
                                            {user.user_bans && user.user_bans.some(b => !b.expires_at || new Date(b.expires_at) > new Date()) ? 'BANIDO' : 'Ativo'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 font-mono text-sm font-bold">#{user.display_id ?? '??'}</td>
                                    <td className="p-4">
                                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                                            <FaStar className="text-xs" />{(user.stars ?? 0).toLocaleString('pt-BR')}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setInventoryUser(user)}
                                            title="Ver Inventário"
                                            className="text-purple-400 hover:text-white p-2 bg-purple-500/10 rounded-lg hover:bg-purple-500/20 transition-colors"
                                        >
                                            <FaBoxOpen />
                                        </button>

                                        {isAdmin && (
                                            <>
                                                <button
                                                    onClick={() => openEditUser(user)}
                                                    title="Editar Cargo"
                                                    className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    <FaEdit />
                                                </button>

                                                {/* Grant Stars */}
                                                <button
                                                    onClick={() => { setGrantStarsUser(user); setStarsAmount(''); }}
                                                    title="Conceder/Remover Estrelas"
                                                    className="text-yellow-400 hover:text-yellow-300 p-2 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors"
                                                >
                                                    <FaStar />
                                                </button>

                                                {/* Moderation Buttons */}
                                                <button
                                                    onClick={() => setAdminWarningsUser(user)}
                                                    title="Gerenciar Alertas"
                                                    className="text-yellow-500 hover:text-yellow-400 p-2 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors flex items-center gap-1 font-bold text-xs"
                                                >
                                                    <FaExclamationTriangle />
                                                </button>

                                                {user.user_bans && user.user_bans.some(b => !b.expires_at || new Date(b.expires_at) > new Date()) ? (
                                                    <button
                                                        onClick={() => handleForgiveUser(user)}
                                                        title="Perdoar (Desbanir)"
                                                        className="text-green-500 hover:text-green-400 p-2 bg-green-500/10 rounded-lg hover:bg-green-500/20 transition-colors"
                                                    >
                                                        😇
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => { setBanningUser(user); setModerationReason(''); setBanDuration('permanent'); }}
                                                        title="Banir"
                                                        className="text-red-500 hover:text-red-400 p-2 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                                                    >
                                                        <FaBan />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e1f2b] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Editar Usuário: <span className="text-purple-400">{editingUser.username}</span></h3>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white"><FaTimes /></button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Role Selection */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Cargo Global</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['user', 'moderator', 'admin', 'super_admin'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setSelectedRole(role)}
                                            className={`p-3 rounded-lg border text-sm font-bold transition-all ${selectedRole === role
                                                ? 'bg-purple-600 border-purple-500 text-white'
                                                : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                                                }`}
                                        >
                                            {role.replace('_', ' ').toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Permissions */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Permissões Extras</label>
                                <div className="space-y-2">
                                    {['delete_posts', 'delete_comments', 'ban_users'].map(perm => (
                                        <label key={perm} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg cursor-pointer hover:bg-white/5 border border-white/5">
                                            <input
                                                type="checkbox"
                                                checked={permissions.includes(perm)}
                                                onChange={() => togglePermission(perm)}
                                                className="accent-purple-500 w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-300 font-medium">{perm.replace('_', ' ').toUpperCase()}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20">
                            <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-transparent border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/5">Cancelar</button>
                            <button onClick={handleSaveUser} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 shadow-lg">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Warnings Modal */}
            <AdminWarningsModal
                isOpen={!!adminWarningsUser}
                user={adminWarningsUser}
                onClose={() => setAdminWarningsUser(null)}
            />

            {/* Ban User Modal */}
            {banningUser && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e1f2b] w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-red-500/10">
                            <h3 className="text-xl font-bold text-red-500 flex items-center gap-2"><FaBan /> Banir Usuário</h3>
                            <button onClick={() => setBanningUser(null)} className="text-gray-400 hover:text-white"><FaTimes /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-300 mb-4">Você está prestes a banir <span className="font-bold text-white">{banningUser.username}</span>. Isso impedirá o acesso à plataforma.</p>

                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Duração do Banimento</label>
                            <select
                                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-red-500 mb-4"
                                value={banDuration}
                                onChange={(e) => setBanDuration(e.target.value)}
                            >
                                <option value="permanent">Permanente</option>
                                <option value="3">3 dias</option>
                                <option value="7">7 dias</option>
                                <option value="15">15 dias</option>
                                <option value="30">30 dias</option>
                                <option value="60">60 dias</option>
                                <option value="90">90 dias</option>
                                <option value="365">1 ano (365 dias)</option>
                            </select>

                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Infração (Regras)</label>
                            <select
                                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-red-500 mb-4"
                                onChange={(e) => {
                                    const rule = COMMUNITY_RULES.find(r => r.id === parseInt(e.target.value));
                                    if (rule) setModerationReason(`Regra #${rule.id}: ${rule.title} - ${rule.description}`);
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>Selecione uma regra (opcional)...</option>
                                {COMMUNITY_RULES.map(rule => (
                                    <option key={rule.id} value={rule.id}>#{rule.id} - {rule.title}</option>
                                ))}
                            </select>

                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Motivo Detalhado / Personalizado</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-red-500 min-h-[100px]"
                                placeholder="Descreva o motivo da punição..."
                                value={moderationReason}
                                onChange={(e) => setModerationReason(e.target.value)}
                            />
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20">
                            <button onClick={() => setBanningUser(null)} className="flex-1 py-3 bg-transparent border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/5">Cancelar</button>
                            <button onClick={handleBanUser} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 shadow-lg">Banir Usuário</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Grant Stars Modal */}
            {grantStarsUser && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e1f2b] w-full max-w-md rounded-2xl border border-yellow-500/30 shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-yellow-500/10">
                            <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2"><FaStar /> Conceder / Remover Estrelas</h3>
                            <button onClick={() => setGrantStarsUser(null)} className="text-gray-400 hover:text-white"><FaTimes /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-300">Usuário: <span className="font-bold text-white">{grantStarsUser.username}</span></p>
                            <p className="text-gray-400 text-sm">Saldo atual: <span className="text-yellow-400 font-bold">⭐ {(grantStarsUser.stars ?? 0).toLocaleString('pt-BR')}</span></p>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Quantidade (use negativo para remover)</label>
                                <input
                                    type="number"
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-yellow-500 text-lg font-bold"
                                    placeholder="Ex: 500 ou -200"
                                    value={starsAmount}
                                    onChange={(e) => setStarsAmount(e.target.value)}
                                />
                            </div>
                            {starsAmount && !isNaN(parseInt(starsAmount)) && (
                                <p className="text-sm text-gray-400">Novo saldo: <span className="text-yellow-400 font-bold">⭐ {Math.max(0, (grantStarsUser.stars ?? 0) + parseInt(starsAmount)).toLocaleString('pt-BR')}</span></p>
                            )}
                        </div>
                        <div className="p-6 border-t border-white/5 flex gap-3 bg-black/20">
                            <button onClick={() => setGrantStarsUser(null)} className="flex-1 py-3 bg-transparent border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/5">Cancelar</button>
                            <button onClick={handleGrantStars} className="flex-1 py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 shadow-lg flex items-center justify-center gap-2"><FaStar /> Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inventory Modal */}
            <AdminInventoryModal
                isOpen={!!inventoryUser}
                user={inventoryUser}
                onClose={() => setInventoryUser(null)}
            />

            {/* Profile Modal */}
            {viewingUser && (
                <ViewUserProfileModal
                    isOpen={!!viewingUser}
                    targetUserId={viewingUser.id}
                    onClose={() => setViewingUser(null)}
                    fromAdminDashboard={true}
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

export default AdminDashboard;
