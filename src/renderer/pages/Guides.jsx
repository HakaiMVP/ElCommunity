import React, { useState, useEffect } from 'react';
import { FaBook, FaSearch, FaHeart, FaPlus, FaImage, FaVideo, FaTimes, FaTrash, FaParagraph, FaEye } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';
import { useNavigate } from 'react-router-dom';
import { formatUserName, getUserAvatar } from '../utils/formatUser';

const Guides = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [guides, setGuides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Form State (New Block System)
    const [title, setTitle] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [blocks, setBlocks] = useState([
        { id: 1, type: 'text', content: '' }
    ]);

    // Fetch Guides & User Likes
    const fetchGuides = async () => {
        setLoading(true);

        // 1. Get Guides
        const { data: guidesData, error: guidesError } = await supabase
            .from('guides')
            .select('*')
            .order('likes', { ascending: false })
            .order('created_at', { ascending: false });

        if (guidesError) {
            console.error('Error fetching guides:', guidesError);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao carregar guias.' });
            setLoading(false);
            return;
        }

        // 2. Fetch Profiles Manually (Robust Fallback)
        const userIds = [...new Set(guidesData.map(g => g.author_id))];
        const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('*, equipped_frame, equipped_effect')
            .in('id', userIds);

        if (profilesError) {
            console.error('Error fetching profiles manually:', profilesError);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao carregar perfis.' });
        }

        console.log('User IDs:', userIds);
        console.log('Profiles Data:', profilesData);

        const profilesMap = {};
        if (profilesData) {
            profilesData.forEach(p => {
                profilesMap[p.id] = p;
            });
        }

        // 3. Get User Likes (if logged in)
        let userLikes = [];
        if (user) {
            const { data: likesData } = await supabase
                .from('guide_likes')
                .select('guide_id')
                .eq('user_id', user.id);

            if (likesData) {
                userLikes = likesData.map(l => l.guide_id);
            }
        }

        // 4. Merge Data
        const mergedGuides = guidesData.map(guide => ({
            ...guide,
            profiles: profilesMap[guide.author_id] || null, // Attach profile manually
            isLiked: userLikes.includes(guide.id)
        }));

        setGuides(mergedGuides || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchGuides();
    }, [user]); // Re-fetch when user logs in/out

    // Filter Logic
    const filteredGuides = guides.filter(guide =>
        guide.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guide.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Block Editor Functions
    const addBlock = (type) => {
        setBlocks([...blocks, { id: Date.now(), type, content: '' }]);
    };

    const updateBlock = (id, content) => {
        setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
    };

    const removeBlock = (id) => {
        setBlocks(blocks.filter(b => b.id !== id));
    };

    const moveBlock = (index, direction) => {
        const newBlocks = [...blocks];
        if (direction === 'up' && index > 0) {
            [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
        } else if (direction === 'down' && index < newBlocks.length - 1) {
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
        }
        setBlocks(newBlocks);
    };

    // Actions
    const handleCreateGuide = async () => {
        if (!user) {
            setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: 'Faça login para criar um guia!' });
            return;
        }

        // Generate a preview snippet from the first text block
        const firstTextBlock = blocks.find(b => b.type === 'text');
        const previewContent = firstTextBlock ? firstTextBlock.content.substring(0, 150) + '...' : 'Conteúdo visual...';

        const guideData = {
            title: title,
            content: previewContent, // Legacy/Preview compatibility
            blocks: blocks, // NEW: Store the full block structure
            author_id: user.id,
            author_name: user.user_metadata?.username || user.email.split('@')[0],
            likes: 0,
            media_url: coverUrl, // Dedicated Cover Image
            tags: ["Comunidade"]
        };

        const { data, error } = await supabase
            .from('guides')
            .insert([guideData])
            .select();

        if (error) {
            console.error(error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao criar o guia: ' + error.message });
        } else {
            setGuides([data[0], ...guides]);
            setShowModal(false);
            setTitle('');
            setCoverUrl('');
            setBlocks([{ id: 1, type: 'text', content: '' }]);
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Guia criado com sucesso!' });
        }
    };

    const handleOpenCreateModal = () => {
        if (!user) {
            setAlertState({ isOpen: true, type: 'info', title: 'Login Necessário', message: 'Faça login para criar um guia!' });
            return;
        }
        setShowModal(true);
    };


    return (
        <div className="p-6 text-white animate-fade-in relative h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Base de Conhecimento</h1>
                    <p className="text-gray-400">Guias, tutoriais e histórias da comunidade.</p>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={handleOpenCreateModal}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full flex items-center gap-2 font-bold shadow-lg shadow-purple-900/20 transition-all hover:scale-105"
                    >
                        <FaPlus size={12} /> Novo Guia
                    </button>
                    <div className="relative w-64 hidden md:block">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-full bg-black/30 border border-white/10 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <FaSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                </div>
            </div>

            {/* Guides Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-20 custom-scrollbar pr-2">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-gray-500 animate-pulse">
                        Carregando biblioteca...
                    </div>
                ) : (
                    <>
                        {filteredGuides.map((guide) => {
                            // Determine preview image
                            const firstImageBlock = guide.blocks?.find(b => b.type === 'image');
                            const previewImage = guide.media_url || (firstImageBlock ? firstImageBlock.content : null);

                            // Determine preview text
                            const firstTextBlock = guide.blocks?.find(b => b.type === 'text');
                            const previewText = firstTextBlock
                                ? firstTextBlock.content.substring(0, 100) + '...'
                                : guide.content?.substring(0, 100) + '...';

                            return (
                                <div
                                    key={guide.id}
                                    onClick={() => navigate(`/guides/${guide.id}`)}
                                    className={`bg-[#1e1f2b] rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer group flex flex-col h-[350px] relative ${guide.profiles?.equipped_effect || ''} ${guide.profiles?.equipped_frame ? 'border-purple-500/30' : 'border-white/5'} hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(147,51,234,0.15)]`}
                                >
                                    {/* Thumbnail Area */}
                                    <div className="h-48 bg-black/50 relative overflow-hidden">
                                        {previewImage ? (
                                            <img src={previewImage} alt={guide.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 bg-gradient-to-br from-gray-900 to-black">
                                                <FaBook className="text-4xl mb-2 opacity-50" />
                                                <span className="text-xs font-bold uppercase tracking-widest opacity-50">Sem Capa</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#1e1f2b] via-transparent to-transparent opacity-80"></div>

                                        {/* Floating Badge */}
                                        <div className="absolute top-3 right-3 flex gap-2">
                                            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-bold flex items-center gap-1 border border-white/10">
                                                <FaEye className="text-gray-300" size={10} /> {guide.views || 0}
                                            </div>
                                            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-bold flex items-center gap-1 border border-white/10">
                                                <FaHeart className={guide.isLiked ? "text-pink-500" : "text-white"} size={10} /> {guide.likes || 0}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Area */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold overflow-hidden ${guide.profiles?.equipped_frame || ''}`}>
                                                {getUserAvatar(guide.profiles) ? (
                                                    <img src={getUserAvatar(guide.profiles)} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    formatUserName(guide.profiles, guide.author_name).charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <span className={`text-xs text-gray-400 font-medium truncate max-w-[150px] ${guide.profiles?.equipped_frame ? (guide.profiles.equipped_frame.includes('name-') ? guide.profiles.equipped_frame : guide.profiles.equipped_frame.replace('avatar-', 'name-')) : ''}`}>
                                                {formatUserName(guide.profiles, guide.author_name)}
                                            </span>
                                            <span className="text-gray-600 text-[10px]">•</span>
                                            <span className="text-xs text-gray-500">{new Date(guide.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}</span>
                                        </div>

                                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-tight group-hover:text-purple-400 transition-colors">
                                            {guide.title}
                                        </h3>

                                        <p className="text-gray-400 text-sm line-clamp-2 mb-4 flex-1">
                                            {previewText}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto">
                                            <div className="flex gap-2">
                                                {guide.tags?.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">#{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {filteredGuides.length === 0 && (
                            <div className="col-span-full text-center py-20 text-gray-500">
                                <FaBook className="text-6xl mx-auto mb-4 opacity-20" />
                                <p>Nenhum guia encontrado neste setor.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Guide Modal (Block Editor) */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <div className="bg-[#1e1f2b] w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl relative flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-transparent flex-shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><FaPlus className="text-purple-500" /> Novo Guia da Comunidade</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                                <FaTimes size={20} />
                            </button>
                        </div>

                        {/* Modal Body (Scrollable) */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Título Principal</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-2xl font-bold text-white focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-600"
                                    placeholder="Digite um título chamativo..."
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-purple-300 uppercase mb-2">URL da Capa (Opcional)</label>
                                <input
                                    type="url"
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-600"
                                    placeholder="https://exemplo.com/imagem-capa.jpg"
                                    value={coverUrl}
                                    onChange={e => setCoverUrl(e.target.value)}
                                />
                                {coverUrl && (
                                    <div className="mt-2 h-32 rounded-lg overflow-hidden bg-black/50 border border-white/5">
                                        <img src={coverUrl} alt="Capa Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                {blocks.map((block, index) => (
                                    <div key={block.id} className="relative group bg-black/20 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => moveBlock(index, 'up')} className="p-1 hover:text-purple-400 text-gray-500" title="Mover Cima">▲</button>
                                            <button onClick={() => moveBlock(index, 'down')} className="p-1 hover:text-purple-400 text-gray-500" title="Mover Baixo">▼</button>
                                            <button onClick={() => removeBlock(block.id)} className="p-1 hover:text-red-400 text-gray-500" title="Remover"><FaTrash size={12} /></button>
                                        </div>

                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                            {block.type === 'image' && <><FaImage /> Imagem URL</>}
                                            {block.type === 'video' && <><FaVideo /> Vídeo URL</>}
                                            {block.type === 'text' && <><FaParagraph /> Parágrafo</>}
                                        </label>

                                        {block.type === 'text' ? (
                                            <textarea
                                                rows="3"
                                                className="w-full bg-transparent text-gray-300 focus:outline-none resize-none placeholder-gray-600"
                                                placeholder="Escreva seu parágrafo aqui..."
                                                value={block.content}
                                                onChange={e => updateBlock(block.id, e.target.value)}
                                            />
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="url"
                                                    className="w-full bg-transparent text-blue-400 focus:outline-none placeholder-gray-600"
                                                    placeholder="https://..."
                                                    value={block.content}
                                                    onChange={e => updateBlock(block.id, e.target.value)}
                                                />
                                                {block.content && block.type === 'image' && (
                                                    <img src={block.content} alt="Preview" className="h-32 object-contain rounded bg-black/50 self-start" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Add Block Controls */}
                            <div className="mt-8 flex justify-center gap-4 py-4 border-t border-dashed border-white/10">
                                <span className="text-gray-500 text-sm font-bold my-auto mr-2">Adicionar Bloco:</span>
                                <button onClick={() => addBlock('text')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                    <FaParagraph /> Texto
                                </button>
                                <button onClick={() => addBlock('image')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                    <FaImage /> Imagem
                                </button>
                                <button onClick={() => addBlock('video')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 font-bold transition-colors">
                                    <FaVideo /> Vídeo
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-white/5 bg-[#14151f] flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
                            <button
                                onClick={() => { setShowModal(false); setTitle(''); setCoverUrl(''); setBlocks([{ id: 1, type: 'text', content: '' }]); }}
                                className="px-6 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateGuide}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg transform active:scale-95 transition-all text-lg"
                            >
                                Publicar Guia
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

export default Guides;
