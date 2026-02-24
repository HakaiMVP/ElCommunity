import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { FaVolumeUp, FaPlus, FaTrash, FaUserFriends, FaMicrophoneSlash, FaHeadphonesAlt } from 'react-icons/fa';
import AlertModal from '../AlertModal';
import ConfirmationModal from '../ConfirmationModal';

const VoiceChannelList = ({ communityId, isAdmin, currentUserId, onJoinChannel, activeChannelId }) => {
    const [channels, setChannels] = useState([]);
    const [participants, setParticipants] = useState({}); // { channelId: [profiles] }
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [userLimit, setUserLimit] = useState(0); // 0 = unlimited
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const showConfirm = (title, message, onConfirm) => {
        setConfirmState({ isOpen: true, title, message, onConfirm });
    };

    useEffect(() => {
        fetchChannels();
        fetchParticipants();

        const channelSubscription = supabase
            .channel(`public:community_channels:community_id=eq.${communityId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'community_channels', filter: `community_id=eq.${communityId}` }, () => {
                fetchChannels();
            })
            .subscribe();

        const participantSubscription = supabase
            .channel(`public:voice_participants_list`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_participants' }, () => {
                // Refresh participants when ANY change happens in the table. 
                // Optimization: We could check if the changed record is related to one of our channels, but fetching is fast enough for now.
                fetchParticipants();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channelSubscription);
            supabase.removeChannel(participantSubscription);
        };
    }, [communityId]);

    const fetchChannels = async () => {
        try {
            const { data, error } = await supabase
                .from('community_channels')
                .select('*')
                .eq('community_id', communityId)
                .order('position', { ascending: true });

            if (error) throw error;
            setChannels(data || []);
            // After fetching channels, we should ensure we have participants for them (though the separate effect handles it too)
        } catch (error) {
            console.error('Error fetching channels:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchParticipants = async () => {
        try {
            // First get channel IDs for this community (active or not)
            // We can't rely on 'channels' state because it might not be set yet if running in parallel.
            // So let's query the channels for this community first.
            const { data: channelData } = await supabase
                .from('community_channels')
                .select('id')
                .eq('community_id', communityId);

            const channelIds = channelData?.map(c => c.id) || [];

            if (channelIds.length === 0) {
                setParticipants({});
                return;
            }

            const { data, error } = await supabase
                .from('voice_participants')
                .select('channel_id, user_id, muted, deafened, profiles(username, avatar_url, id)')
                .in('channel_id', channelIds);

            if (error) {
                console.error("Fetch Participants Error:", error);
                throw error;
            }

            console.log("Fetched Participants:", data); // Debug Log

            // Group by channel_id
            const grouped = {};
            data.forEach(p => {
                if (!grouped[p.channel_id]) grouped[p.channel_id] = [];
                grouped[p.channel_id].push(p);
            });
            console.log("Grouped Participants:", grouped); // Debug Log
            setParticipants(grouped);
        } catch (error) {
            console.error('Error fetching participants:', error);
        }
    };

    const createChannel = async () => {
        if (!newChannelName.trim()) return;

        try {
            const { error } = await supabase
                .from('community_channels')
                .insert({
                    community_id: communityId,
                    name: newChannelName,
                    type: 'voice',
                    user_limit: userLimit > 0 ? userLimit : null,
                    position: channels.length // Append to end
                });

            if (error) throw error;
            setShowCreateModal(false);
            setNewChannelName('');
            setUserLimit(0);
            setAlertState({ isOpen: true, type: 'success', title: 'Sucesso', message: 'Canal de voz criado!' });
        } catch (error) {
            console.error('Error creating channel:', error);
            setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao criar canal.' });
        }
    };

    const deleteChannel = async (channelId) => {
        showConfirm('Excluir Canal', 'Tem certeza que deseja excluir este canal?', async () => {
            try {
                const { error } = await supabase
                    .from('community_channels')
                    .delete()
                    .eq('id', channelId);
                if (error) throw error;
            } catch (error) {
                console.error('Error deleting channel:', error);
                setAlertState({ isOpen: true, type: 'error', title: 'Erro', message: 'Erro ao excluir canal.' });
            }
        });
    };

    return (
        <div className="bg-[#1e2029] rounded-xl border border-gray-800 p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-400 uppercase text-xs flex items-center gap-2">
                    <FaVolumeUp /> Canais de Voz
                </h3>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                        title="Criar Canal"
                    >
                        <FaPlus size={12} />
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {channels.map(channel => (
                    <div key={channel.id}>
                        <div
                            className={`group flex justify-between items-center p-2 rounded-lg transition-colors cursor-pointer ${activeChannelId === channel.id
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'hover:bg-gray-700/50 border border-transparent'
                                }`}
                            onClick={() => onJoinChannel(channel)}
                        >
                            <div className={`flex items-center gap-2 ${activeChannelId === channel.id ? 'text-green-500' : 'text-gray-300 group-hover:text-white'}`}>
                                {activeChannelId === channel.id ? <FaVolumeUp className="animate-pulse" /> : <FaVolumeUp className="text-gray-500 group-hover:text-gray-300" />}
                                <span className="font-medium truncate max-w-[150px]">{channel.name}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* User limit indicator if set */}
                                {channel.user_limit && (
                                    <span className="text-xs text-gray-500 bg-black/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <FaUserFriends size={10} /> {channel.user_limit}
                                    </span>
                                )}

                                {isAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteChannel(channel.id); }}
                                        className="text-red-500 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/20 rounded"
                                        title="Excluir"
                                    >
                                        <FaTrash size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Participants List */}
                        {participants[channel.id] && participants[channel.id].length > 0 && (
                            <div className="mt-1 space-y-0.5">
                                {participants[channel.id].map(p => (
                                    <div
                                        key={p.user_id}
                                        className="group/user flex items-center gap-2 py-1.5 px-2 ml-4 rounded-md hover:bg-[#343746] cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Future: Open profile popover
                                        }}
                                    >
                                        <div className={`relative ${p.speaking ? 'ring-2 ring-green-500 rounded-full' : ''}`}>
                                            <img
                                                src={p.profiles?.avatar_url || 'https://via.placeholder.com/32'}
                                                alt={p.profiles?.username}
                                                className={`w-7 h-7 rounded-full object-cover bg-gray-700 ${p.muted ? 'opacity-60' : ''}`}
                                            />
                                            {p.muted && (
                                                <div className="absolute -bottom-1 -right-1 bg-[#1e2029] rounded-full p-[1px]">
                                                    <FaMicrophoneSlash className="text-red-500 text-[10px]" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm truncate font-medium ${p.muted ? 'text-gray-500' : 'text-gray-300 group-hover/user:text-white'}`}>
                                                {p.profiles?.username || 'Usuário Desconhecido'}
                                            </div>
                                            {/* Status/Game text could go here */}
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover/user:opacity-100 transition-opacity">
                                            {p.deafened && <FaHeadphonesAlt className="text-red-500 text-xs" title="Ensordecido" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {channels.length === 0 && (
                    <div className="text-center py-4 text-gray-600 text-sm italic">
                        Nenhum canal de voz.
                    </div>
                )}
            </div>

            {/* Create Channel Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCreateModal(false)}>
                    <div
                        className="bg-[#1e2029] border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FaVolumeUp /> Criar Canal de Voz</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Nome do Canal</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newChannelName}
                                    onChange={e => setNewChannelName(e.target.value)}
                                    className="w-full bg-black/30 border border-gray-600 rounded-lg p-2.5 text-white focus:border-purple-500 outline-none"
                                    placeholder="Ex: Geral, Jogos..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-1">Limite de Usuários (0 = Infinito)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    value={userLimit}
                                    onChange={e => setUserLimit(parseInt(e.target.value) || 0)}
                                    className="w-full bg-black/30 border border-gray-600 rounded-lg p-2.5 text-white focus:border-purple-500 outline-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={createChannel}
                                    disabled={!newChannelName.trim()}
                                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Criar Canal
                                </button>
                            </div>
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

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={() => {
                    confirmState.onConfirm();
                    setConfirmState({ ...confirmState, isOpen: false });
                }}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default VoiceChannelList;
