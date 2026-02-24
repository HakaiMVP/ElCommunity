import React from 'react';
import { FaChevronRight, FaStar } from 'react-icons/fa';

const PremiumCard = ({
    title = "Pacote Premium",
    price,
    starsPrice,
    backgroundImage,
    mainImage,
    icon,
    accentColor = "from-purple-600 to-blue-600",
    isNew = false,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className="group relative w-full h-full rounded-[2rem] overflow-hidden cursor-pointer bg-[#1e1f2b] border border-white/5 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1"
        >
            {/* Background Image — full bleed, high contrast */}
            {backgroundImage ? (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-55 group-hover:scale-110 transition-all duration-700"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                />
            ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${accentColor} opacity-25 group-hover:opacity-35 transition-opacity duration-300`} />
            )}

            {/* Dark overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 pointer-events-none" />

            {/* Accent gradient border glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${accentColor} opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none`} />

            {/* Content Container */}
            <div className="absolute inset-0 p-5 flex flex-col z-10">
                {/* Header */}
                <div className="flex justify-between items-start">
                    {isNew && (
                        <span className="bg-white/10 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Novo
                        </span>
                    )}
                    <div></div>
                </div>

                {/* Main Visual — emoji icon or image */}
                <div className="flex-1 flex items-center justify-center relative">
                    {icon ? (
                        <span
                            className="text-[5rem] leading-none select-none transition-transform duration-500 group-hover:scale-125 group-hover:-translate-y-2 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                            style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.15))' }}
                        >
                            {icon}
                        </span>
                    ) : mainImage ? (
                        <img
                            src={mainImage}
                            alt={title}
                            className="h-44 w-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2"
                        />
                    ) : null}
                </div>

                {/* Footer Info */}
                <div className="mt-auto">
                    <h3 className="text-base font-bold text-white mb-1 truncate leading-tight drop-shadow">{title}</h3>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-bold text-yellow-400 bg-black/40 px-3 py-1 rounded-lg border border-yellow-500/20 backdrop-blur-sm flex items-center gap-1">
                            <FaStar className="text-xs" />
                            {starsPrice ? starsPrice.toLocaleString('pt-BR') : '0'}
                        </span>
                        <button className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg group-hover:scale-110 border border-white/20 backdrop-blur-sm">
                            <FaChevronRight size={12} className="ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Hover Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        </div>
    );
};

export default PremiumCard;
