import React, { useState, useEffect } from 'react';
import { FaCompass, FaUsers, FaLock, FaGlobeAmericas, FaSearch, FaPlus } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CreateCommunityModal from '../components/CreateCommunityModal';

const Explore = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [myMemberships, setMyMemberships] = useState({}); // { community_id: { role, status } }
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchCommunities();
    }, [user]);

    const fetchCommunities = async () => {
        setLoading(true);
        try {
            // 1. Fetch all communities
            const { data: communitiesData, error: commError } = await supabase
                .from('communities')
                .select('*')
                .order('members_count', { ascending: false });

            if (commError) throw commError;

            // 2. Fetch my memberships if logged in
            let memberships = {};
            if (user) {
                const { data: memberData, error: memberError } = await supabase
                    .from('community_members')
                    .select('community_id, role, status')
                    .eq('user_id', user.id);

                if (!memberError && memberData) {
                    memberData.forEach(m => {
                        memberships[m.community_id] = { role: m.role, status: m.status };
                    });
                }
            }

            setCommunities(communitiesData || []);
            setMyMemberships(memberships);

        } catch (error) {
            console.error('Error fetching communities:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (community) => {
        if (!user) return;

        try {
            // Optimistic Update
            const newStatus = community.is_private ? 'pending' : 'approved';
            setMyMemberships(prev => ({
                ...prev,
                [community.id]: { role: 'member', status: newStatus }
            }));

            const { error } = await supabase
                .from('community_members')
                .insert({
                    community_id: community.id,
                    user_id: user.id,
                    status: newStatus
                });

            if (error) throw error;

            if (newStatus === 'approved') {
                // Update local count if public join
                setCommunities(prev => prev.map(c =>
                    c.id === community.id ? { ...c, members_count: (c.members_count || 0) + 1 } : c
                ));
            }

        } catch (error) {
            console.error('Error joining community:', error);
            // Revert optimistic update
            fetchCommunities();
        }
    };

    const filteredCommunities = communities.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 text-white animate-fade-in relative min-h-full">
            {/* Header Section */}
            <div className="text-center mb-10 relative z-10">
                <div className="inline-block p-4 rounded-full bg-purple-500/10 mb-4 animate-pulse">
                    <FaCompass className="text-5xl text-purple-400" />
                </div>
                <h1 className="text-4xl font-bold mb-2 tracking-tight">Descubra Mundos</h1>
                <p className="text-gray-400 max-w-xl mx-auto text-lg">
                    Junte-se a guildas, grupos de arte e comunidades exclusivas.
                </p>

                {/* Create Button */}
                <div className="absolute top-0 right-0">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all transform hover:scale-105"
                    >
                        <FaPlus /> <span className="hidden sm:inline">Criar Comunidade</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="max-w-md mx-auto mt-8 relative">
                    <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar comunidades..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1e2029] border border-gray-700 rounded-full py-3 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-gray-600 shadow-lg"
                    />
                </div>
            </div>

            {/* List */}
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FaGlobeAmericas className="text-purple-400" /> Comunidades em Alta
            </h2>

            {showCreateModal && (
                <CreateCommunityModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        fetchCommunities();
                        // Optional: Show toast
                    }}
                />
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                </div>
            ) : filteredCommunities.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    Nenhuma comunidade encontrada com esse nome.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCommunities.map((community) => {
                        const membership = myMemberships[community.id];
                        const isMember = membership?.status === 'approved';
                        const isPending = membership?.status === 'pending';

                        return (
                            <div
                                key={community.id}
                                onClick={() => navigate(`/community/${community.id}`)}
                                className="bg-[#1e2029] border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 group hover:transform hover:-translate-y-1 hover:shadow-xl flex flex-col cursor-pointer"
                            >
                                {/* Cover Image */}
                                <div className="h-32 bg-gray-800 relative overflow-hidden">
                                    {community.image_url ? (
                                        <img src={community.image_url} alt={community.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center">
                                            <FaUsers className="text-4xl text-white/20" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                        {community.is_private ? <><FaLock className="text-orange-400" /> Privada</> : <><FaGlobeAmericas className="text-green-400" /> Pública</>}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="font-bold text-xl mb-1 truncate" title={community.name}>{community.name}</h3>
                                    <p className="text-sm text-gray-400 mb-4 line-clamp-2 min-h-[40px]">{community.description || "Sem descrição."}</p>

                                    <div className="mt-auto">
                                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4 font-medium">
                                            <span className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded-md">
                                                <FaUsers /> {community.members_count} membros
                                            </span>
                                        </div>

                                        {isMember ? (
                                            <button
                                                className="w-full py-2.5 rounded-xl bg-gray-700 text-gray-300 font-bold text-sm cursor-default flex items-center justify-center gap-2"
                                                disabled
                                            >
                                                Já é Membro
                                            </button>
                                        ) : isPending ? (
                                            <button
                                                className="w-full py-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold text-sm cursor-wait flex items-center justify-center gap-2"
                                                disabled
                                            >
                                                Aguardando Aprovação
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleJoin(community);
                                                }}
                                                className="w-full py-2.5 rounded-xl bg-white text-black hover:bg-purple-500 hover:text-white transition-all duration-300 font-bold text-sm shadow-lg shadow-purple-500/20"
                                            >
                                                {community.is_private ? 'Solicitar Entrada' : 'Juntar-se'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Explore;
