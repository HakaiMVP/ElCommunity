import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaComment, FaEnvelope, FaReply, FaExclamationTriangle } from 'react-icons/fa';

const NotificationPanel = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const panelRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'messages', 'comments'

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

    // Fetch all notifications when opened
    useEffect(() => {
        if (!isOpen || !user) return;
        fetchNotifications();
    }, [isOpen, user]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const results = [];

            // 1. Unread messages
            const { data: messages } = await supabase
                .from('messages')
                .select('id, content, created_at, sender_id, is_read')
                .eq('receiver_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(20);

            if (messages && messages.length > 0) {
                // Fetch sender profiles in batch
                const senderIds = [...new Set(messages.map(m => m.sender_id))];
                const { data: senderProfiles } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', senderIds);
                const profileMap = {};
                (senderProfiles || []).forEach(p => { profileMap[p.id] = p; });

                messages.forEach(m => {
                    const sender = profileMap[m.sender_id];
                    results.push({
                        id: `msg-${m.id}`,
                        type: 'message',
                        title: sender?.username || 'Alguém',
                        body: (m.content || '').slice(0, 100),
                        avatar: sender?.avatar_url,
                        time: m.created_at,
                        senderId: m.sender_id,
                        read: m.is_read
                    });
                });
            }

            // 2. Comments on user's posts
            const { data: userPosts } = await supabase
                .from('community_posts')
                .select('id')
                .eq('user_id', user.id);

            if (userPosts && userPosts.length > 0) {
                const postIds = userPosts.map(p => p.id);
                const { data: comments } = await supabase
                    .from('community_comments')
                    .select('id, content, created_at, user_id, post_id, parent_id, profiles:community_comments_author_fkey(username, avatar_url), posts:post_id(community_id)')
                    .in('post_id', postIds)
                    .neq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (comments) {
                    comments.forEach(c => {
                        results.push({
                            id: `cmt-${c.id}`,
                            type: c.parent_id ? 'reply' : 'comment',
                            title: c.profiles?.username || 'Alguém',
                            body: c.parent_id
                                ? `respondeu um comentário: ${(c.content || '').slice(0, 80)}`
                                : `comentou no seu post: ${(c.content || '').slice(0, 80)}`,
                            avatar: c.profiles?.avatar_url,
                            time: c.created_at,
                            postId: c.post_id,
                            communityId: c.posts?.community_id
                        });
                    });
                }
            }

            // 3. Replies to user's comments
            const { data: userComments } = await supabase
                .from('community_comments')
                .select('id')
                .eq('user_id', user.id);

            if (userComments && userComments.length > 0) {
                const commentIds = userComments.map(c => c.id);
                const { data: replies } = await supabase
                    .from('community_comments')
                    .select('id, content, created_at, user_id, post_id, parent_id, profiles:community_comments_author_fkey(username, avatar_url), posts:post_id(community_id)')
                    .in('parent_id', commentIds)
                    .neq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (replies) {
                    replies.forEach(r => {
                        // Avoid duplicates (already captured in section 2)
                        if (!results.some(n => n.id === `cmt-${r.id}`)) {
                            results.push({
                                id: `reply-${r.id}`,
                                type: 'reply',
                                title: r.profiles?.username || 'Alguém',
                                body: `respondeu você: ${(r.content || '').slice(0, 80)}`,
                                avatar: r.profiles?.avatar_url,
                                time: r.created_at,
                                postId: r.post_id,
                                communityId: r.posts?.community_id
                            });
                        }
                    });
                }
            }

            // 4. Admin Warnings
            const { data: warnings } = await supabase
                .from('user_warnings')
                .select('id, reason, created_at, acknowledged, admin:admin_id(username, avatar_url)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (warnings) {
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
            }

            // Sort by time (newest first)
            results.sort((a, b) => new Date(b.time) - new Date(a.time));
            setNotifications(results);
        } catch (err) {
            console.error('[NotificationPanel] Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleNotifClick = (notif) => {
        if (notif.type === 'message') {
            // Check if it's a market chat or friend chat
            // For simplicity, we just navigate. Chat.jsx will try to find it in either list.
            navigate(`/chat?chatUserId=${notif.senderId}`);
        } else if (notif.type === 'warning') {
            // Just mark as read if not read yet
            if (!notif.read && notif.warningId) {
                supabase.from('user_warnings').update({ acknowledged: true }).eq('id', notif.warningId).then(() => {
                    fetchNotifications();
                });
            }
        } else {
            // Navigate directly to the post if we have its ID
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
            default: return <FaComment className="text-gray-400" />;
        }
    };

    const filteredNotifs = activeTab === 'all'
        ? notifications
        : activeTab === 'messages'
            ? notifications.filter(n => n.type === 'message')
            : notifications.filter(n => n.type === 'comment' || n.type === 'reply');

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
                    { key: 'comments', label: 'Comentários' }
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
                        {filteredNotifs.map(notif => (
                            <button
                                key={notif.id}
                                onClick={() => handleNotifClick(notif)}
                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                            >
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden shrink-0 mt-0.5">
                                    {notif.avatar ? (
                                        <img src={notif.avatar} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                                            {notif.title?.[0]?.toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {getIcon(notif.type)}
                                        <span className="text-white text-sm font-semibold truncate">{notif.title}</span>
                                        <span className="text-gray-600 text-[10px] ml-auto shrink-0">{getTimeAgo(notif.time)}</span>
                                    </div>
                                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{notif.body}</p>
                                </div>

                                {/* Unread indicator */}
                                {['message', 'warning'].includes(notif.type) && !notif.read && (
                                    <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0 mt-2" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
