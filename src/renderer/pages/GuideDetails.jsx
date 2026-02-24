import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaHeart, FaVideo, FaImage, FaParagraph, FaEdit, FaTrash, FaSave, FaTimes, FaEye, FaUserPlus, FaUserCheck } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../hooks/useAdmin';
import { formatUserName, getUserAvatar } from '../utils/formatUser';
import ViewUserProfileModal from '../components/ViewUserProfileModal';
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';

const GuideDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isSuperAdmin } = useAdmin();
    const [guide, setGuide] = useState(null);
    const [loading, setLoading] = useState(true);
    const [friendshipStatus, setFriendshipStatus] = useState(null); // 'none', 'pending', 'accepted'

    // Profile Modal State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);

    // Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedBlocks, setEditedBlocks] = useState([]);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        const fetchGuide = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('guides')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching guide:', error);
                navigate('/guides');
            } else {
                let isLiked = false;
                if (user) {
                    // Check Like Status
                    const { data: likeData } = await supabase
                        .from('guide_likes')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('guide_id', id)
                        .single();

                    if (likeData) isLiked = true;

                    // Check Friendship Status (New)
                    let status = 'none';
                    if (user && user.id !== data.author_id) {
                        const { data: friendship } = await supabase
                            .from('friendships')
                            .select('status, user_id, friend_id')
                            .or(`and(user_id.eq.${user.id},friend_id.eq.${data.author_id}),and(user_id.eq.${data.author_id},friend_id.eq.${user.id})`)
                            .single();

                        if (friendship) {
                            status = friendship.status;
                        }
                    }
                    setFriendshipStatus(status);

                    // Register View
                    supabase
                        .from('guide_views')
                        .insert([{ user_id: user.id, guide_id: id }])
                        .then(({ error }) => {
                            if (error && error.code !== '23505') {
                                console.error("Error registering view:", error);
                            }
                        });
                }

                // Manual Profile Fetch (Robust)
                try {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('*, equipped_frame, equipped_effect') // Fetch frame and effect
                        .eq('id', data.author_id)
                        .single();

                    if (profileData) {
                        setGuide({ ...data, isLiked, profiles: profileData });
                    } else {
                        // Fallback if profile not found (should be rare with nuclear option)
                        setGuide({ ...data, isLiked, profiles: null });
                    }
                } catch (err) {
                    console.error("Profile fetch error:", err);
                    setGuide({ ...data, isLiked, profiles: null });
                }

                setEditedTitle(data.title);
                setEditedBlocks(data.blocks || []);
            }
            setLoading(false);
        };

        fetchGuide();
    }, [id, navigate, user]);

    // -- Actions --

    const toggleLike = async () => {
        if (!guide || !user) {
            if (!user) setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: 'Faça login para curtir!' });
            return;
        }

        const isLiked = guide.isLiked;
        const newLikes = isLiked ? (guide.likes - 1) : (guide.likes + 1);

        // Optimistic Update
        setGuide({ ...guide, likes: newLikes, isLiked: !isLiked });

        try {
            if (isLiked) {
                // Unlike
                const { error } = await supabase
                    .from('guide_likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('guide_id', guide.id); // Use guide.id directly
                if (error) throw error;
            } else {
                // Like
                const { error } = await supabase
                    .from('guide_likes')
                    .insert([{ user_id: user.id, guide_id: guide.id }]);
                if (error) throw error;
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao curtir: " + (error.message || "Erro desconhecido.") });
            // Revert optimistic update on error
            setGuide({ ...guide, likes: guide.likes, isLiked: isLiked });
        }
    };

    const handleDelete = async () => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from('guides').delete().eq('id', id);
            if (error) throw error;
            navigate('/guides');
        } catch (error) {
            console.error("Delete guide error:", error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao excluir: " + error.message });
        } finally {
            setActionLoading(false);
            setShowDeleteModal(false);
        }
    };

    const handleAddFriend = async () => {
        if (!user) {
            setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: 'Faça login para adicionar amigos!' });
            return;
        }
        if (user.id === guide.author_id) return;

        const { error } = await supabase.from('friendships').insert([{
            user_id: user.id,
            friend_id: guide.author_id,
            requester_name: user.user_metadata?.username || user.email.split('@')[0],
            receiver_name: guide.author_name,
            status: 'pending'
        }]);

        if (error) {
            if (error.code === '23505') setAlertState({ isOpen: true, type: 'info', title: 'Aviso', message: "Você já enviou uma solicitação ou já são amigos." });
            else setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao enviar solicitação: " + error.message });
        } else {
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso', message: "Solicitação de amizade enviada!" });
            setFriendshipStatus('pending');
        }
    };

    const openProfileModal = (userId) => {
        setSelectedUserId(userId);
        setShowProfileModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editedTitle.trim()) {
            setAlertState({ isOpen: true, type: 'warning', title: 'Título Vazio', message: "O título não pode estar vazio." });
            return;
        }

        // Generate updated preview (legacy support)
        const firstTextBlock = editedBlocks.find(b => b.type === 'text');
        const previewContent = firstTextBlock ? firstTextBlock.content.substring(0, 150) + '...' : 'Conteúdo visual...';

        const { error } = await supabase.from('guides').update({
            title: editedTitle,
            blocks: editedBlocks,
            content: previewContent
        }).eq('id', id);

        if (error) {
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: "Erro ao salvar: " + error.message });
        } else {
            setGuide({ ...guide, title: editedTitle, blocks: editedBlocks, content: previewContent });
            setIsEditing(false);
        }
    };

    // -- Editor Logic (Copied from Guides.jsx for consistency) --

    const addBlock = (type) => {
        setEditedBlocks([...editedBlocks, { id: Date.now(), type, content: '' }]);
    };

    const updateBlock = (blockId, content) => {
        setEditedBlocks(editedBlocks.map(b => b.id === blockId ? { ...b, content } : b));
    };

    const removeBlock = (blockId) => {
        setEditedBlocks(editedBlocks.filter(b => b.id !== blockId));
    };

    const moveBlock = (index, direction) => {
        const newBlocks = [...editedBlocks];
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        setEditedBlocks(newBlocks);
    };

    // -- Rendering --

    const renderBlockDisplay = (block) => {
        switch (block.type) {
            case 'text':
                return <p key={block.id} className="text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap text-lg">{block.content}</p>;
            case 'image':
                return (
                    <div key={block.id} className="mb-8 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                        {/* Improved Image Rendering: No max-height, keeping original aspect ratio broadly */}
                        <img src={block.content} alt="Media" className="w-full h-auto object-contain bg-black/20" />
                    </div>
                );
            case 'video':
                // Simple Helper to extract YouTube ID
                const getYouTubeId = (url) => {
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = url.match(regExp);
                    return (match && match[2].length === 11) ? match[2] : null;
                };

                const videoId = getYouTubeId(block.content);

                return (
                    <div key={block.id} className="mb-8 rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-black/50">
                        {videoId ? (
                            <div className="relative pt-[56.25%]"> {/* 16:9 Aspect Ratio */}
                                <iframe
                                    className="absolute top-0 left-0 w-full h-full"
                                    src={`https://www.youtube.com/embed/${videoId}`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        ) : (
                            // Fallback for non-YouTube links
                            <div className="p-8 text-center bg-purple-900/10">
                                <FaVideo className="mx-auto text-5xl mb-4 text-purple-400 opacity-80" />
                                <a href={block.content} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-white underline text-xl font-bold">
                                    Assistir Vídeo Externo
                                </a>
                                <p className="text-gray-500 text-sm mt-2">{block.content}</p>
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    const renderBlockEditor = (block, index) => {
        return (
            <div key={block.id} className="relative group bg-black/20 p-6 rounded-xl border border-white/10 mb-6 transition-colors hover:border-purple-500/30">
                <div className="absolute top-2 right-2 flex gap-2">
                    <button onClick={() => moveBlock(index, 'up')} className="p-2 hover:text-purple-400 text-gray-500" title="Mover Cima">▲</button>
                    <button onClick={() => moveBlock(index, 'down')} className="p-2 hover:text-purple-400 text-gray-500" title="Mover Baixo">▼</button>
                    <button onClick={() => removeBlock(block.id)} className="p-2 hover:text-red-400 text-gray-500" title="Remover"><FaTrash size={14} /></button>
                </div>

                <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    {block.type === 'image' && <><FaImage /> Imagem URL</>}
                    {block.type === 'video' && <><FaVideo /> Vídeo URL</>}
                    {block.type === 'text' && <><FaParagraph /> Parágrafo</>}
                </label>

                {block.type === 'text' ? (
                    <textarea
                        rows="5"
                        className="w-full bg-black/20 border border-white/5 rounded-lg p-4 text-gray-300 focus:outline-none focus:border-purple-500 resize-y"
                        value={block.content}
                        onChange={e => updateBlock(block.id, e.target.value)}
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        <input
                            type="url"
                            className="w-full bg-black/20 border border-white/5 rounded-lg p-3 text-blue-400 focus:outline-none focus:border-purple-500"
                            value={block.content}
                            onChange={e => updateBlock(block.id, e.target.value)}
                        />
                        {block.content && block.type === 'image' && (
                            <img src={block.content} alt="Preview" className="h-48 object-contain rounded bg-black/50 self-start border border-white/10" />
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Carregando transmissão...</div>;
    if (!guide) return null;

    const isOwner = (user && guide && user.id === guide.author_id) || false;
    const canManage = isOwner || isSuperAdmin; // Allows Super Admin to edit/delete

    return (
        <div className={`p-6 md:p-10 text-white animate-fade-in max-w-5xl mx-auto pb-20 relative ${guide.profiles?.equipped_effect || ''}`}>
            <button
                onClick={() => navigate('/guides')}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group"
            >
                <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" /> Voltar para Guias
            </button>

            {/* Header Area */}
            <div className="mb-10 border-b border-white/10 pb-8 relative">
                <div className="flex flex-wrap gap-2 mb-4">
                    {guide.tags?.map(tag => (
                        <span key={tag} className="text-sm text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">#{tag}</span>
                    ))}
                </div>

                {isEditing ? (
                    <input
                        type="text"
                        className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-3xl md:text-5xl font-bold text-white focus:outline-none focus:border-purple-500 transition-colors mb-6"
                        value={editedTitle}
                        onChange={e => setEditedTitle(e.target.value)}
                    />
                ) : (
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{guide.title}</h1>
                )}

                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            onClick={() => openProfileModal(guide.author_id)}
                            className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xl shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform border-2 border-transparent hover:border-purple-500 ${guide.profiles?.equipped_frame || ''}`}
                        >
                            {getUserAvatar(guide.profiles) ? (
                                <img src={getUserAvatar(guide.profiles)} alt="" className="w-full h-full object-cover" />
                            ) : (
                                formatUserName(guide.profiles, guide.author_name).charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <div className="flex items-center flex-wrap gap-2">
                                <p
                                    onClick={() => openProfileModal(guide.author_id)}
                                    className={`font-bold text-white text-lg flex items-center gap-2 cursor-pointer hover:text-purple-400 transition-colors ${guide.profiles?.equipped_frame ? (guide.profiles.equipped_frame.includes('name-') ? guide.profiles.equipped_frame : guide.profiles.equipped_frame.replace('avatar-', 'name-')) : ''}`}
                                >
                                    {formatUserName(guide.profiles, guide.author_name)}
                                    {/* Status Badge (Mini) */}
                                    <>
                                        {friendshipStatus === 'accepted' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full ml-2">
                                                <FaUserCheck /> Amigo
                                            </span>
                                        )}
                                    </>
                                </p>
                                <span className="text-sm font-normal text-gray-400">• {new Date(guide.created_at).toLocaleDateString()} • Leitura de 5 min</span>
                            </div>

                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {canManage && !isEditing && (
                            <>
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-bold text-blue-300">
                                    <FaEdit /> Editar
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors text-sm font-bold text-red-400"
                                >
                                    <FaTrash /> Excluir
                                </button>
                            </>
                        )}

                        {isEditing && (
                            <>
                                <button onClick={handleSaveEdit} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg transition-colors">
                                    <FaSave /> Salvar
                                </button>
                                <button onClick={() => { setIsEditing(false); setEditedTitle(guide.title); setEditedBlocks(guide.blocks); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors">
                                    <FaTimes /> Cancelar
                                </button>
                            </>
                        )}

                        {!isEditing && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/5 border border-white/5 text-gray-400 cursor-default">
                                    <FaEye className="text-xl" />
                                    <span className="font-bold text-lg">{guide.views || 0}</span>
                                </div>
                                <button
                                    onClick={toggleLike}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-full hover:bg-white/5 transition-all group border border-white/5 ${guide.likes > 0 ? 'text-pink-500 bg-pink-500/10 border-pink-500/20' : 'text-gray-400'}`}
                                >
                                    <FaHeart className="text-xl transition-transform group-hover:scale-125" />
                                    <span className="font-bold text-lg">{guide.likes || 0}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
                {isEditing ? (
                    <div className="bg-[#1e1f2b] p-6 rounded-2xl border border-white/5">
                        <div className="mb-8">
                            {editedBlocks.map((block, index) => renderBlockEditor(block, index))}
                        </div>

                        {/* Editor Controls */}
                        <div className="flex justify-center gap-4 py-6 border-t border-dashed border-white/10">
                            <button onClick={() => addBlock('text')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                <FaParagraph /> + Texto
                            </button>
                            <button onClick={() => addBlock('image')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                <FaImage /> + Imagem
                            </button>
                            <button onClick={() => addBlock('video')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                <FaVideo /> + Vídeo
                            </button>
                        </div>
                    </div>
                ) : (
                    // Display Mode
                    <>
                        {guide.blocks && guide.blocks.length > 0 ? (
                            guide.blocks.map(block => renderBlockDisplay(block))
                        ) : (
                            // Legacy Fallback
                            <>
                                {guide.media_url && (
                                    <img src={guide.media_url} alt="" className="w-full h-auto object-cover rounded-2xl mb-8 shadow-2xl" />
                                )}
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg">{guide.content}</p>
                            </>
                        )}
                    </>
                )}
            </div>
            {/* Public Profile Modal */}
            <ViewUserProfileModal
                isOpen={showProfileModal}
                onClose={() => { setShowProfileModal(false); /* Optional: Refresh guide to update status badge? */ }}
                targetUserId={selectedUserId}
            />

            {/* Confirmation Modal for Deletion UI */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Excluir Guia?"
                message={`Tem certeza que deseja excluir o guia "${guide.title}"? Esta ação não pode ser desfeita.`}
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
        </div>
    );
};

export default GuideDetails;
