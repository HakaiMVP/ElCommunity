import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FaTimes, FaTrash, FaBoxOpen, FaMagic, FaStar } from 'react-icons/fa';
import ConfirmationModal from './ConfirmationModal';
import AlertModal from './AlertModal';

const AdminInventoryModal = ({ isOpen, onClose, user }) => {
    const [items, setItems] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Internal Alert/Confirm State
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmState({ isOpen: true, title, message, onConfirm });
    };

    useEffect(() => {
        if (isOpen && user) {
            fetchUserItems();
            fetchUserProfile();
        }
    }, [isOpen, user]);

    const fetchUserProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            setUserProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const fetchUserItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            showAlert('error', 'Erro', 'Erro ao carregar inventário: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetCosmetics = async () => {
        showConfirm('Resetar Aparência', `Deseja remover todos os cosméticos equipados (moldura e efeito) de ${user.username}? Isso corrigirá quaisquer efeitos visuais persistentes.`, async () => {
            setActionLoading(true);
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        equipped_frame: null,
                        equipped_effect: null
                    })
                    .eq('id', user.id);

                if (error) throw error;
                showAlert('success', 'Sucesso', 'Aparência resetada com sucesso.');
                fetchUserProfile();
            } catch (error) {
                console.error('Error resetting cosmetics:', error);
                showAlert('error', 'Erro', 'Erro ao resetar aparência: ' + error.message);
            } finally {
                setActionLoading(false);
            }
        });
    };

    const handleRemoveItem = async (item) => {
        showConfirm('Remover Item', `Tem certeza que deseja remover o item "${item.item_id}" do inventário de ${user.username}?`, async () => {
            setActionLoading(true);
            try {
                // 1. If item is equipped, unequip it from Profile first
                if (item.is_equipped) {
                    let updates = {};
                    if (item.item_type === 'frame') updates.equipped_frame = null;
                    if (item.item_type === 'effect') updates.equipped_effect = null;
                    if (item.item_type === 'bundle') {
                        updates.equipped_frame = null;
                        updates.equipped_effect = null;
                    }

                    if (Object.keys(updates).length > 0) {
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update(updates)
                            .eq('id', user.id);
                        if (updateError) throw updateError;
                        fetchUserProfile(); // Refresh profile data
                    }
                }

                // 2. Delete the item
                const { error } = await supabase
                    .from('user_items')
                    .delete()
                    .eq('id', item.id);

                if (error) throw error;
                showAlert('success', 'Item Removido', 'Item removido e desequipado (se necessário) com sucesso.');
                fetchUserItems(); // Refresh list
            } catch (error) {
                console.error('Error removing item:', error);
                showAlert('error', 'Erro', 'Erro ao remover item: ' + error.message);
            } finally {
                setActionLoading(false);
            }
        });
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e1f2b] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in relative">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <FaBoxOpen className="text-purple-500" />
                        Inventário de <span className="text-purple-400">{user.username}</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <FaTimes size={20} />
                    </button>
                </div>



                {/* Profile Cosmetics Status */}
                {userProfile && (userProfile.equipped_frame || userProfile.equipped_effect) && (
                    <div className="px-6 py-3 bg-purple-500/10 border-b border-white/5 flex items-center justify-between">
                        <div className="text-sm">
                            <span className="text-gray-400 mr-2">Equipado:</span>
                            <span className="text-white font-bold mr-3">
                                {userProfile.equipped_frame ? 'Moldura' : ''}
                                {userProfile.equipped_frame && userProfile.equipped_effect ? ' + ' : ''}
                                {userProfile.equipped_effect ? 'Efeito' : ''}
                            </span>
                        </div>
                        <button
                            onClick={handleResetCosmetics}
                            disabled={actionLoading}
                            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded border border-red-500/30 transition-colors"
                        >
                            Resetar Aparência
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 min-h-[300px] max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            <p>Carregando itens...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 italic border-2 border-dashed border-white/5 rounded-xl">
                            <FaBoxOpen size={40} className="mb-2 opacity-20" />
                            <p>Inventário vazio.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {items.map(item => (
                                <div key={item.id} className="bg-black/30 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${item.item_type === 'frame' ? 'bg-yellow-500/10 text-yellow-500' :
                                            item.item_type === 'effect' ? 'bg-cyan-500/10 text-cyan-500' :
                                                item.item_type === 'bundle' ? 'bg-purple-500/10 text-purple-500' :
                                                    'bg-gray-700/50 text-gray-400'
                                            }`}>
                                            {item.item_type === 'frame' && <FaStar />}
                                            {item.item_type === 'effect' && <FaMagic />}
                                            {item.item_type === 'bundle' && <FaBoxOpen />}
                                            {!['frame', 'effect', 'bundle'].includes(item.item_type) && <FaBoxOpen />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white truncate text-sm" title={item.item_id}>
                                                {formatItemId(item.item_id)}
                                            </p>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{item.item_type}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleRemoveItem(item)}
                                        disabled={actionLoading}
                                        className="text-red-500/50 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                        title="Remover Item"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-black/20 text-right">
                    <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-colors border border-white/5">
                        Fechar
                    </button>
                </div>

                {/* Internal Modals */}
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
        </div >
    );
};

// Helper utility to format item IDs nicely
const formatItemId = (id) => {
    if (!id) return 'Unknown';
    // Remove prefix like 'frame_', 'effect_'
    const parts = id.split('_');
    if (parts.length > 1) {
        // Capitalize words
        return parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
};

export default AdminInventoryModal;
