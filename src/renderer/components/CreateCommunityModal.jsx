import React, { useState } from 'react';
import { FaTimes, FaGlobeAmericas, FaLock, FaCamera, FaCheck } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const CreateCommunityModal = ({ onClose, onCreated }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Create Community
            const { data: community, error: commError } = await supabase
                .from('communities')
                .insert({
                    name: name.trim(),
                    description: description.trim(),
                    is_private: isPrivate,
                    image_url: imageUrl.trim() || null,
                    created_by: user.id
                })
                .select()
                .single();

            if (commError) throw commError;

            // 2. Add Creator as Admin Member
            const { error: memberError } = await supabase
                .from('community_members')
                .insert({
                    community_id: community.id,
                    user_id: user.id,
                    role: 'admin',
                    status: 'approved'
                });

            if (memberError) {
                // Rollback (optional/advanced, for now just log)
                console.error('Error adding admin member:', memberError);
                throw memberError;
            }

            if (onCreated) onCreated();
            onClose();

        } catch (err) {
            console.error('Creation failed:', err);
            setError(err.message || 'Falha ao criar comunidade.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e2029] border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl scale-100 animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                    <h2 className="text-xl font-bold text-white">Criar Nova Comunidade</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Image Preview / Input */}
                    <div className="flex justify-center mb-6">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-700 border-2 border-dashed border-gray-500 flex items-center justify-center">
                                {imageUrl ? (
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <FaCamera className="text-3xl text-gray-500" />
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="URL da Capa (https://...)"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-48 text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-1">Nome da Comunidade</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                            placeholder="Ex: Guilda dos Magos"
                            maxLength={30}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-1">Descrição</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all h-24 resize-none"
                            placeholder="Sobre o que é sua comunidade?"
                            maxLength={150}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-300 mb-2">Privacidade</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setIsPrivate(false)}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${!isPrivate ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <FaGlobeAmericas size={24} />
                                <span className="font-bold text-sm">Pública</span>
                                <span className="text-[10px] opacity-70">Todos podem entrar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPrivate(true)}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${isPrivate ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                            >
                                <FaLock size={24} />
                                <span className="font-bold text-sm">Privada</span>
                                <span className="text-[10px] opacity-70">Requer aprovação</span>
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl mt-4 transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Criando...' : <><FaCheck /> Criar Comunidade</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateCommunityModal;
