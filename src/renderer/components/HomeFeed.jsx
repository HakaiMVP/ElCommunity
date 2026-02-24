import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PostCard from './community/PostCard';
import { FaStream, FaPen, FaImage, FaPaperPlane, FaUsers } from 'react-icons/fa';

const HomeFeed = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myCommunities, setMyCommunities] = useState([]);
    const [selectedCommunity, setSelectedCommunity] = useState('');

    // New Post State
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostImage, setNewPostImage] = useState('');
    const [showImageInput, setShowImageInput] = useState(false);
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        if (user) {
            fetchInitialData();
        }
    }, [user]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 1. Fetch My Communities
            const { data: comms } = await supabase
                .from('community_members')
                .select('community_id, communities(id, name, image_url)')
                .eq('user_id', user.id)
                .eq('status', 'approved');

            const validComms = comms?.map(c => c.communities).filter(Boolean) || [];
            setMyCommunities(validComms);
            if (validComms.length > 0) setSelectedCommunity(validComms[0].id);

            // 2. Fetch Friends
            const { data: friendships } = await supabase
                .from('friendships')
                .select('user_id, friend_id')
                .eq('status', 'accepted')
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

            const friendIds = friendships?.map(f => f.user_id === user.id ? f.friend_id : f.user_id) || [];

            // 3. Fetch Feed
            // Logic: Posts from communities I'm in OR posts by my friends (in public/shared communities)
            // For simplicity and security, let's start with:
            // Posts from communities I am in.
            // AND Posts by friends (we can try to fetch them, but RLS might block if I'm not in the community. 
            // If RLS allows reading 'public' communities, this works).

            const myCommunityIds = validComms.map(c => c.id);
            const allRelevantUserIds = [user.id, ...friendIds];

            // Complex query:
            // community_id IN myCommunityIds
            // OR (user_id IN friendIds AND community is public?) -> Hard to query "community is public" in same join efficiently without view.
            // Let's stick to "Posts in my communities" + "Posts by me" for now as the dashboard.
            // To include friends' posts in OTHER communities, we'd need to fetch those too.
            // Let's try to fetch posts where community_id is in my list. This is the standard "Subscribed Feed".

            if (myCommunityIds.length === 0) {
                setPosts([]);
                return;
            }

            const { data: feedData, error } = await supabase
                .from('community_posts')
                .select(`
                    *,
                    profiles:community_posts_author_fkey(username, avatar_url, equipped_frame, equipped_effect),
                    communities(id, name, image_url)
                `)
                .in('community_id', myCommunityIds)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setPosts(feedData || []);

        } catch (error) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() || !selectedCommunity) return;
        setPosting(true);

        try {
            // Auto-detect media type
            const isVideo = newPostImage.match(/\.(mp4|webm|ogg)$/i);
            const mediaType = isVideo ? 'video' : 'image';

            const { error } = await supabase
                .from('community_posts')
                .insert({
                    community_id: selectedCommunity,
                    user_id: user.id,
                    content: newPostContent.trim(),
                    image_url: newPostImage.trim() || null,
                    media_type: newPostImage.trim() ? mediaType : null
                });

            if (error) throw error;

            setNewPostContent('');
            setNewPostImage('');
            setShowImageInput(false);
            fetchInitialData(); // Refresh feed

        } catch (error) {
            alert('Erro ao criar post: ' + error.message);
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-10">
            {/* Create Post Widget */}
            <div className="bg-[#1e1f2b] border border-white/10 rounded-xl p-4 mb-8 shadow-xl">
                <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                            {user?.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt="User Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-white">
                                    {(user?.user_metadata?.username || user?.email)?.[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1">
                        <select
                            className="bg-black/30 text-white text-sm rounded-lg px-3 py-1 border border-white/10 outline-none focus:border-purple-500 w-full md:w-auto"
                            value={selectedCommunity}
                            onChange={(e) => setSelectedCommunity(e.target.value)}
                        >
                            <option value="" disabled>Selecione uma comunidade...</option>
                            {myCommunities.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <form onSubmit={handleCreatePost}>
                    <textarea
                        className="w-full bg-black/20 text-white rounded-lg p-3 border border-white/5 focus:border-purple-500/50 outline-none transition-all resize-none min-h-[80px]"
                        placeholder="Compartilhe suas aventuras em Elios..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        disabled={posting || myCommunities.length === 0}
                    />

                    {showImageInput && (
                        <input
                            type="text"
                            placeholder="URL da imagem ou vídeo..."
                            className="w-full mt-2 bg-black/20 text-white rounded-lg p-2 border border-white/5 text-sm focus:border-purple-500/50 outline-none"
                            value={newPostImage}
                            onChange={(e) => setNewPostImage(e.target.value)}
                        />
                    )}

                    <div className="flex justify-between items-center mt-3">
                        <button
                            type="button"
                            onClick={() => setShowImageInput(!showImageInput)}
                            className={`p-2 rounded-full hover:bg-white/5 transition-colors ${showImageInput ? 'text-purple-400' : 'text-gray-400'}`}
                        >
                            <FaImage />
                        </button>

                        <button
                            type="submit"
                            disabled={posting || !newPostContent.trim() || !selectedCommunity}
                            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${posting || !newPostContent.trim() || !selectedCommunity
                                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                                }`}
                        >
                            <FaPaperPlane /> {posting ? 'Enviando...' : 'Publicar'}
                        </button>
                    </div>
                </form>

                {myCommunities.length === 0 && (
                    <div className="text-center text-xs text-red-400 mt-2">
                        Você precisa entrar em uma comunidade para publicar.
                    </div>
                )}
            </div>

            {/* Feed List */}
            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    <p className="text-gray-500">Carregando feed...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <FaStream className="text-4xl mx-auto mb-4" />
                    <p>Seu feed está vazio.</p>
                    <p className="text-sm">Entre em comunidades para ver as novidades!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            showCommunityContext={true}
                            canComment={true} // Allow comments from home? Yes.
                            isModerator={false} // Global viewing - assumption: not moderator unless checked per post, but that's expensive. 'canDelete' logic in PostCard checks author, so it's fine.
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomeFeed;
