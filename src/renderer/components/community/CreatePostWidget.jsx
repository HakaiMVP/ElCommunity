import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { FaPaperPlane, FaImage } from 'react-icons/fa';

const CreatePostWidget = ({ communityId, onPostCreated, canPost }) => {
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [showImageInput, setShowImageInput] = useState(false);
    const [loading, setLoading] = useState(false);
    const [user] = useState(JSON.parse(localStorage.getItem('user'))); // Fallback/Quick access

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        setLoading(true);
        try {
            // Auto-detect media type
            const isVideo = imageUrl.match(/\.(mp4|webm|ogg)$/i);
            const mediaType = isVideo ? 'video' : 'image';

            const { error } = await supabase
                .from('community_posts')
                .insert({
                    community_id: communityId,
                    user_id: (await supabase.auth.getUser()).data.user.id,
                    content: content.trim(),
                    image_url: imageUrl.trim() || null,
                    media_type: imageUrl.trim() ? mediaType : null
                });

            if (error) throw error;

            setContent('');
            setImageUrl('');
            setShowImageInput(false);
            if (onPostCreated) onPostCreated();

        } catch (error) {
            console.error('Error creating post:', error);
            alert('Não foi possível criar a publicação. Verifique se você tem permissão.');
        } finally {
            setLoading(false);
        }
    };

    if (!canPost) {
        return (
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 text-center text-gray-500 mb-6">
                Você não tem permissão para publicar nesta comunidade.
            </div>
        );
    }

    return (
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-300 mb-3">Criar Publicação</h3>
            <form onSubmit={handleSubmit}>
                <textarea
                    className="w-full bg-gray-900 text-white rounded-lg p-3 border border-gray-700 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                    rows="3"
                    placeholder="O que você quer compartilhar com a comunidade?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={loading}
                />

                {showImageInput && (
                    <input
                        type="text"
                        placeholder="URL da Imagem (opcional)"
                        className="w-full mt-2 bg-gray-900 text-white rounded-lg p-2 border border-gray-700 text-sm focus:border-purple-500 focus:outline-none"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                    />
                )}

                <div className="flex justify-between items-center mt-3">
                    <button
                        type="button"
                        onClick={() => setShowImageInput(!showImageInput)}
                        className={`text-gray-400 hover:text-purple-400 transition-colors p-2 ${showImageInput ? 'text-purple-400' : ''}`}
                        title="Adicionar imagem"
                    >
                        <FaImage size={20} />
                    </button>

                    <button
                        type="submit"
                        disabled={loading || !content.trim()}
                        className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${loading || !content.trim()
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20'
                            }`}
                    >
                        <FaPaperPlane /> {loading ? 'Publicando...' : 'Publicar'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePostWidget;
