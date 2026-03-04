import React from 'react';
import infernalImg from '../assets/store/anime/infernal.png';
import arcanaImg from '../assets/store/anime/arcana.png';
import celestialImg from '../assets/store/anime/celestial.png';
import deepTideImg from '../assets/store/anime/deep_tide.png';

export const allItems = [
    // ═══════════════════════════════════════════════════════════════════════
    // PREMIUM COSMETICS — Animated Styles
    // ═══════════════════════════════════════════════════════════════════════

    // --- AVATAR DECORATIONS (Animated Borders) ---
    {
        id: 'avatar_decoration_infernal',
        type: 'avatar_decoration',
        title: "Chama Infernal",
        description: "Uma moldura ardente que pulsa com o poder das chamas do submundo. Embers vermelhos giram ao redor do seu avatar.",
        starsPrice: 2990,
        backgroundImage: infernalImg,
        icon: "🔥",
        accentColor: "from-red-600 to-red-900",
        cssClass: "avatar-frame-infernal",
        isNew: true
    },
    {
        id: 'avatar_decoration_arcana',
        type: 'avatar_decoration',
        title: "Energia Arcana",
        description: "Canalize a energia mística de um feiticeiro ancestral. Uma aura violeta e azul pulsa ao redor do seu avatar.",
        starsPrice: 2790,
        backgroundImage: arcanaImg,
        icon: "🔮",
        accentColor: "from-violet-600 to-blue-600",
        cssClass: "avatar-frame-arcana",
        isNew: true
    },
    {
        id: 'avatar_decoration_celestial',
        type: 'avatar_decoration',
        title: "Brilho Celestial",
        description: "Ultrapasse seus limites! Uma aura dourada intensa que pulsa com poder divino e radiância celestial.",
        starsPrice: 3290,
        backgroundImage: celestialImg,
        icon: "⚡",
        accentColor: "from-yellow-400 to-amber-600",
        cssClass: "avatar-frame-celestial",
        isNew: true
    },
    {
        id: 'avatar_decoration_deep_tide',
        type: 'avatar_decoration',
        title: "Maré Profunda",
        description: "A força misteriosa das profundezas oceânicas. Ondas de energia azul fluem como correntes submarinas ao redor do seu avatar.",
        starsPrice: 2590,
        backgroundImage: deepTideImg,
        icon: "🌊",
        accentColor: "from-cyan-400 to-teal-600",
        cssClass: "avatar-frame-tide",
        isNew: true
    },

    // --- NAME COLORS ---
    {
        id: 'name_color_infernal',
        type: 'name_color',
        title: "Nome Infernal",
        description: "Seu nome brilha com o vermelho intenso das chamas infernais.",
        starsPrice: 1290,
        backgroundImage: infernalImg,
        icon: "🔥",
        accentColor: "from-red-500 to-red-800",
        cssClass: "name-frame-infernal",
        isNew: true
    },
    {
        id: 'name_color_arcana',
        type: 'name_color',
        title: "Nome Arcano",
        description: "A energia arcana flui pelo seu nome com um brilho violeta místico.",
        starsPrice: 1290,
        backgroundImage: arcanaImg,
        icon: "🔮",
        accentColor: "from-violet-500 to-blue-600",
        cssClass: "name-frame-arcana",
        isNew: true
    },
    {
        id: 'name_color_celestial',
        type: 'name_color',
        title: "Nome Celestial",
        description: "O poder celestial emana do seu nome com uma aura dourada faiscante.",
        starsPrice: 1490,
        backgroundImage: celestialImg,
        icon: "⚡",
        accentColor: "from-yellow-400 to-amber-500",
        cssClass: "name-frame-celestial",
        isNew: true
    },
    {
        id: 'name_color_tide',
        type: 'name_color',
        title: "Nome das Marés",
        description: "Ondas luminosas cercam seu nome com uma beleza ciano serena das profundezas.",
        starsPrice: 1190,
        backgroundImage: deepTideImg,
        icon: "🌊",
        accentColor: "from-cyan-400 to-teal-500",
        cssClass: "name-frame-tide",
        isNew: true
    },

    // --- PROFILE EFFECTS (Animated Banners) ---
    {
        id: 'profile_effect_infernal_flames',
        type: 'profile_effect',
        title: "Chamas Eternas",
        description: "Chamas eternas consomem o seu banner. Um efeito inspirado no fogo ancestral que nunca se apaga.",
        starsPrice: 3490,
        backgroundImage: infernalImg,
        icon: "🔥",
        accentColor: "from-red-900 to-black",
        isNew: true,
        baseBanner: "bg-black",
        renderEffect: () => (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-red-900/50 via-black to-black" style={{ animation: 'energy-ripple 3s ease-in-out infinite' }}></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-600/20 via-transparent to-transparent" style={{ animation: 'aura-flicker 4s ease-in-out infinite' }}></div>
                <div className="absolute bottom-0 left-[10%] w-2 h-2 rounded-full bg-red-500/80" style={{ animation: 'float-up 3s ease-out infinite' }}></div>
                <div className="absolute bottom-0 left-[30%] w-1.5 h-1.5 rounded-full bg-orange-500/70" style={{ animation: 'float-up 4s ease-out infinite 0.5s' }}></div>
                <div className="absolute bottom-0 left-[50%] w-2.5 h-2.5 rounded-full bg-red-600/60" style={{ animation: 'float-up 3.5s ease-out infinite 1s' }}></div>
                <div className="absolute bottom-0 left-[70%] w-1 h-1 rounded-full bg-orange-400/80" style={{ animation: 'float-up 4.5s ease-out infinite 1.5s' }}></div>
                <div className="absolute bottom-0 left-[85%] w-2 h-2 rounded-full bg-red-400/70" style={{ animation: 'float-up 3s ease-out infinite 2s' }}></div>
            </>
        )
    },
    {
        id: 'profile_effect_arcana_domain',
        type: 'profile_effect',
        title: "Expansão Arcana",
        description: "Invoque seu domínio pessoal! Uma esfera de energia mística violeta e azul se expande pelo seu banner.",
        starsPrice: 3790,
        backgroundImage: arcanaImg,
        icon: "🌀",
        accentColor: "from-violet-700 to-blue-900",
        isNew: true,
        baseBanner: "bg-[#080015]",
        renderEffect: () => (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-violet-600/40 via-blue-900/20 to-black" style={{ animation: 'spin-slow 8s linear infinite' }}></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent" style={{ animation: 'energy-ripple 3s ease-in-out infinite' }}></div>
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(124,58,237,0.1),transparent,rgba(59,130,246,0.1),transparent)]" style={{ animation: 'spin-slow 6s linear infinite reverse' }}></div>
                <div className="absolute bottom-0 left-[15%] w-1.5 h-1.5 rounded-full bg-violet-400/80" style={{ animation: 'float-up-slow 5s ease-out infinite' }}></div>
                <div className="absolute bottom-0 left-[40%] w-2 h-2 rounded-full bg-blue-400/70" style={{ animation: 'float-up-slow 4s ease-out infinite 1s' }}></div>
                <div className="absolute bottom-0 left-[65%] w-1 h-1 rounded-full bg-violet-300/80" style={{ animation: 'float-up-slow 6s ease-out infinite 2s' }}></div>
                <div className="absolute bottom-0 left-[80%] w-2.5 h-2.5 rounded-full bg-blue-300/60" style={{ animation: 'float-up-slow 4.5s ease-out infinite 0.5s' }}></div>
            </>
        )
    },
    {
        id: 'profile_effect_celestial_aura',
        type: 'profile_effect',
        title: "Aura Celestial",
        description: "O poder lendário do cosmos explode no seu banner com uma aura dourada intensa e faíscas de energia divina.",
        starsPrice: 3990,
        backgroundImage: celestialImg,
        icon: "💥",
        accentColor: "from-yellow-500 to-orange-600",
        isNew: true,
        baseBanner: "bg-[#0a0800]",
        renderEffect: () => (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/30 via-amber-700/15 to-black" style={{ animation: 'celestial-aura 1.8s ease-in-out infinite' }}></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" style={{ animation: 'energy-ripple 2s ease-in-out infinite' }}></div>
                <div className="absolute bottom-0 left-[8%] w-1 h-1 rounded-full bg-yellow-300/90" style={{ animation: 'float-up 2s ease-out infinite' }}></div>
                <div className="absolute bottom-0 left-[22%] w-1.5 h-1.5 rounded-full bg-amber-400/80" style={{ animation: 'float-up 2.5s ease-out infinite 0.3s' }}></div>
                <div className="absolute bottom-0 left-[38%] w-1 h-1 rounded-full bg-yellow-200/90" style={{ animation: 'float-up 1.8s ease-out infinite 0.7s' }}></div>
                <div className="absolute bottom-0 left-[55%] w-2 h-2 rounded-full bg-amber-300/70" style={{ animation: 'float-up 2.2s ease-out infinite 1s' }}></div>
                <div className="absolute bottom-0 left-[72%] w-1 h-1 rounded-full bg-yellow-400/80" style={{ animation: 'float-up 2.8s ease-out infinite 0.5s' }}></div>
                <div className="absolute bottom-0 left-[88%] w-1.5 h-1.5 rounded-full bg-orange-300/90" style={{ animation: 'float-up 2s ease-out infinite 1.5s' }}></div>
            </>
        )
    },
    {
        id: 'profile_effect_deep_tide_flow',
        type: 'profile_effect',
        title: "Corrente Abissal",
        description: "Correntes de água pura fluem pelo seu banner como as marés profundas de um oceano misterioso.",
        starsPrice: 3290,
        backgroundImage: deepTideImg,
        icon: "🌊",
        accentColor: "from-cyan-500 to-blue-700",
        isNew: true,
        baseBanner: "bg-[#000d15]",
        renderEffect: () => (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-cyan-600/30 via-blue-900/15 to-black" style={{ animation: 'water-flow 6s ease-in-out infinite', backgroundSize: '200% 200%' }}></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/15 via-transparent to-transparent" style={{ animation: 'energy-ripple 4s ease-in-out infinite' }}></div>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(6,182,212,0.05)_50%,transparent_100%)]" style={{ animation: 'shimmer-sweep 4s linear infinite', backgroundSize: '200% 100%' }}></div>
                <div className="absolute bottom-0 left-[12%] w-1.5 h-1.5 rounded-full bg-cyan-300/80" style={{ animation: 'float-up-slow 5s ease-out infinite' }}></div>
                <div className="absolute bottom-0 left-[35%] w-2 h-2 rounded-full bg-teal-400/60" style={{ animation: 'float-up-slow 6s ease-out infinite 1s' }}></div>
                <div className="absolute bottom-0 left-[60%] w-1 h-1 rounded-full bg-cyan-200/70" style={{ animation: 'float-up-slow 4.5s ease-out infinite 2s' }}></div>
                <div className="absolute bottom-0 left-[82%] w-1.5 h-1.5 rounded-full bg-blue-300/80" style={{ animation: 'float-up-slow 5.5s ease-out infinite 0.5s' }}></div>
            </>
        )
    },

    // --- CARD BACKGROUNDS ---
    {
        id: 'card_background_crimson',
        type: 'card_background',
        title: "Fundo Carmesim",
        description: "Vermelho escuro profundo, como brasas de um vulcão adormecido. Para os mais sombrios.",
        starsPrice: 1790,
        backgroundImage: infernalImg,
        icon: "🩸",
        accentColor: "from-red-900 to-black",
        cssClass: "card-bg-crimson",
        isNew: true
    },
    {
        id: 'card_background_mystic',
        type: 'card_background',
        title: "Fundo Místico",
        description: "Um gradiente escuro com tons violeta, perfeito para magos e feiticeiros das sombras.",
        starsPrice: 1790,
        backgroundImage: arcanaImg,
        icon: "🌑",
        accentColor: "from-violet-900 to-black",
        cssClass: "card-bg-mystic",
        isNew: true
    },
    {
        id: 'card_background_golden',
        type: 'card_background',
        title: "Fundo Dourado",
        description: "Uma base dourada escura que emana poder celestial e radiância divina.",
        starsPrice: 1990,
        backgroundImage: celestialImg,
        icon: "✨",
        accentColor: "from-yellow-700 to-amber-900",
        cssClass: "card-bg-golden",
        isNew: true
    },
    {
        id: 'card_background_ocean',
        type: 'card_background',
        title: "Fundo Oceano",
        description: "As profundezas do oceano, calmas e misteriosas como as correntes abissais.",
        starsPrice: 1790,
        backgroundImage: deepTideImg,
        icon: "🌊",
        accentColor: "from-cyan-800 to-blue-900",
        cssClass: "card-bg-ocean",
        isNew: true
    },

    // --- BUNDLES ---
    {
        id: 'infernal_bundle',
        type: 'bundle',
        title: "Kit Chama Infernal",
        description: "O poder das chamas ao seu alcance. Inclui: Decoração Infernal, Nome Infernal, Efeito Chamas Eternas e Fundo Carmesim.",
        starsPrice: 6990,
        backgroundImage: infernalImg,
        icon: "🔥",
        accentColor: "from-red-700 to-red-950",
        isNew: true,
        isFeatured: true,
        bundleItems: ['avatar_decoration_infernal', 'name_color_infernal', 'profile_effect_infernal_flames', 'card_background_crimson']
    },
    {
        id: 'arcana_bundle',
        type: 'bundle',
        title: "Kit Energia Arcana",
        description: "Torne-se um mago de nível supremo. Inclui: Decoração Arcana, Nome Arcano, Efeito Expansão Arcana e Fundo Místico.",
        starsPrice: 7490,
        backgroundImage: arcanaImg,
        icon: "🌀",
        accentColor: "from-violet-700 to-blue-900",
        isNew: true,
        isFeatured: true,
        bundleItems: ['avatar_decoration_arcana', 'name_color_arcana', 'profile_effect_arcana_domain', 'card_background_mystic']
    },
    {
        id: 'celestial_bundle',
        type: 'bundle',
        title: "Kit Brilho Celestial",
        description: "Ultrapasse seus limites! Inclui: Decoração Celestial, Nome Celestial, Efeito Aura Celestial e Fundo Dourado.",
        starsPrice: 7990,
        backgroundImage: celestialImg,
        icon: "💥",
        accentColor: "from-yellow-500 to-orange-700",
        isNew: true,
        isFeatured: true,
        bundleItems: ['avatar_decoration_celestial', 'name_color_celestial', 'profile_effect_celestial_aura', 'card_background_golden']
    },
    {
        id: 'deep_tide_bundle',
        type: 'bundle',
        title: "Kit Maré Profunda",
        description: "Domine as correntes abissais. Inclui: Decoração Maré, Nome das Marés, Efeito Corrente Abissal e Fundo Oceano.",
        starsPrice: 6490,
        backgroundImage: deepTideImg,
        icon: "🌊",
        accentColor: "from-cyan-500 to-teal-700",
        isNew: true,
        isFeatured: true,
        bundleItems: ['avatar_decoration_deep_tide', 'name_color_tide', 'profile_effect_deep_tide_flow', 'card_background_ocean']
    },
];
