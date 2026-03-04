import React from 'react';
import { FaChevronRight, FaStar } from 'react-icons/fa';

const PremiumCard = ({
    title = "Pacote Premium",
    starsPrice,
    backgroundImage,
    mainImage,
    icon,
    accentColor = "from-purple-600 to-blue-600",
    isNew = false,
    type,
    cssClass,
    renderEffect,
    playerName,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className="group relative w-full h-full rounded-2xl overflow-hidden cursor-pointer bg-[#1a1b26] border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-0.5 flex flex-col"
        >
            {/* Background Image */}
            {backgroundImage ? (
                <div
                    className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${type === 'bundle' ? 'opacity-60 group-hover:opacity-70 group-hover:scale-105' : 'opacity-30 group-hover:opacity-40 group-hover:scale-110'}`}
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                />
            ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${accentColor} opacity-15 group-hover:opacity-25 transition-opacity duration-300`} />
            )}

            {/* Profile effect preview */}
            {type === 'profile_effect' && renderEffect && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-500">
                    {renderEffect()}
                </div>
            )}

            {/* Dark gradient for text legibility */}
            <div className={`absolute inset-0 pointer-events-none ${type === 'bundle' ? 'bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/70 to-black/20' : 'bg-gradient-to-t from-[#1a1b26] via-[#1a1b26]/50 to-transparent'}`} />

            {/* Accent tint */}
            <div className={`absolute inset-0 bg-gradient-to-br ${accentColor} opacity-[0.07] group-hover:opacity-[0.15] transition-opacity duration-300 pointer-events-none`} />

            {/* Tags */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-20">
                {isNew && (
                    <span className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Novo
                    </span>
                )}
                {type === 'bundle' && (
                    <span className="bg-purple-600/80 backdrop-blur-md border border-purple-400/30 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto">
                        Pacote
                    </span>
                )}
            </div>

            {/* Center Visual */}
            <div className="flex-1 flex items-center justify-center relative z-10 px-3 pt-6 pb-2">
                {type === 'avatar_decoration' && cssClass ? (
                    <div className="group-hover:scale-110 transition-transform duration-500">
                        <div className={`w-16 h-16 rounded-full bg-[#2d2f3b] flex items-center justify-center text-xl shadow-xl ${cssClass}`}>
                            <span className="opacity-50">👤</span>
                        </div>
                    </div>
                ) : type === 'name_color' && cssClass ? (
                    <div className="group-hover:scale-105 transition-transform duration-500">
                        <span className={`text-2xl font-black ${cssClass}`}>
                            {playerName || 'Player'}
                        </span>
                    </div>
                ) : type === 'card_background' && cssClass ? (
                    <div className="group-hover:scale-105 transition-transform duration-500 w-[100px] h-[60px] rounded-lg shadow-xl relative overflow-hidden">
                        <div className={`absolute inset-0 ${cssClass} opacity-80 border`}></div>
                        <div className="absolute inset-0 flex flex-col p-1.5 gap-0.5 justify-end">
                            <div className="w-4 h-4 rounded-full bg-white/20 mb-0.5"></div>
                            <div className="w-10 h-1.5 rounded bg-white/20"></div>
                            <div className="w-16 h-1.5 rounded bg-white/10"></div>
                        </div>
                    </div>
                ) : (type === 'bundle' || type === 'profile_effect') ? (
                    null
                ) : icon ? (
                    <span
                        className="text-[3.5rem] leading-none select-none transition-transform duration-500 group-hover:scale-115 group-hover:-translate-y-1 drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
                        style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.1))' }}
                    >
                        {icon}
                    </span>
                ) : mainImage ? (
                    <img
                        src={mainImage}
                        alt={title}
                        className="h-28 w-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1"
                    />
                ) : null}
            </div>

            {/* Footer */}
            <div className="p-3 pt-1 mt-auto relative z-20">
                {type !== 'name_color' && (
                    <h3 className={`text-sm font-bold mb-0.5 truncate leading-tight drop-shadow-lg text-white`}>
                        {title}
                    </h3>
                )}

                {type === 'bundle' && (
                    <p className="text-[10px] text-gray-400 mb-1.5 line-clamp-1">Kit completo de personalização</p>
                )}

                <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-yellow-400 bg-black/40 px-2 py-1 rounded-lg border border-yellow-500/15 backdrop-blur-sm flex items-center gap-1">
                        <FaStar className="text-[9px]" />
                        {starsPrice ? starsPrice.toLocaleString('pt-BR') : '0'}
                    </span>
                    <button className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10 group-hover:bg-purple-600/50 group-hover:border-purple-400/50">
                        <FaChevronRight size={10} />
                    </button>
                </div>
            </div>

            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.03] to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        </div>
    );
};

export default PremiumCard;
