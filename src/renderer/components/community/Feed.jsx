import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import CreatePostWidget from './CreatePostWidget';
import PostCard from './PostCard';
import { FaStream } from 'react-icons/fa';

const Feed = ({ community, myRole }) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, [community.id]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('community_posts')
                .select('*, profiles:community_posts_author_fkey(username, avatar_url, equipped_frame)')
                .eq('community_id', community.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPosts(data || []);
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePostCreated = () => {
        fetchPosts();
    };

    const handlePostDeleted = (postId) => {
        setPosts(posts.filter(p => p.id !== postId));
    };

    // Helper to check permissions
    const checkPermission = (policy) => {
        if (!user) return false;
        if (myRole === 'admin') return true;
        if (myRole === 'moderator' && (policy === 'moderator' || policy === 'member')) return true;
        if (myRole === 'member' && policy === 'member') return true;
        return false; // visitors or if policy requires higher role
    };

    // Determine current user permissions based on community policies
    // Policies: 'member', 'moderator', 'admin'
    const canPost = checkPermission(community.policy_post || 'member');
    const canComment = checkPermission(community.policy_comment || 'member');
    const isModerator = myRole === 'admin' || myRole === 'moderator';

    return (
        <div className="max-w-3xl mx-auto">
            {/* Create Post Section */}
            <CreatePostWidget
                communityId={community.id}
                onPostCreated={handlePostCreated}
                canPost={canPost}
            />

            {/* Feed Section */}
            {loading ? (
                <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    <p className="text-gray-500">Carregando feed...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-16 bg-gray-800/30 rounded-xl border border-gray-800 border-dashed">
                    <FaStream className="text-4xl text-gray-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400">Nenhuma publicação ainda</h3>
                    <p className="text-gray-600 mt-2">Seja o primeiro a compartilhar algo com a comunidade!</p>
                </div>
            ) : (
                <div>
                    {posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onDelete={handlePostDeleted}
                            canComment={canComment}
                            isModerator={isModerator}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Feed;
