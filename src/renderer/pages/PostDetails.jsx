import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/community/PostCard';
import { FaArrowLeft } from 'react-icons/fa';

const PostDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPost();
    }, [id]);

    const fetchPost = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: postError } = await supabase
                .from('community_posts')
                .select(`
                    *,
                    profiles:community_posts_author_fkey(username, avatar_url, equipped_frame, equipped_effect),
                    communities(id, name, image_url)
                `)
                .eq('id', id)
                .single();

            if (postError) throw postError;
            if (!data) throw new Error("Publicação não encontrada.");

            setPost(data);
        } catch (err) {
            console.error("Error fetching post:", err);
            setError(err.message || "Não foi possível carregar a publicação.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        // If the post is deleted, go back or to dashboard
        navigate(-1);
    };

    return (
        <div className="max-w-4xl mx-auto pb-10 pt-4 px-4 h-full overflow-y-auto custom-scrollbar">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg w-fit"
            >
                <FaArrowLeft /> Voltar
            </button>

            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Carregando publicação...</p>
                </div>
            ) : error ? (
                <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-red-500/20">
                    <p className="text-red-400 font-bold mb-2">Erro</p>
                    <p className="text-gray-400">{error}</p>
                </div>
            ) : post ? (
                <div className="animate-fade-in-up">
                    <PostCard
                        post={post}
                        onDelete={handleDelete}
                        canComment={true}
                        isModerator={false} // Needs more complex check if we want global moderator perms here, but canDelete in PostCard handles author deletion
                        showCommunityContext={true}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default PostDetails;
