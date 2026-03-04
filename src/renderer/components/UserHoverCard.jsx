import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { FaUserPlus, FaComment, FaTimes } from 'react-icons/fa';
import { getCosmeticsForUser } from '../utils/cosmetics';

const UserHoverCard = ({ targetUserId, onClose, position, onOpenProfile }) => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!targetUserId) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, bio, banner_color, banner_url, role, equipped_frame, equipped_effect, equipped_avatar_decoration, equipped_profile_effect, equipped_name_color, equipped_card_background, user_items(item_id, item_type)')
                    .eq('id', targetUserId)
                    .single();

                if (error) throw error;
                setUserData(data);
            } catch (error) {
                console.error("Error fetching user data for hover card:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [targetUserId]);

    if (!targetUserId || loading) return null;

    // Use the central utility
    const cosmetics = getCosmeticsForUser(userData);

    // Dynamic positioning
    let top = position?.top || 0;
    let left = (position?.left || 0) + 20;

    const cardWidth = 320;
    const cardHeight = 400; // estimated

    // Basic collision detection with screen edges
    if (left + cardWidth > window.innerWidth) {
        left = left - cardWidth - 40; // Shift to the left of the cursor
    }

    if (top + cardHeight > window.innerHeight) {
        top = window.innerHeight - cardHeight - 20; // Shift up
    }

    const { banner_color, banner_url, username, avatar_url, bio, role } = userData;
    const roleColors = {
        'admin': 'text-red-500 font-bold drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]',
        'moderator': 'text-green-500 font-bold drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]',
        'user': 'text-gray-300'
    };

    return createPortal(
        <div
            className={`fixed z-[9999] w-[320px] rounded-xl shadow-2xl overflow-hidden border border-white/10 animate-fade-in ${cosmetics.cardBackground ? cosmetics.cardBackground : 'bg-[#181922]'}`}
            style={{ top: `${top}px`, left: `${left}px` }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            {/* Card Background Color overlay if not image */}
            {!cosmetics.cardBackground?.includes('bg-[url') && <div className="absolute inset-0 bg-[#181922] -z-20"></div>}
            <div className="absolute inset-0 bg-black/40 z-[-10] pointer-events-none"></div>

            {/* Banner Area */}
            <div
                className="h-24 relative"
                style={{
                    backgroundColor: banner_color || '#1e1f2b',
                    backgroundImage: banner_url ? `url(${banner_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            >
                {/* Profile Effect (Banner Overlay) */}
                {cosmetics.profileEffect && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-80 backdrop-blur-sm mix-blend-screen bg-black/50">
                        {cosmetics.profileEffect()}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 relative">
                {/* Avatar Area - overlaps banner */}
                <div className="absolute -top-10 left-4">
                    <div className={`w-[72px] h-[72px] rounded-full p-1 bg-[#181922] relative flex items-center justify-center ${cosmetics.avatarBorder}`}>
                        <div className="w-full h-full rounded-full overflow-hidden bg-[#2d2f3b]">
                            <img
                                src={avatar_url || "https://i.pravatar.cc/150?img=12"}
                                alt={username}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Status Indicator (Mocked as Online) */}
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-[3px] border-[#181922] rounded-full z-20"></div>
                    </div>
                </div>

                <div className="mt-8">
                    {/* User Info */}
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className={`text-xl font-bold truncate max-w-[200px] leading-tight ${cosmetics.nameColor}`}>
                                {username}
                            </h2>
                            <p className="text-xs text-gray-400 font-mono">#{targetUserId.substring(0, 4)}</p>
                        </div>
                    </div>

                    {/* Roles Badge (Example) */}
                    {(role === 'admin' || role === 'moderator') && (
                        <div className="mb-3">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-current ${roleColors[role]}`}>
                                {role}
                            </span>
                        </div>
                    )}

                    <div className="w-full h-[1px] bg-white/5 my-3"></div>

                    {/* Bio */}
                    <div className="mb-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sobre Mim</h3>
                        <p className="text-sm text-gray-300 line-clamp-3 leading-snug">
                            {bio || "Este usuário não escreveu nada ainda. Muito misterioso..."}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Mensagem..."
                            className="bg-[#2d2f3b] text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
                        />
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UserHoverCard;
