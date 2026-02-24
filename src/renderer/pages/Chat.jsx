import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import ViewUserProfileModal from '../components/ViewUserProfileModal';
import UserHoverCard from '../components/UserHoverCard';
import AlertModal from '../components/AlertModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { FaUserPlus, FaComments, FaCheck, FaTimes, FaCircle, FaPaperPlane, FaCheckDouble, FaTrash, FaSync } from 'react-icons/fa';

const Chat = () => {
    const { user, userProfile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [friends, setFriends] = useState([]);
    const [marketChats, setMarketChats] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [activeTab, setActiveTab] = useState('friends');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [negotiationItem, setNegotiationItem] = useState(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Profile Modal State
    const [showProfile, setShowProfile] = useState(false);
    const [serverDrift, setServerDrift] = useState(0);

    // Unread & active chat reference
    const [unreadMap, setUnreadMap] = useState({});
    const activeChatRef = useRef(null);

    // Hover Card State
    const [hoveredUser, setHoveredUser] = useState(null);
    const [hoverPosition, setHoverPosition] = useState(null);

    // Scroll: we use flex-col-reverse so the container naturally sits at the bottom.
    // We only need a ref to scroll to when a NEW message arrives.
    const messagesEndRef = useRef(null);
    const isSendingRef = useRef(false);
    // Track the ID of the last message we rendered so we know when a NEW one arrives
    const lastMessageIdRef = useRef(null);

    // Custom Alert/Confirm States
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, onCancel: null });

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    const showConfirm = (title, message, onConfirm, onCancel = null) => {
        setConfirmState({ isOpen: true, title, message, onConfirm, onCancel });
    };

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // ─── Fetch Friends & Requests ───────────────────────────────────────────
    const fetchSocials = async () => {
        if (!user) return;
        try {
            const { data: friendshipData, error: friendshipError } = await supabase
                .from('friendships')
                .select('*')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            if (friendshipError) throw friendshipError;

            const friendIds = [...new Set(friendshipData.flatMap(f => [f.user_id, f.friend_id]))];

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, display_id, last_seen, presence, cover_url, equipped_frame, equipped_effect, bio')
                .in('id', friendIds);

            if (profileError) console.error('Error fetching profiles:', profileError);

            const profileMap = new Map();
            if (profileData) {
                profileData.forEach(p => profileMap.set(p.id, p));
                const myProfile = profileMap.get(user.id);
                if (myProfile?.last_seen) {
                    const serverTime = new Date(myProfile.last_seen);
                    setServerDrift(serverTime.getTime() - Date.now());
                }
            }

            const connectionMap = new Map();
            friendshipData.forEach(row => {
                const isRequester = row.user_id === user.id;
                const friendId = isRequester ? row.friend_id : row.user_id;
                const profile = profileMap.get(friendId);
                const friendName = profile?.username
                    || (isRequester ? row.receiver_name : row.requester_name)
                    || `Usuário ${(friendId || '???').slice(0, 5)}`;

                const connection = {
                    ...row,
                    friendId,
                    friendName,
                    avatar_url: profile?.avatar_url || '',
                    display_id: profile?.display_id,
                    last_seen: profile?.last_seen,
                    presence: profile?.presence || 'offline',
                    cover_url: profile?.cover_url || '',
                    equipped_effect: profile?.equipped_effect || '',
                    equipped_frame: profile?.equipped_frame || '',
                    bio: profile?.bio || '',
                    isRequester
                };

                const existing = connectionMap.get(friendId);
                if (!existing) {
                    connectionMap.set(friendId, connection);
                } else {
                    const priority = { accepted: 3, pending: 2, market: 1 };
                    if ((priority[row.status] || 0) > (priority[existing.status] || 0)) {
                        connectionMap.set(friendId, connection);
                    }
                    const merged = connectionMap.get(friendId);
                    if (existing.negotiation_active || row.negotiation_active) merged.negotiation_active = true;
                }
            });

            const accepted = [], pending = [], market = [];
            connectionMap.forEach(c => {
                if (c.status === 'pending' && !c.isRequester) pending.push(c);
                if (c.status === 'market' || c.negotiation_active) market.push(c);
                if (c.status === 'accepted') accepted.push(c);
            });

            setFriends(accepted);
            setMarketChats(market);
            setPendingRequests(pending);

            const allConnections = Array.from(connectionMap.values());
            if (activeChatRef.current) {
                const updated = allConnections.find(c => c.friendId === activeChatRef.current.friendId);
                setActiveChat(updated || null);
            }
        } catch (err) {
            console.error('Error fetching socials:', err);
        } finally {
            setLoading(false);
        }
    };

    // ─── Social Actions ──────────────────────────────────────────────────────
    const handleSocialAction = {
        accept: async (id) => {
            const { error } = await supabase.from('friendships').update({ status: 'accepted', negotiation_active: false }).eq('id', id);
            if (error) showAlert('error', 'Erro', 'Erro ao aceitar: ' + error.message);
            fetchSocials();
        },
        reject: async (id) => {
            const { error } = await supabase.from('friendships').delete().eq('id', id);
            if (error) showAlert('error', 'Erro', 'Erro ao recusar: ' + error.message);
            fetchSocials();
        },
        addFriend: async (chat) => {
            showConfirm('Adicionar Amigo', 'Enviar solicitação de amizade?', async () => {
                const myName = user.user_metadata?.username || user.email.split('@')[0];
                const updates = { status: 'pending', requester_name: myName, receiver_name: chat.friendName };
                if (chat.friend_id === user.id) {
                    updates.user_id = user.id;
                    updates.friend_id = chat.user_id;
                }
                const { error } = await supabase.from('friendships').update(updates).eq('id', chat.id);
                if (error) showAlert('error', 'Erro', 'Erro ao enviar: ' + error.message);
                else { fetchSocials(); setShowProfile(false); }
            });
        },
        unfriend: async (chat) => {
            showConfirm('Desfazer Amizade', 'Tem certeza que deseja desfazer a amizade?', async () => {
                try {
                    if (chat.negotiation_active) {
                        const { error } = await supabase.from('friendships').update({ status: 'market' }).eq('id', chat.id);
                        if (error) throw error;
                    } else {
                        const { error } = await supabase.from('friendships').delete().eq('id', chat.id);
                        if (error) throw error;
                        setActiveChat(null);
                    }
                    fetchSocials();
                    setShowProfile(false);
                } catch (err) { showAlert('error', 'Erro', 'Erro: ' + err.message); }
            });
        },
        endNegotiation: async (chat) => {
            if (!chat.negotiation_item_id) {
                showConfirm('Finalizar Negociação', 'Tem certeza que deseja finalizar a negociação?', async () => {
                    await finalizeNegotiation(chat);
                });
                return;
            }

            let item = negotiationItem;
            if (!item) {
                const { data } = await supabase.from('market_items').select('*').eq('id', chat.negotiation_item_id).single();
                item = data;
            }
            if (!item) { await finalizeNegotiation(chat); return; }

            const isSeller = item.user_id === user.id;
            if (isSeller) {
                showConfirm('Confirmar Venda', `Confirmar venda do item "${item.title}" para ${chat.friendName}?`, () => {
                    // Nested confirm for deletion
                    setTimeout(() => {
                        showConfirm('Excluir Anúncio', 'Deseja EXCLUIR o anúncio do mercado automaticamente?',
                            async () => {
                                const { error: deleteError } = await supabase.from('market_items').delete().eq('id', item.id);
                                if (deleteError) showAlert('error', 'Erro', 'Erro ao excluir anúncio: ' + deleteError.message);
                                await finalizeNegotiation(chat);
                            },
                            async () => {
                                // User chose NOT to delete, but we still finalize
                                await finalizeNegotiation(chat);
                            }
                        );
                    }, 200); // Small delay to allow modal transition
                });
            } else {
                showConfirm('Confirmar Compra', `Marcar o item "${item.title}" como comprado?`, async () => {
                    await supabase.from('messages').insert([{
                        sender_id: user.id,
                        receiver_id: chat.friendId,
                        content: ':::CONFIRM_SALE:::',
                        is_read: false
                    }]);
                });
            }
        }
    };

    const finalizeNegotiation = async (chat) => {
        try {
            await supabase.from('messages').insert([{
                sender_id: user.id,
                receiver_id: chat.friendId,
                content: '**Venda Finalizada!** 🤝',
                is_read: false
            }]);
            const updates = { negotiation_active: false, negotiation_item_id: null };
            await supabase.from('friendships').update(updates).eq('id', chat.id);
            setMarketChats(prev => prev.map(c => c.id === chat.id ? { ...c, negotiation_active: false } : c));
            setFriends(prev => prev.map(c => c.id === chat.id ? { ...c, negotiation_active: false } : c));
            setTimeout(fetchSocials, 500);
        } catch (err) { console.error('Erro ao finalizar:', err); }
    };

    // ─── Unread Counts ───────────────────────────────────────────────────────
    const fetchUnreadCounts = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('messages')
            .select('sender_id, is_read')
            .eq('receiver_id', user.id)
            .eq('is_read', false);
        if (data) {
            const counts = {};
            data.forEach(msg => { counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1; });
            setUnreadMap(counts);
        }
    };

    useEffect(() => {
        fetchUnreadCounts();
        const interval = setInterval(fetchUnreadCounts, 5000);
        return () => clearInterval(interval);
    }, [user]);

    // ─── Fetch Messages ──────────────────────────────────────────────────────
    const fetchMessages = async () => {
        if (!activeChatRef.current || !user) return;
        const chat = activeChatRef.current;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${chat.friendId}),and(sender_id.eq.${chat.friendId},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (error) { console.error('Error messages:', error); return; }

        setMessages(prev => {
            const isDifferent = data.length !== prev.length
                || (data.length > 0 && data[data.length - 1].id !== prev[prev.length - 1]?.id)
                || (data.length > 0 && data[data.length - 1].is_read !== prev[prev.length - 1]?.is_read);
            return isDifferent ? (data || []) : prev;
        });

        // Mark as read
        if (data && data.length > 0) {
            const unreadIds = data.filter(m => !m.is_read && m.sender_id === chat.friendId).map(m => m.id);
            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
                setUnreadMap(prev => { const n = { ...prev }; delete n[chat.friendId]; return n; });
            }
        }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    const formatRelativeTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const adjustedNow = new Date(Date.now() + serverDrift);
        const diffInSeconds = Math.floor((adjustedNow - date) / 1000);
        if (diffInSeconds < 60) return 'Agora';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h`;
        return `${Math.floor(diffInSeconds / 86400)} d`;
    };

    const getUserStatus = (profile) => {
        if (!profile) return 'offline';
        const presence = profile.presence || 'offline';
        if (presence === 'offline') return 'offline';
        if (presence === 'online' && profile.last_seen) {
            const diff = (new Date(Date.now() + serverDrift) - new Date(profile.last_seen)) / 1000;
            return diff < 90 ? 'online' : 'offline';
        }
        return presence === 'online' ? 'online' : 'offline';
    };

    // ─── Effects ─────────────────────────────────────────────────────────────
    useEffect(() => { fetchSocials(); }, [user, searchParams]);

    // Auto-open chat from URL params
    useEffect(() => {
        const chatUserId = searchParams.get('chatUserId');
        const tabParam = searchParams.get('tab');
        if (tabParam === 'market') setActiveTab('market');
        else if (tabParam === 'friends') setActiveTab('friends');

        if (chatUserId && (friends.length > 0 || marketChats.length > 0)) {
            const friendChat = friends.find(f => f.friendId === chatUserId);
            const marketChat = marketChats.find(f => f.friendId === chatUserId);
            if (marketChat) { setActiveChat(marketChat); setActiveTab('market'); }
            else if (friendChat) {
                if (tabParam === 'market') {
                    const optimistic = { ...friendChat, status: 'market' };
                    setMarketChats(prev => prev.some(p => p.id === optimistic.id) ? prev : [...prev, optimistic]);
                    setActiveChat(optimistic);
                    setActiveTab('market');
                } else {
                    setActiveChat(friendChat);
                    setActiveTab('friends');
                }
            }
        }
    }, [searchParams, friends, marketChats]);

    // Fetch & poll messages when active chat changes
    useEffect(() => {
        if (activeChat) {
            setMessages([]); // Clear immediately so old messages don't flash
            lastMessageIdRef.current = null;
            fetchMessages();
            if (activeChat.negotiation_item_id) {
                supabase.from('market_items').select('*').eq('id', activeChat.negotiation_item_id).single()
                    .then(({ data }) => setNegotiationItem(data));
            } else {
                setNegotiationItem(null);
            }
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        } else {
            setMessages([]);
            setNegotiationItem(null);
        }
    }, [activeChat]);

    // Realtime subscription
    useEffect(() => {
        if (!user) return;

        const messageChannel = supabase
            .channel(`room_user_messages_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
                const currentChat = activeChatRef.current;
                if (payload.eventType === 'INSERT') {
                    if (currentChat && (payload.new.sender_id === currentChat.friendId || payload.new.sender_id === user.id)) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === payload.new.id)) return prev;
                            return [...prev, payload.new];
                        });
                        if (payload.new.sender_id === currentChat.friendId) {
                            supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
                        }
                    }
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg));
                }
            })
            .subscribe();

        const friendshipChannelA = supabase
            .channel(`room_friendships_user_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_id=eq.${user.id}` }, () => fetchSocials())
            .subscribe();

        const friendshipChannelB = supabase
            .channel(`room_friendships_friend_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `friend_id=eq.${user.id}` }, () => fetchSocials())
            .subscribe();

        const profileChannel = supabase
            .channel(`room_friends_profiles_${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                const updated = payload.new;
                setFriends(prev => prev.map(f => f.friendId === updated.id ? { ...f, last_seen: updated.last_seen, presence: updated.presence } : f));
                setMarketChats(prev => prev.map(c => c.friendId === updated.id ? { ...c, last_seen: updated.last_seen, presence: updated.presence } : c));
                setActiveChat(prev => prev && prev.friendId === updated.id ? { ...prev, last_seen: updated.last_seen, presence: updated.presence } : prev);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(messageChannel);
            supabase.removeChannel(friendshipChannelA);
            supabase.removeChannel(friendshipChannelB);
            supabase.removeChannel(profileChannel);
        };
    }, [user]);

    // Scroll to bottom ONLY when a brand-new message appears (not on initial load)
    // The flex-col-reverse container handles initial positioning via CSS — no JS needed.
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        const isNewMessage = lastMessageIdRef.current !== null && lastMsg.id !== lastMessageIdRef.current;

        if (isNewMessage || isSendingRef.current) {
            // Smooth scroll for genuinely new messages
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            isSendingRef.current = false;
        }
        lastMessageIdRef.current = lastMsg.id;
    }, [messages]);

    // ─── Send Message ────────────────────────────────────────────────────────
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat) return;

        const messageContent = newMessage;
        setNewMessage('');
        isSendingRef.current = true;

        // Optimistic update
        const tempId = 'temp-' + Date.now();
        const optimisticMsg = {
            id: tempId,
            sender_id: user.id,
            receiver_id: activeChat.friendId,
            content: messageContent,
            created_at: new Date().toISOString(),
            is_read: false
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const { data, error } = await supabase.from('messages').insert([{
            sender_id: user.id,
            receiver_id: activeChat.friendId,
            content: messageContent
        }]).select().single();

        if (error) {
            console.error('Error sending:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            showAlert('error', 'Erro', 'Erro ao enviar: ' + error.message);
        } else {
            setMessages(prev => prev.map(m => m.id === tempId ? data : m));
        }
    };

    // ─── Search ───────────────────────────────────────────────────────────────
    const handleSearch = async (query) => {
        setSearchQuery(query);
        const q = query.trim();
        if (q.length < (q.startsWith('#') ? 2 : 3)) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            let data = [], searchError = null;
            if (q.startsWith('#')) {
                const id = parseInt(q.replace('#', ''), 10);
                if (!isNaN(id)) {
                    const result = await supabase.from('profiles').select('id, username, avatar_url, display_id').eq('display_id', id);
                    data = result.data || []; searchError = result.error;
                }
            } else {
                const result = await supabase.rpc('search_users_with_ids', { search_term: q });
                data = result.data || []; searchError = result.error;
                if (searchError) {
                    const fb = await supabase.from('profiles').select('id, username, avatar_url, display_id').ilike('username', `%${q}%`).limit(20);
                    data = fb.data || []; searchError = null;
                }
            }
            if (!searchError && data) {
                const allIds = new Set([...friends.map(f => f.friendId), ...marketChats.map(f => f.friendId), ...pendingRequests.map(f => f.friendId)]);
                setSearchResults(data.filter(u => u.id !== user.id && !allIds.has(u.id)));
            }
        } catch (err) { console.error('Search error:', err); }
        finally { setIsSearching(false); }
    };

    const handleSendRequest = async (targetUser) => {
        const existingConnection = [...friends, ...marketChats, ...pendingRequests].find(f => f.friendId === targetUser.id);
        if (existingConnection) { showAlert('info', 'Atenção', 'Você já possui uma conexão com este usuário.'); return; }
        const { error } = await supabase.from('friendships').insert([{
            user_id: user.id,
            friend_id: targetUser.id,
            requester_name: user.user_metadata?.username || user.email.split('@')[0],
            receiver_name: targetUser.username,
            status: 'pending'
        }]);
        if (error) {
            showAlert('error', 'Erro', error.code === '23505' ? 'Já existe uma solicitação pendente com este usuário.' : 'Erro ao enviar solicitação: ' + error.message);
        } else {
            showAlert('success', 'Sucesso', 'Solicitação enviada!');
            setSearchQuery('');
            setSearchResults([]);
            fetchSocials();
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-2rem)] text-white animate-fade-in gap-6 p-6">
            {/* Sidebar */}
            <div className="w-80 bg-[#161721] flex flex-col border-r border-white/5 relative z-20">
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400">
                            <FaComments size={20} />
                        </div>
                        <h2 className="text-lg font-bold">Conversas</h2>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-black/40 p-1 rounded-xl">
                        <button onClick={() => setActiveTab('friends')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'friends' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Amigos</button>
                        <button onClick={() => setActiveTab('market')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'market' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Negociações</button>
                    </div>

                    {/* Search */}
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="🔍 Buscar usuário ou #ID..."
                            className="w-full bg-black/30 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-purple-500"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto custom-scrollbar bg-black/60 rounded p-1 border border-purple-500/30 shadow-2xl animate-in fade-in slide-in-from-top-2">
                                <p className="text-[10px] font-bold text-purple-400 px-1 mb-1 uppercase">Resultado da Busca</p>
                                {searchResults.map(u => (
                                    <div key={u.id} className="flex justify-between items-center p-2 hover:bg-white/5 rounded border border-transparent hover:border-white/5 transition-all">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                                                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.username || '?').slice(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-200 font-medium truncate w-32" title={u.username}>{u.username}</span>
                                                <span className="text-[10px] text-purple-400 font-bold">#{u.display_id ?? '...'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleSendRequest(u)} className="p-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-all shadow-lg active:scale-95"><FaUserPlus size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isSearching && <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><FaSync className="animate-spin" /> Buscando...</p>}
                    </div>

                    {/* Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-3">
                            <h3 className="text-[10px] font-bold text-purple-400 uppercase mb-2 flex items-center gap-1"><FaUserPlus /> Solicitações</h3>
                            <div className="space-y-2">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between text-xs bg-black/40 p-2 rounded-lg border border-white/5">
                                        <span className="truncate text-gray-300 w-24">{req.requester_name || req.user_id.slice(0, 8)}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleSocialAction.accept(req.id)} className="p-1.5 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded-lg transition-all" title="Aceitar"><FaCheck size={10} /></button>
                                            <button onClick={() => handleSocialAction.reject(req.id)} className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all" title="Recusar"><FaTimes size={10} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-2 space-y-1">
                        {(activeTab === 'friends' ? friends : marketChats)
                            .filter(c => {
                                if (!searchQuery) return true;
                                const q = searchQuery.toLowerCase();
                                return (c.friendName || '').toLowerCase().includes(q) ||
                                    (c.display_id != null && `#${c.display_id}`.includes(q));
                            })
                            .map(chat => {
                                const isMarket = activeTab === 'market';
                                const isActive = activeChat?.id === chat.id;

                                const hasMagma = chat.equipped_frame === 'avatar-magma' || chat.equipped_effect === 'effect-king_of_curses';
                                const hasGold = chat.equipped_frame === 'avatar-gold';
                                const hasNeon = chat.equipped_frame === 'avatar-neon' || chat.equipped_effect === 'effect-domain_expansion';
                                const hasLightning = chat.equipped_frame === 'avatar-lightning' || chat.equipped_effect === 'effect-lightning_storm';
                                const hasGalaxy = chat.equipped_frame === 'avatar-galaxy' || chat.equipped_effect === 'effect-dark_galaxy';

                                const activeBg = hasMagma ? 'bg-[#1a0500]/90 border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                                    : hasGold ? 'bg-black/90 border-yellow-500/80 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                        : hasNeon ? 'bg-[#0d001a]/90 border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                            : hasLightning ? 'bg-[#000d1a]/90 border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                                : hasGalaxy ? 'bg-[#0a0015]/90 border-purple-400/80 shadow-[0_0_15px_rgba(157,78,221,0.5)]'
                                                    : 'bg-[#2d2f3b] border-purple-500/50 shadow-md';

                                const hoverBg = hasMagma ? 'hover:bg-[#1a0500]/90 hover:border-orange-500/80 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]'
                                    : hasGold ? 'hover:bg-black/90 hover:border-yellow-500/80 hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                                        : hasNeon ? 'hover:bg-[#0d001a]/90 hover:border-purple-500/80 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                            : hasLightning ? 'hover:bg-[#000d1a]/90 hover:border-yellow-400/80 hover:shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                                                : hasGalaxy ? 'hover:bg-[#0a0015]/90 hover:border-purple-400/80 hover:shadow-[0_0_15px_rgba(157,78,221,0.5)]'
                                                    : '';

                                const nameColor = hasMagma ? 'text-orange-500 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]'
                                    : hasGold ? 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]'
                                        : hasNeon ? 'text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]'
                                            : hasLightning ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)]'
                                                : hasGalaxy ? 'text-purple-300 drop-shadow-[0_0_5px_rgba(216,180,254,0.8)]'
                                                    : 'text-gray-300 group-hover:text-white';

                                const avatarBorder = hasMagma ? 'border-2 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                                    : hasGold ? 'border-2 border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'
                                        : hasNeon ? 'border-2 border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                                            : hasLightning ? 'border-2 border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]'
                                                : hasGalaxy ? 'border-2 border-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]'
                                                    : '';

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => setActiveChat(chat)}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoverPosition({ top: rect.top, left: rect.right });
                                            setHoveredUser(chat);
                                        }}
                                        onMouseLeave={() => setHoveredUser(null)}
                                        className={`w-full group flex items-center gap-3 p-3 rounded-xl transition-colors relative border overflow-hidden ${isActive ? activeBg : `border-transparent hover:bg-white/5 ${hoverBg}`} ${chat.equipped_effect || ''}`}
                                    >
                                        {chat.equipped_effect && (
                                            <div className="absolute inset-0 bg-[#161721]/60 pointer-events-none z-0"></div>
                                        )}
                                        <div className={`relative z-10 w-10 h-10 rounded-full bg-gradient-to-br ${isMarket ? 'from-green-600 to-teal-700' : 'from-blue-600 to-purple-700'} flex items-center justify-center font-bold text-sm text-white overflow-hidden flex-shrink-0 ${avatarBorder}`}>
                                            {chat.avatar_url ? <img src={chat.avatar_url} alt="" className="w-full h-full object-cover" /> : (isMarket ? '$' : (chat.friendName || '?').slice(0, 1).toUpperCase())}
                                        </div>
                                        <div className="relative z-10 text-left overflow-hidden flex-1">
                                            <div className="flex justify-between items-center">
                                                <p className={`font-bold truncate text-sm transition-colors ${nameColor}`}>{chat.friendName}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-500">
                                                {isMarket ? (
                                                    <span className="text-green-500/80 font-medium">Negociação Ativa</span>
                                                ) : (
                                                    (() => {
                                                        const status = getUserStatus(chat);
                                                        return status === 'online'
                                                            ? <span className="text-green-400 font-semibold flex items-center gap-1"><FaCircle size={6} /> Online</span>
                                                            : <span>Visto há {formatRelativeTime(chat.last_seen)}</span>;
                                                    })()
                                                )}
                                            </p>
                                        </div>
                                        {unreadMap[chat.friendId] > 0 && (
                                            <div className="min-w-[20px] h-5 bg-green-500 text-black text-[10px] font-bold flex items-center justify-center rounded-full px-1 shadow-lg animate-pulse">
                                                {unreadMap[chat.friendId]}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}

                        {activeTab === 'friends' && friends.length === 0 && !searchQuery && (
                            <p className="text-center text-gray-500 text-[11px] py-10 px-4 italic">Você ainda não tem amigos conectados.</p>
                        )}
                        {activeTab === 'market' && marketChats.length === 0 && !searchQuery && (
                            <p className="text-center text-gray-500 text-[11px] py-10 px-4 italic">Nenhuma negociação ativa.</p>
                        )}
                        {searchQuery && [...friends, ...marketChats].filter(c => {
                            const q = searchQuery.toLowerCase();
                            return (c.friendName || '').toLowerCase().includes(q) || (c.display_id != null && `#${c.display_id}`.includes(q));
                        }).length === 0 && searchResults.length === 0 && (
                                <p className="text-center text-gray-500 text-[11px] py-10 px-4 italic">Nenhum resultado para "{searchQuery}".</p>
                            )}
                    </div>
                </div>
            </div>

            {/* Hover Card */}
            <UserHoverCard user={hoveredUser} position={hoverPosition} />

            {/* Chat Window Wrapper */}
            <div className={`flex-1 rounded-2xl flex flex-col overflow-hidden relative border border-white/5 ${userProfile?.equipped_effect ? userProfile.equipped_effect : 'bg-[#1e1f2b]'}`}>

                {/* 
                  * The background effect base layer. 
                  * If an effect is active, we put a dark layer over it so it isn't blinding.
                  */}
                {userProfile?.equipped_effect && (
                    <div className={`absolute inset-0 pointer-events-none z-0 transition-all duration-700 ${activeChat ? 'bg-[#1e1f2b]/95 backdrop-blur-sm' : 'bg-[#1e1f2b]/10 backdrop-blur-none'}`}></div>
                )}

                {/* Main Content Area Container - Must be above the absolute effect elements */}
                <div className="flex-1 flex flex-col relative z-10 w-full h-full">
                    {activeChat ? (
                        (() => {
                            const hasMagma = activeChat.equipped_frame === 'avatar-magma' || activeChat.equipped_effect === 'effect-king_of_curses';
                            const hasGold = activeChat.equipped_frame === 'avatar-gold';
                            const hasNeon = activeChat.equipped_frame === 'avatar-neon' || activeChat.equipped_effect === 'effect-domain_expansion';
                            const hasLightning = activeChat.equipped_frame === 'avatar-lightning' || activeChat.equipped_effect === 'effect-lightning_storm';
                            const hasGalaxy = activeChat.equipped_frame === 'avatar-galaxy' || activeChat.equipped_effect === 'effect-dark_galaxy';

                            const headerNameColor = hasMagma ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                                : hasGold ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]'
                                    : hasNeon ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]'
                                        : hasLightning ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                                            : hasGalaxy ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]'
                                                : 'text-white';

                            const headerAvatarBorder = hasMagma ? 'border-[3px] border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]'
                                : hasGold ? 'border-[3px] border-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.6)]'
                                    : hasNeon ? 'border-[3px] border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]'
                                        : hasLightning ? 'border-[3px] border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]'
                                            : hasGalaxy ? 'border-[3px] border-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.6)]'
                                                : '';

                            return (
                                <>
                                    {/* Header */}
                                    <div className="p-4 border-b border-white/5 bg-[#161721] flex items-center justify-between shadow-md z-10 flex-shrink-0">
                                        <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 px-2 py-1 rounded-lg transition-colors" onClick={() => setShowProfile(true)}>
                                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center font-bold overflow-hidden flex-shrink-0 ${headerAvatarBorder}`}>
                                                {activeChat.avatar_url ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" /> : (activeChat.friendName || '?').slice(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className={`font-bold text-lg ${headerNameColor}`}>{activeChat.friendName}</h3>
                                                {(() => {
                                                    const status = getUserStatus(activeChat);
                                                    return status === 'online'
                                                        ? <p className="text-xs text-green-400 font-bold flex items-center gap-1"><FaCircle size={6} /> Online</p>
                                                        : <p className="text-xs text-gray-500 font-bold">Visto há {formatRelativeTime(activeChat.last_seen)}</p>;
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(activeChat.negotiation_active || activeChat.status === 'market') && (
                                                <button onClick={() => handleSocialAction.endNegotiation(activeChat)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg active:scale-95">
                                                    <FaTimes /> Finalizar Negociação
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Messages Area */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col-reverse">
                                        <div className="p-6 space-y-4">
                                            {messages.map((msg, index) => {
                                                const isMe = msg.sender_id === user.id;
                                                const isLastMsg = index === messages.length - 1;
                                                return (
                                                    <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isLastMsg ? 'animate-slide-in' : ''}`}>
                                                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm relative ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-[#2d2f3b] text-gray-200 rounded-tl-none border border-white/5'}`}>
                                                            {msg.content === ':::CONFIRM_SALE:::' ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="font-bold text-yellow-400 flex items-center gap-1">⚠️ Confirmação de Venda</p>
                                                                    <p className="opacity-90">{isMe ? 'Você marcou como comprado. Aguardando vendedor.' : `${activeChat.friendName} marcou como comprado.`}</p>
                                                                    {!isMe && negotiationItem && negotiationItem.user_id === user.id && (
                                                                        <button onClick={() => handleSocialAction.endNegotiation(activeChat)} className="mt-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors shadow-lg active:scale-95">
                                                                            ✅ Confirmar Venda
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</span>
                                                            )}
                                                            <div className={`text-[10px] mt-1 flex items-center gap-2 ${isMe ? 'text-purple-200 justify-end' : 'text-gray-500'}`}>
                                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                {isMe && (
                                                                    <span className="inline-block">
                                                                        {msg.is_read ? <FaCheckDouble className="text-green-300 inline" size={10} /> : <FaCheckDouble className="text-white/40 inline" size={10} />}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    </div>

                                    {/* Input */}
                                    <form onSubmit={handleSendMessage} className="p-4 bg-[#161721] border-t border-white/5 flex-shrink-0">
                                        <div className="flex gap-2 relative">
                                            <input
                                                type="text"
                                                className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                                                placeholder="Digite sua mensagem..."
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                            />
                                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-all active:scale-95 shadow-lg">
                                                <FaPaperPlane size={14} />
                                            </button>
                                        </div>
                                    </form>
                                </>
                            );
                        })()
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500/50">
                            <FaComments size={80} className="mb-4 opacity-10 animate-pulse" />
                            <p className="text-xl font-medium">Selecione uma conversa</p>
                            <p className="text-sm mt-1 opacity-60">Escolha um amigo ou negociação para começar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            {showProfile && activeChat && (
                <ViewUserProfileModal
                    targetUserId={activeChat.friendId}
                    isOpen={showProfile}
                    onClose={() => setShowProfile(false)}
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
                onClose={() => {
                    if (confirmState.onCancel) confirmState.onCancel();
                    setConfirmState({ ...confirmState, isOpen: false });
                }}
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

export default Chat;
