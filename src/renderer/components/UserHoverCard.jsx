import React from 'react';
import { FaCircle, FaCrown, FaRocket } from 'react-icons/fa';

const UserHoverCard = ({ user, position }) => {
    if (!user) return null;

    // Calculate position styles
    // We expect position like { top: 123, left: 456 }
    const style = {
        top: position?.top || 0,
        left: (position?.left || 0) + 20, // Offset slightly to the right of cursor/element
    };

    const isOnline = user.presence === 'online' || user.status === 'online'; // Handle different data shapes

    const hasMagma = user.equipped_frame === 'avatar-magma' || user.equipped_effect === 'effect-king_of_curses';
    const hasGold = user.equipped_frame === 'avatar-gold';
    const hasNeon = user.equipped_frame === 'avatar-neon' || user.equipped_effect === 'effect-domain_expansion';
    const hasLightning = user.equipped_frame === 'avatar-lightning' || user.equipped_effect === 'effect-lightning_storm';
    const hasGalaxy = user.equipped_frame === 'avatar-galaxy' || user.equipped_effect === 'effect-dark_galaxy';

    const nameColor = hasMagma ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]'
        : hasGold ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]'
            : hasNeon ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]'
                : hasLightning ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                    : hasGalaxy ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]'
                        : 'text-white';

    const avatarBorder = hasMagma ? 'border-[3px] border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]'
        : hasGold ? 'border-[3px] border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.6)]'
            : hasNeon ? 'border-[3px] border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                : hasLightning ? 'border-[3px] border-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)]'
                    : hasGalaxy ? 'border-[3px] border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.6)]'
                        : isOnline ? 'border-[3px] border-green-500' : 'border border-gray-600';

    return (
        <div
            className="fixed z-50 w-80 bg-[#0f1015]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            style={style}
        >
            {/* Banner Area */}
            <div className="h-28 relative overflow-hidden bg-[#1e1f2b]">
                {/* 1. Equipped Effect/Frame Background (High Priority) */}

                {/* YUJI / RED THEME */}
                {(user.equipped_effect === 'effect-yuji_black_flash') && (
                    <div className="absolute inset-0 bg-black">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/50 via-black to-black animate-pulse"></div>
                        <div className="absolute inset-0 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/lightning.png')]"></div>
                    </div>
                )}

                {/* DOMAIN / NEON / VOID THEME */}
                {(user.equipped_effect === 'effect-domain_expansion' || user.equipped_frame === 'avatar-neon') && (
                    <div className="absolute inset-0 bg-[#0d001a]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-600/40 via-[#1a0b2e] to-black animate-spin-slow" style={{ animationDuration: '10s' }}></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                    </div>
                )}

                {/* MAGMA / FIRE THEME */}
                {(user.equipped_effect === 'effect-king_of_curses' || user.equipped_frame === 'avatar-magma') && (
                    <div className="absolute inset-0 bg-[#1a0500]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-orange-600/40 via-red-900/40 to-black animate-pulse"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20"></div>
                    </div>
                )}

                {/* GOLD / LUXURY THEME */}
                {(user.equipped_frame === 'avatar-gold') && (
                    <div className="absolute inset-0 bg-black">
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,_#bf953f,_#fcf6ba,_#b38728,_#fbf5b7,_#aa771c)] opacity-20 animate-pulse"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80"></div>
                    </div>
                )}

                {/* LIGHTNING STORM THEME */}
                {(user.equipped_effect === 'effect-lightning_storm' || user.equipped_frame === 'avatar-lightning') && (
                    <div className="absolute inset-0 bg-[#00091a]">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-yellow-400/30 via-blue-900/30 to-black animate-pulse"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" style={{ animationDuration: '1.2s' }}></div>
                    </div>
                )}

                {/* DARK GALAXY THEME */}
                {(user.equipped_effect === 'effect-dark_galaxy' || user.equipped_frame === 'avatar-galaxy') && (
                    <div className="absolute inset-0 bg-[#060010]">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-700/30 via-blue-900/20 to-black animate-spin-slow" style={{ animationDuration: '12s' }}></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40"></div>
                    </div>
                )}

                {/* Custom Cover */}
                {!user.equipped_effect && user.cover_url && (
                    <img src={user.cover_url} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                )}

                {/* Default Fallback */}
                {!user.equipped_effect && !user.cover_url && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-[#0f1015]"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    </>
                )}

                {/* Common Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1015] via-transparent to-transparent opacity-90"></div>
            </div>

            {/* Content Area */}
            <div className="px-6 pb-6 relative flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full p-1 bg-[#0f1015] relative -mt-12 mb-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className={`w-full h-full rounded-full overflow-hidden bg-[#2d2f3b] ${avatarBorder}`}>
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/20">
                                {(user.username || user.friendName || "?").slice(0, 1).toUpperCase()}
                            </div>
                        )}
                    </div>
                    {/* Status Indicator */}
                    <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-[3px] border-[#0f1015] ${isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-500'}`}></div>
                </div>

                {/* Text Info */}
                <h3 className={`text-xl font-black flex items-center justify-center gap-2 tracking-tight ${nameColor}`}>
                    {user.username || user.friendName || "Usuário"}
                    {user.is_verified && <span className="text-blue-400 text-sm">✓</span>}
                </h3>

                {user.display_id && (
                    <p className="text-xs text-purple-400 font-bold mb-4">#{user.display_id}</p>
                )}

                {/* Bio */}
                <div className="w-full bg-white/[0.03] rounded-xl p-3 border border-white/5 shadow-inner">
                    <p className="text-[13px] text-gray-300 leading-relaxed text-center break-words">
                        {user.bio ? user.bio : <span className="italic opacity-40 font-light">Nenhuma biografia disponível.</span>}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UserHoverCard;
