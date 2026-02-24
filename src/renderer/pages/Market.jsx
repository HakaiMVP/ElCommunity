import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaPlus, FaClock, FaComments, FaSync, FaTimes, FaTrash, FaTag } from 'react-icons/fa';

import { useNavigate } from 'react-router-dom';
import { formatUserName } from '../utils/formatUser';
import ViewUserProfileModal from '../components/ViewUserProfileModal';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';

const Market = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [myItems, setMyItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('market'); // 'market' or 'my_items'
    const [showModal, setShowModal] = useState(false);

    // Profile Modal State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState({
        title: '',
        description: '',
        price: '',
        image_url: ''
    });

    const fetchItems = async () => {
        setLoading(true);

        // 1. Fetch Active Public Items
        const { data: publicItems, error: publicError } = await supabase
            .from('market_items')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        // 2. Fetch My Items (if logged in)
        let myItemsData = [];
        if (user) {
            const { data: userItems, error: userError } = await supabase
                .from('market_items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!userError) myItemsData = userItems;
        }

        // 3. Fetch Profiles Manually for ALL items
        const allItems = [...(publicItems || []), ...myItemsData];
        const userIds = [...new Set(allItems.map(i => i.user_id))];

        const { data: profilesData } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

        const profilesMap = {};
        if (profilesData) {
            profilesData.forEach(p => {
                profilesMap[p.id] = p;
            });
        }

        // 4. Attach Profiles
        const attachProfile = (item) => ({
            ...item,
            profiles: profilesMap[item.user_id] || null
        });

        if (publicError) console.error('Error fetching market:', publicError);
        else setItems(publicItems.map(attachProfile) || []);

        setMyItems(myItemsData.map(attachProfile) || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [user, activeTab]); // Refresh when tab changes or user logs in

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!user) {
            setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: "Faça login para anunciar." });
            return;
        }

        // Calculate explicit expiration time (48h from now)
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 48);

        const { error } = await supabase
            .from('market_items')
            .insert([{
                ...newItem,
                user_id: user.id,
                author_name: user.user_metadata?.username || user.email.split('@')[0],
                expires_at: expirationDate.toISOString()
            }]);

        if (error) {
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao criar anúncio: ' + error.message });
        } else {
            setShowModal(false);
            setNewItem({ title: '', description: '', price: '', image_url: '' });
            fetchItems();
            setActiveTab('market');
        }
    };

    const handleInterest = async (item) => {
        if (!user) {
            setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: "Faça login para negociar!" });
            return;
        }
        if (user.id === item.user_id) return;

        // Check if friendship/chat already exists
        const { data: existing } = await supabase
            .from('friendships')
            .select('*')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${item.user_id}),and(user_id.eq.${item.user_id},friend_id.eq.${user.id})`)
            .single();

        let friendshipId = existing?.id;

        if (existing) {
            // Ensure negotiation is active
            if (!existing.negotiation_active) {
                const updates = { negotiation_active: true, negotiation_item_id: item.id };

                // If status was 'pending', we still want to upgrade to 'market' or 'accepted'?
                // Let's force 'market' ONLY if it's not already 'accepted'
                if (existing.status !== 'accepted' && existing.status !== 'market') {
                    updates.status = 'market';
                }

                const { error: updateError } = await supabase
                    .from('friendships')
                    .update(updates)
                    .eq('id', existing.id);

                if (updateError) {
                    console.error("Error updating friendship:", updateError);
                    setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao atualizar status da negociação: " + updateError.message });
                    return;
                }
            }
        } else {
            // Create new connection with status 'market' AND negotiation_active=true
            const { data: newFriendship, error } = await supabase.from('friendships').insert([{
                user_id: user.id,
                friend_id: item.user_id,
                requester_name: user.user_metadata?.username || user.email.split('@')[0],
                receiver_name: item.author_name,
                status: 'market',
                negotiation_active: true,
                negotiation_item_id: item.id
            }]).select().single();

            if (error) {
                setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao iniciar negociação: " + error.message });
                return;
            }
            friendshipId = newFriendship.id;
        }

        // Send automatic "Tenho interesse" message
        if (item) {
            const automaticMessage = `Olá, tenho interesse no seu item anunciado: **${item.title}** por ${item.price}.`;
            await supabase.from('messages').insert([{
                sender_id: user.id,
                receiver_id: item.user_id,
                content: automaticMessage,
                is_read: false
            }]);
        }

        navigate(`/chat?chatUserId=${item.user_id}&tab=market`);
    };

    const handleRenew = async (id) => {
        const newExpiration = new Date();
        newExpiration.setHours(newExpiration.getHours() + 48);

        const { error } = await supabase
            .from('market_items')
            .update({ expires_at: newExpiration.toISOString() })
            .eq('id', id);

        if (error) setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao renovar: ' + error.message });
        else {
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso', message: "Anúncio renovado por mais 48h!" });
            fetchItems();
        }
    };

    const openDeleteModal = (id) => {
        setPendingDeleteId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('market_items')
                .delete()
                .eq('id', pendingDeleteId);

            if (error) throw error;
            fetchItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao excluir anúncio.' });
        } finally {
            setActionLoading(false);
            setShowDeleteModal(false);
            setPendingDeleteId(null);
        }
    };

    // Helper to calculate time remaining
    const getTimeRemaining = (expiresAt) => {
        const now = new Date();
        const expiration = new Date(expiresAt);
        const diffMs = expiration - now;

        if (diffMs <= 0) return "Expirado";

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    };

    const openProfileModal = (userId) => {
        setSelectedUserId(userId);
        setShowProfileModal(true);
    };

    return (
        <div className="p-6 text-white animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">🛒 Mercado <span className="text-purple-500 text-sm bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">48h</span></h1>
                    <p className="text-gray-400">Anúncios duram 48 horas. Renove para manter ativo.</p>
                </div>

                <div className="flex gap-4">
                    {user && (
                        <div className="flex bg-black/30 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => setActiveTab('market')}
                                className={`px-4 py-1 rounded-full text-sm font-bold transition-colors ${activeTab === 'market' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Explorar
                            </button>
                            <button
                                onClick={() => setActiveTab('my_items')}
                                className={`px-4 py-1 rounded-full text-sm font-bold transition-colors ${activeTab === 'my_items' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Meus Anúncios
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => { if (!user) setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: "Faça login!" }); else setShowModal(true); }}
                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full flex items-center gap-2 font-bold shadow-lg shadow-green-900/20 transition-all hover:scale-105"
                    >
                        <FaPlus size={12} /> Anunciar
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {(activeTab === 'market' ? items : myItems).map((item) => {
                    const timeLeft = getTimeRemaining(item.expires_at);
                    const isExpired = timeLeft === "Expirado";

                    return (
                        <div key={item.id} className={`bg-[#1e1f2b] rounded-2xl overflow-hidden border transition-all duration-300 group ${isExpired ? 'border-red-500/30 opacity-75' : 'border-white/5 hover:border-purple-500/50'}`}>
                            {/* Image Area */}
                            <div className="h-48 bg-black/50 relative overflow-hidden flex items-center justify-center">
                                {item.image_url ? (
                                    <img src={item.image_url} alt={item.title} className={`w-full h-full object-cover transition-transform duration-500 ${isExpired ? 'grayscale' : 'group-hover:scale-110'}`} />
                                ) : (
                                    <FaTag className="text-4xl text-gray-700" />
                                )}

                                {/* Status Badge - Only for Owner */}
                                {user && user.id === item.user_id && (
                                    <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 backdrop-blur-md border ${isExpired ? 'bg-red-500/80 text-white border-red-400' : 'bg-green-500/80 text-white border-green-400'}`}>
                                        <FaClock size={10} /> {timeLeft}
                                    </div>
                                )}
                            </div>

                            <div className="p-5">
                                {/* Title Box */}
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-2">
                                    <h3 className="text-lg font-bold text-white truncate" title={item.title}>{item.title}</h3>
                                </div>

                                {/* Price Box */}
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-2">
                                    <p className="text-green-400 font-bold text-xl">{item.price}</p>
                                </div>

                                {/* Description Box */}
                                <div className="bg-black/20 p-3 rounded-lg border border-white/5 mb-4 h-24 overflow-hidden relative">
                                    <p className="text-gray-400 text-sm line-clamp-3">{item.description}</p>
                                </div>

                                {item.author_name && (
                                    <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5 mb-4 text-xs text-gray-500">
                                        <span
                                            className="flex items-center gap-1 cursor-pointer hover:text-purple-400 transition-colors"
                                            onClick={() => openProfileModal(item.user_id)}
                                        >
                                            <span className="font-bold text-gray-400">Vendedor:</span>
                                            {formatUserName(item.profiles, item.author_name)}
                                        </span>
                                        {user && user.id !== item.user_id && (
                                            <button onClick={() => handleInterest(item)} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors" title="Negociar">
                                                <FaComments size={10} /> Tenho Interesse
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Owner Actions */}
                                {activeTab === 'my_items' && (
                                    <div className="flex gap-2 pt-4 border-t border-white/5">
                                        {((new Date(item.expires_at) - new Date()) / (1000 * 60 * 60) <= 5) && (
                                            <button
                                                onClick={() => handleRenew(item.id)}
                                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <FaSync size={12} /> Renovar
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openDeleteModal(item.id)}
                                            className={`px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-colors ${((new Date(item.expires_at) - new Date()) / (1000 * 60 * 60) > 5) ? 'flex-1' : ''}`}
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {(activeTab === 'market' ? items : myItems).length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-500">
                        <p className="text-xl">Nenhum item encontrado.</p>
                        {activeTab === 'market' && <p className="text-sm">Seja o primeiro a anunciar!</p>}
                    </div>
                )}
            </div>

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
                        <div className="bg-[#1e1f2b] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-green-900/20 to-transparent">
                                <h2 className="text-xl font-bold text-white">Novo Anúncio</h2>
                                <button onClick={() => setShowModal(false)}><FaTimes className="text-gray-400 hover:text-white" /></button>
                            </div>

                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título do Item</label>
                                    <input required type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500"
                                        value={newItem.title} onChange={e => setNewItem({ ...newItem, title: e.target.value })} placeholder="Ex: Espada Lendária" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço / Valor</label>
                                    <input required type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500"
                                        value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} placeholder="Ex: 500kk" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                                    <textarea required rows="3" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 resize-none"
                                        value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} placeholder="Detalhes do item..." />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL da Imagem (Opcional)</label>
                                    <input type="url" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-blue-400 focus:outline-none focus:border-green-500"
                                        value={newItem.image_url} onChange={e => setNewItem({ ...newItem, image_url: e.target.value })} placeholder="https://..." />
                                </div>

                                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95">
                                    Publicar Anúncio (48h)
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Public Profile Modal */}
            <ViewUserProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                targetUserId={selectedUserId}
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                title="Excluir Anúncio?"
                message="Tem certeza que deseja excluir seu anúncio?"
                confirmText="Excluir"
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
        </div >
    );
};

export default Market;
