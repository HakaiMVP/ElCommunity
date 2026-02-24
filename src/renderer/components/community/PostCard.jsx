import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FaComment, FaTrash, FaHeart, FaRegHeart, FaEdit, FaSave, FaTimes, FaReply } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../hooks/useAdmin';
import { Link } from 'react-router-dom';
import ConfirmationModal from '../ConfirmationModal';
import AlertModal from '../AlertModal';
import ViewUserProfileModal from '../ViewUserProfileModal';

const PostCard = ({ post, onDelete, canComment, isModerator, showCommunityContext }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [loadingComment, setLoadingComment] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [replyingTo, setReplyingTo] = useState(null); // { id, username }

    // Like State
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.likes_count || 0); // Note: We might want to fetch real count if not joined
    const [likeLoading, setLikeLoading] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    const [editLoading, setEditLoading] = useState(false);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'error', title: 'Erro', message: '' });

    // Comment Edit/Delete State
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editCommentContent, setEditCommentContent] = useState('');
    const [editCommentLoading, setEditCommentLoading] = useState(false);
    const [deleteCommentModal, setDeleteCommentModal] = useState({ isOpen: false, commentId: null });
    const [deleteCommentLoading, setDeleteCommentLoading] = useState(false);

    // Profile Modal State
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false);

    const handleOpenProfile = (userId) => {
        if (!userId) return;
        setSelectedUserId(userId);
        setShowProfileModal(true);
    };

    // Initial load
    useEffect(() => {
        if (post.id) {
            fetchCommentCount();
            checkIfLiked();
            fetchRealLikeCount();
        }
    }, [post.id]);

    const fetchCommentCount = async () => {
        const { count } = await supabase
            .from('community_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
        setCommentCount(count || 0);
    };

    const fetchRealLikeCount = async () => {
        const { count } = await supabase
            .from('community_post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
        setLikeCount(count || 0);
    };

    const checkIfLiked = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('community_post_likes')
            .select('post_id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle to avoid 406 on no rows
        setLiked(!!data);
    };

    const toggleLike = async () => {
        if (!user || likeLoading) return;
        setLikeLoading(true); // Don't block UI, just prevent double-click

        // Optimistic Update
        const previousLiked = liked;
        const previousCount = likeCount;
        setLiked(!previousLiked);
        setLikeCount(previousLiked ? previousCount - 1 : previousCount + 1);

        try {
            if (previousLiked) {
                // Unlike
                await supabase.from('community_post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
            } else {
                // Like
                await supabase.from('community_post_likes').insert({ post_id: post.id, user_id: user.id });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert on error
            setLiked(previousLiked);
            setLikeCount(previousCount);
        } finally {
            setLikeLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editContent.trim()) return;
        setEditLoading(true);
        try {
            const { error } = await supabase
                .from('community_posts')
                .update({ content: editContent.trim() })
                .eq('id', post.id);

            if (error) throw error;
            setIsEditing(false);
            post.content = editContent.trim(); // Update prop directly (bit dirty but works for now without re-fetch parent)
        } catch (error) {
            console.error('Error updating post:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao salvar edição.' });
        } finally {
            setEditLoading(false);
        }
    };

    // ... (fetchComments, toggleComments, handlePostComment, handleDeletePost from previous step)
    // Re-implementing simplified versions for clarity in replacement
    const fetchComments = async () => {
        const { data } = await supabase
            .from('community_comments')
            .select('*, profiles:community_comments_author_fkey(username, avatar_url, equipped_frame, equipped_effect)')
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });
        setComments(data || []);
    };

    const toggleComments = () => {
        if (!showComments) fetchComments();
        setShowComments(!showComments);
    };

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setLoadingComment(true);
        try {
            const commentData = {
                post_id: post.id,
                user_id: user.id,
                content: newComment.trim()
            };
            if (replyingTo) {
                commentData.parent_id = replyingTo.id;
            }
            await supabase.from('community_comments').insert(commentData);
            setNewComment('');
            setReplyingTo(null);
            fetchComments();
            setCommentCount(prev => prev + 1);
        } catch (err) { console.error(err); }
        finally { setLoadingComment(false); }
    };

    const handleDeletePost = async () => {
        // Changed to use state for loading and modal handling
        setDeleteLoading(true);
        try {
            const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
            if (error) throw error;
            setShowDeleteModal(false); // Close modal
            if (onDelete) onDelete(post.id);
        } catch (err) {
            console.error(err);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao excluir postagem." });
        }
        finally { setDeleteLoading(false); }
    };

    const handleSaveCommentEdit = async (commentId) => {
        if (!editCommentContent.trim() || editCommentLoading) return;
        setEditCommentLoading(true);
        try {
            const { error } = await supabase
                .from('community_comments')
                .update({ content: editCommentContent.trim() })
                .eq('id', commentId)
                .eq('user_id', user?.id);

            if (error) throw error;

            // Only update local state, no full refresh needed.
            setComments(comments.map(c => c.id === commentId ? { ...c, content: editCommentContent.trim() } : c));
            setEditingCommentId(null);
        } catch (error) {
            console.error('Error updating comment:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao salvar a edição do comentário.' });
        } finally {
            setEditCommentLoading(false);
        }
    };

    const handleDeleteComment = async () => {
        const { commentId } = deleteCommentModal;
        if (!commentId || deleteCommentLoading) return;
        setDeleteCommentLoading(true);
        try {
            const { error } = await supabase
                .from('community_comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;
            setDeleteCommentModal({ isOpen: false, commentId: null });
            fetchComments();
            setCommentCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error deleting comment:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao deletar o comentário.' });
        } finally {
            setDeleteCommentLoading(false);
        }
    };

    // Helper to render content with Links and YouTube Embeds
    const renderContent = (text) => {
        if (!text) return null;

        // Split by lines to preserve formatting
        return text.split('\n').map((line, i) => {
            // Regex to find URLs
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const parts = line.split(urlRegex);

            return (
                <p key={i} className="mb-1 min-h-[1rem]">
                    {parts.map((part, j) => {
                        if (part.match(urlRegex)) {
                            // Check for YouTube
                            const ytMatch = part.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
                            if (ytMatch) {
                                return (
                                    <span key={j} className="block mt-2 mb-2 w-full aspect-video">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                                            className="w-full h-full rounded-lg"
                                            frameBorder="0"
                                            allowFullScreen
                                            title="video"
                                        />
                                    </span>
                                );
                            }
                            return <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    const renderMedia = () => {
        if (!post.image_url) return null;
        if (post.media_type === 'video') {
            return (
                <div className="mt-2 w-full bg-black rounded-lg overflow-hidden">
                    <video controls src={post.image_url} className="w-full max-h-[500px] mx-auto" />
                </div>
            );
        }
        return (
            <div className="mt-2 w-full h-64 bg-gray-900 rounded-lg overflow-hidden">
                <img src={post.image_url} alt="Post content" className="w-full h-full object-contain" />
            </div>
        );
    };

    const { isSuperAdmin, isAdmin, isModerator: isGlobalModerator, hasPermission } = useAdmin();

    const isAuthor = user?.id === post.user_id;
    // Allow delete if Author OR Local Moderator OR Global Moderator OR Permission
    const canDelete = isAuthor || isModerator || isGlobalModerator || hasPermission('delete_posts');

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-4 overflow-hidden shadow-md animate-fade-in group relative">
            {/* Header */}
            <div className="p-4 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-full bg-gray-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${post.profiles?.equipped_frame || ''}`}
                        onClick={() => handleOpenProfile(post.user_id)}
                    >
                        {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" /> :
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">{post.profiles?.username?.[0]}</div>}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p
                                className={`font-bold text-white text-sm cursor-pointer hover:underline ${post.profiles?.equipped_frame ? (post.profiles.equipped_frame.includes('name-') ? post.profiles.equipped_frame : post.profiles.equipped_frame.replace('avatar-', 'name-')) : ''}`}
                                onClick={() => handleOpenProfile(post.user_id)}
                            >
                                {post.profiles?.username || 'Usuário'}
                            </p>
                            <span className="text-xs text-gray-500">• {new Date(post.created_at).toLocaleString()}</span>
                            {showCommunityContext && post.communities && (
                                <>
                                    <span className="text-gray-600 text-xs">•</span>
                                    <Link to={`/community/${post.communities.id}`} className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors">
                                        {post.communities.name}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isAuthor && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-blue-400 p-2 transition-colors" title="Editar">
                            <FaEdit />
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={() => setShowDeleteModal(true)} className="text-gray-500 hover:text-red-500 p-2 transition-colors" title="Excluir">
                            <FaTrash />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="px-4 pb-2">
                {isEditing ? (
                    <div className="mb-2">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-700 focus:border-blue-500 outline-none resize-y min-h-[100px]"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-gray-400 hover:text-white"><FaTimes /> Cancelar</button>
                            <button onClick={handleSaveEdit} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"><FaSave /> Salvar</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-200 leading-relaxed">
                        {renderContent(post.content)}
                    </div>
                )}
            </div>

            {/* Media Attachment */}
            {renderMedia()}

            {/* Actions Bar */}
            <div className="p-4 border-t border-gray-700/50 flex items-center gap-6">
                <button
                    onClick={toggleLike}
                    disabled={!user}
                    className={`flex items-center gap-2 transition-all ${liked ? 'text-red-500 scale-105' : 'text-gray-400 hover:text-red-400'}`}
                >
                    {liked ? <FaHeart /> : <FaRegHeart />}
                    <span className="font-bold text-sm">{likeCount}</span>
                </button>
                <button
                    onClick={toggleComments}
                    className={`flex items-center gap-2 transition-colors ${showComments ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
                >
                    <FaComment /> <span className="text-sm">{commentCount} Comentários</span>
                </button>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="bg-gray-900/50 p-4 border-t border-gray-700/50">
                    <div className="space-y-3 mb-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {comments.length === 0 ? <p className="text-gray-500 text-sm text-center">Nenhum comentário.</p> :
                            (() => {
                                // 1. Map each comment to its root parent (efficiently, since comments are sorted by date)
                                const rootMap = {};
                                comments.forEach(c => {
                                    if (!c.parent_id) {
                                        rootMap[c.id] = c.id;
                                    } else {
                                        // If parent isn't in rootMap (shouldn't happen with sorted list), fallback to self as root
                                        rootMap[c.id] = rootMap[c.parent_id] || c.id;
                                    }
                                });

                                // 2. Separate top-level comments and group their descendants
                                const topLevel = comments.filter(c => !c.parent_id);
                                const threadMap = {};
                                comments.filter(c => c.parent_id).forEach(r => {
                                    const rootId = rootMap[r.id];
                                    if (!threadMap[rootId]) threadMap[rootId] = [];
                                    threadMap[rootId].push(r);
                                });

                                return topLevel.map(c => (
                                    <div key={c.id} className="border-b border-white/5 last:border-0 pb-3 last:pb-0">
                                        {/* Top-level comment */}
                                        <div className="flex gap-3 animate-fade-in-up">
                                            <div
                                                className={`w-8 h-8 rounded-full bg-gray-700 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${c.profiles?.equipped_frame || ''}`}
                                                onClick={() => handleOpenProfile(c.user_id)}
                                            >
                                                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> :
                                                    <div className="flex items-center justify-center w-full h-full text-xs font-bold">{c.profiles?.username?.[0]?.toUpperCase()}</div>}
                                            </div>
                                            <div className="bg-gray-800 p-3 rounded-lg rounded-tl-none flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p
                                                        className={`text-xs font-bold text-gray-300 mb-1 cursor-pointer hover:underline ${c.profiles?.equipped_frame ? c.profiles.equipped_frame.replace('avatar-', 'name-') : ''}`}
                                                        onClick={() => handleOpenProfile(c.user_id)}
                                                    >
                                                        {c.profiles?.username}
                                                    </p>
                                                    {(user?.id === c.user_id || canDelete) && (
                                                        <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                            {user?.id === c.user_id && !editingCommentId && (
                                                                <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-gray-400 hover:text-blue-400 p-1" title="Editar"><FaEdit className="text-[10px]" /></button>
                                                            )}
                                                            <button onClick={() => setDeleteCommentModal({ isOpen: true, commentId: c.id })} className="text-gray-400 hover:text-red-500 p-1" title="Excluir"><FaTrash className="text-[10px]" /></button>
                                                        </div>
                                                    )}
                                                </div>

                                                {editingCommentId === c.id ? (
                                                    <div className="mt-1">
                                                        <textarea
                                                            value={editCommentContent}
                                                            onChange={(e) => setEditCommentContent(e.target.value)}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-purple-500 min-h-[60px]"
                                                        />
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            <button onClick={() => setEditingCommentId(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 rounded"><FaTimes /> Cancelar</button>
                                                            <button onClick={() => handleSaveCommentEdit(c.id)} disabled={editCommentLoading} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"><FaSave /> Salvar</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.content}</p>
                                                )}
                                                {canComment && !editingCommentId && (
                                                    <button
                                                        onClick={() => setReplyingTo({ id: c.id, username: c.profiles?.username || 'Usuário' })}
                                                        className="text-xs text-gray-500 hover:text-purple-400 mt-1 flex items-center gap-1 transition-colors"
                                                    >
                                                        <FaReply className="text-[10px]" /> Responder
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* All Descendants (Replies to this comment or its children) */}
                                        {threadMap[c.id]?.map(r => (
                                            <div key={r.id} className="flex gap-3 animate-fade-in-up ml-8 mt-2">
                                                <div
                                                    className={`w-7 h-7 rounded-full bg-gray-700 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${r.profiles?.equipped_frame || ''}`}
                                                    onClick={() => handleOpenProfile(r.user_id)}
                                                >
                                                    {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} className="w-full h-full object-cover" /> :
                                                        <div className="flex items-center justify-center w-full h-full text-[10px] font-bold">{r.profiles?.username?.[0]?.toUpperCase()}</div>}
                                                </div>
                                                <div className="bg-gray-800/70 p-2.5 rounded-lg rounded-tl-none flex-1 border-l-2 border-purple-500/30">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p
                                                            className={`text-xs font-bold text-gray-300 mb-1 cursor-pointer hover:underline ${r.profiles?.equipped_frame ? r.profiles.equipped_frame.replace('avatar-', 'name-') : ''}`}
                                                            onClick={() => handleOpenProfile(r.user_id)}
                                                        >
                                                            {r.profiles?.username}
                                                        </p>
                                                        {(user?.id === r.user_id || canDelete) && (
                                                            <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                                                {user?.id === r.user_id && !editingCommentId && (
                                                                    <button onClick={() => { setEditingCommentId(r.id); setEditCommentContent(r.content); }} className="text-gray-400 hover:text-blue-400 p-1" title="Editar"><FaEdit className="text-[10px]" /></button>
                                                                )}
                                                                <button onClick={() => setDeleteCommentModal({ isOpen: true, commentId: r.id })} className="text-gray-400 hover:text-red-500 p-1" title="Excluir"><FaTrash className="text-[10px]" /></button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {editingCommentId === r.id ? (
                                                        <div className="mt-1">
                                                            <textarea
                                                                value={editCommentContent}
                                                                onChange={(e) => setEditCommentContent(e.target.value)}
                                                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:outline-none focus:border-purple-500 min-h-[60px]"
                                                            />
                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button onClick={() => setEditingCommentId(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 rounded"><FaTimes /> Cancelar</button>
                                                                <button onClick={() => handleSaveCommentEdit(r.id)} disabled={editCommentLoading} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"><FaSave /> Salvar</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-200 whitespace-pre-wrap">
                                                            <span className="text-purple-400 font-semibold text-xs">@{comments.find(p => p.id === r.parent_id)?.profiles?.username || '...'} </span>
                                                            {r.content}
                                                        </p>
                                                    )}
                                                    {canComment && !editingCommentId && (
                                                        <button
                                                            onClick={() => setReplyingTo({ id: r.id, username: r.profiles?.username || 'Usuário' })}
                                                            className="text-xs text-gray-500 hover:text-purple-400 mt-1 flex items-center gap-1 transition-colors"
                                                        >
                                                            <FaReply className="text-[10px]" /> Responder
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ));
                            })()
                        }
                    </div>

                    {/* Reply indicator */}
                    {replyingTo && (
                        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs">
                            <FaReply className="text-purple-400" />
                            <span className="text-gray-300">Respondendo a <span className="text-purple-400 font-bold">@{replyingTo.username}</span></span>
                            <button onClick={() => setReplyingTo(null)} className="ml-auto text-gray-500 hover:text-red-400 transition-colors">
                                <FaTimes />
                            </button>
                        </div>
                    )}

                    {/* Create Comment */}
                    {canComment && (
                        <form onSubmit={handlePostComment} className="flex gap-2">
                            <input
                                type="text"
                                placeholder={replyingTo ? `Responder a @${replyingTo.username}...` : 'Escreva um comentário...'}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={loadingComment}
                                autoFocus={!!replyingTo}
                            />
                            <button type="submit" disabled={!newComment.trim()} className="text-purple-500 hover:text-purple-400 font-bold px-2">
                                Enviar
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Delete Comment Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteCommentModal.isOpen}
                onClose={() => setDeleteCommentModal({ isOpen: false, commentId: null })}
                onConfirm={handleDeleteComment}
                title="Excluir Comentário"
                message="Tem certeza que deseja apagar este comentário permanentemente?"
                confirmText="Excluir"
                confirmColor="bg-red-600 hover:bg-red-700"
                loading={deleteCommentLoading}
            />

            {/* Delete Post Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeletePost}
                title="Excluir Postagem"
                message="Tem certeza que deseja apagar esta postagem permanentemente?"
                confirmText="Excluir"
                confirmColor="bg-red-600 hover:bg-red-700"
                loading={deleteLoading}
            />

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />

            <ViewUserProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                targetUserId={selectedUserId}
            />
        </div>
    );
};

export default PostCard;
