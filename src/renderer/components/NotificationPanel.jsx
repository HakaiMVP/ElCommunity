import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaComment, FaEnvelope, FaReply, FaExclamationTriangle, FaHeart } from 'react-icons/fa';
import { getCosmeticsForUser } from '../utils/cosmetics';

const NotificationPanel = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const panelRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const hasFetchedRef = useRef(false);
    const channelRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    // Main unified fetch function — fast, single-pass
    const fetchNotifications = useCallback(async (showLoader = false) => {
        if (!user) return;
        if (showLoader) setLoading(true);

        try {
            const results = [];

            // Run all 4 queries in PARALLEL for speed
            const [messagesRes, commentsRes, repliesRes, warningsRes, likesRes] = await Promise.all([
                // 1. Unread Messages
                supabase
                    .from('messages')
                    .select('id, content, created_at, sender_id, is_read, sender:sender_id(id, username, avatar_url, equipped_frame, equipped_effect, equipped_avatar_decoration, equipped_profile_effect, equipped_name_color, equipped_card_background)')
                    .eq('receiver_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: false })
                    .limit(20),

                // 2. Comments on user's posts (single query with join)
                supabase
                    .from('community_comments')
                    .select('id, content, created_at, user_id, post_id, parent_id, profiles:community_comments_author_fkey(id, username, avatar_url, equipped_frame, equipped_effect, equipped_avatar_decoration, equipped_profile_effect, equipped_name_color, equipped_card_background), posts:post_id(user_id, community_id)')
                    .neq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(30),

                // 3. Replies to user's comments
                supabase
                    .from('community_comments')
                    .select('id, content, created_at, user_id, post_id, parent_id, parent:parent_id(user_id), profiles:community_comments_author_fkey(id, username, avatar_url, equipped_frame, equipped_effect, equipped_avatar_decoration, equipped_profile_effect, equipped_name_color, equipped_card_background), posts:post_id(community_id)')
                    .neq('user_id', user.id)
                    .not('parent_id', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(20),

                // 4. Admin Warnings
                supabase
                    .from('user_warnings')
                    .select('id, reason, created_at, acknowledged, admin:admin_id(username, avatar_url)')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10),

                // 5. Likes on user's posts
                supabase
                    .from('community_likes')
                    .select('id, created_at, user_id, post_id, profiles:user_id(id, username, avatar_url, equipped_frame, equipped_effect, equipped_avatar_decoration, equipped_profile_effect, equipped_name_color, equipped_card_background), posts:post_id(user_id, community_id)')
                    .neq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20)
            ]);

            // Process Messages
            const messages = messagesRes.data || [];
            messages.forEach(m => {
                const sender = m.sender || {};
                results.push({
                    id: `msg-${m.id}`,
                    type: 'message',
                    title: sender.username || 'Alguém',
                    body: (m.content || '').slice(0, 100),
                    avatar: sender.avatar_url,
                    profiles: sender,
                    time: m.created_at,
                    senderId: m.sender_id,
                    read: m.is_read
                });
            });

            // Process Comments (only on user's posts)
            const allComments = commentsRes.data || [];
            const commentIdsAdded = new Set();
            allComments.forEach(c => {
                if (c.posts?.user_id === user.id) {
                    commentIdsAdded.add(c.id);
                    results.push({
                        id: `cmt-${c.id}`,
                        type: c.parent_id ? 'reply' : 'comment',
                        title: c.profiles?.username || 'Alguém',
                        body: c.parent_id
                            ? `respondeu um comentário: ${(c.content || '').slice(0, 80)}`
                            : `comentou no seu post: ${(c.content || '').slice(0, 80)}`,
                        avatar: c.profiles?.avatar_url,
                        profiles: c.profiles || {},
                        time: c.created_at,
                        postId: c.post_id,
                        communityId: c.posts?.community_id
                    });
                }
            });

            // Process Replies to user's comments
            const replies = repliesRes.data || [];
            replies.forEach(r => {
                if (r.parent?.user_id === user.id && !commentIdsAdded.has(r.id)) {
                    results.push({
                        id: `reply-${r.id}`,
                        type: 'reply',
                        title: r.profiles?.username || 'Alguém',
                        body: `respondeu você: ${(r.content || '').slice(0, 80)}`,
                        avatar: r.profiles?.avatar_url,
                        profiles: r.profiles || {},
                        time: r.created_at,
                        postId: r.post_id,
                        communityId: r.posts?.community_id
                    });
                }
            });

            // Process Warnings
            const warnings = warningsRes.data || [];
            warnings.forEach(w => {
                results.push({
                    id: `warn-${w.id}`,
                    type: 'warning',
                    title: '⚠️ Aviso da Administração',
                    body: w.reason,
                    avatar: w.admin?.avatar_url,
                    time: w.created_at,
                    warningId: w.id,
                    read: w.acknowledged
                });
            });

            // Process Likes on user's posts
            const likes = likesRes.data || [];
            likes.forEach(l => {
                if (l.posts?.user_id === user.id) {
                    results.push({
                        id: `like-${l.id}`,
                        type: 'like',
                        title: l.profiles?.username || 'Alguém',
                        body: 'curtiu seu post',
                        avatar: l.profiles?.avatar_url,
                        profiles: l.profiles || {},
                        time: l.created_at,
                        postId: l.post_id,
                        communityId: l.posts?.community_id
                    });
                }
            });

            // Sort newest first
            results.sort((a, b) => new Date(b.time) - new Date(a.time));
            setNotifications(results);
        } catch (err) {
            console.error('[NotificationPanel] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Pre-fetch on mount (background, no loading spinner)
    useEffect(() => {
        if (!user) return;
        if (!hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchNotifications(false);
        }
    }, [user, fetchNotifications]);

    // Setup real-time subscription — always active, not only when panel is open
    useEffect(() => {
        if (!user) return;

        // Clean up previous channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel(`notif_panel_${user.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => {
                fetchNotifications(false);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments' }, () => {
                fetchNotifications(false);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_warnings', filter: `user_id=eq.${user.id}` }, () => {
                fetchNotifications(false);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_likes' }, () => {
                fetchNotifications(false);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => {
                fetchNotifications(false);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [user, fetchNotifications]);

    // Refresh when panel opens (fast, no loading spinner since data is already cached)
    useEffect(() => {
        if (isOpen && user) {
            fetchNotifications(false);
        }
    }, [isOpen, user, fetchNotifications]);

    const handleNotifClick = (notif) => {
        if (notif.type === 'message') {
            navigate(`/chat?chatUserId=${notif.senderId}`);
        } else if (notif.type === 'warning') {
            if (!notif.read && notif.warningId) {
                supabase.from('user_warnings').update({ acknowledged: true }).eq('id', notif.warningId).then(() => {
                    fetchNotifications(false);
                });
            }
        } else {
            if (notif.postId) {
                navigate(`/post/${notif.postId}`);
            } else if (notif.communityId) {
                navigate(`/community/${notif.communityId}`);
            } else {
                navigate('/dashboard');
            }
        }
        onClose();
    };

    const getTimeAgo = (time) => {
        const diff = Date.now() - new Date(time).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    };

    const getIcon = (type) => {
        switch (type) {
            case 'message': return <FaEnvelope className="text-blue-400" />;
            case 'comment': return <FaComment className="text-amber-400" />;
            case 'reply': return <FaReply className="text-purple-400" />;
            case 'warning': return <FaExclamationTriangle className="text-red-500" />;
            case 'like': return <FaHeart className="text-pink-500" />;
            default: return <FaComment className="text-gray-400" />;
        }
    };

    const filteredNotifs = activeTab === 'all'
        ? notifications
        : activeTab === 'messages'
            ? notifications.filter(n => n.type === 'message')
            : notifications.filter(n => n.type === 'comment' || n.type === 'reply' || n.type === 'like');

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            className="absolute top-12 right-2 w-[380px] max-h-[500px] bg-[#1a1b2e] border border-purple-500/20 rounded-xl shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden animate-fade-in-up"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">Notificações</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <FaTimes size={14} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 px-2">
                {[
                    { key: 'all', label: 'Todas' },
                    { key: 'messages', label: 'Mensagens' },
                    { key: 'comments', label: 'Atividade' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-2 text-xs font-semibold transition-all border-b-2 ${activeTab === tab.key
                            ? 'text-purple-400 border-purple-500'
                            : 'text-gray-500 border-transparent hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                        {tab.key === 'messages' && notifications.filter(n => n.type === 'message').length > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 rounded-full">
                                {notifications.filter(n => n.type === 'message').length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredNotifs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <FaComment size={24} className="mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma notificação</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredNotifs.map(notif => {
                            const notifCosmetics = getCosmeticsForUser(notif.profiles || {});
                            return (
                                <button
                                    key={notif.id}
                                    onClick={() => handleNotifClick(notif)}
                                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                >
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full bg-gray-700 overflow-hidden shrink-0 mt-0.5 relative ${notifCosmetics.avatarBorder || ''}`}>
                                        {notif.avatar ? (
                                            <img src={notif.avatar} className="w-full h-full object-cover relative z-10" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold relative z-10">
                                                {notif.title?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {getIcon(notif.type)}
                                            <span className={`text-sm font-semibold truncate ${notifCosmetics.nameColor || 'text-white'}`}>{notif.title}</span>
                                            <span className="text-gray-600 text-[10px] ml-auto shrink-0">{getTimeAgo(notif.time)}</span>
                                        </div>
                                        <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{notif.body}</p>
                                    </div>

                                    {/* Unread indicator */}
                                    {['message', 'warning'].includes(notif.type) && !notif.read && (
                                        <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0 mt-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
