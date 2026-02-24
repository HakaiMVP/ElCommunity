import galaxiaImg from '../assets/store/galaxia.jpg';
import magmaImg from '../assets/store/magma.png';

export const allItems = [
    {
        id: 'frame_magma',
        type: 'frame',
        title: "Chamas do Magma",
        description: "Forgiada no núcleo do vulcão mais profundo. Uma moldura que queima com a intensidade do seu poder.",
        starsPrice: 1890,
        backgroundImage: magmaImg,
        icon: "🔥",
        frameClass: "name-frame-magma",
        accentColor: "from-red-600 to-orange-500",
        isNew: true,
        isFeatured: true
    },
    {
        id: 'frame_gold',
        type: 'frame',
        title: "Moldura Dourada",
        starsPrice: 1590,
        backgroundImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800&q=80",
        icon: "👑",
        frameClass: "name-frame-gold",
        accentColor: "from-yellow-400 to-yellow-600",
        isNew: true
    },
    {
        id: 'frame_neon',
        type: 'frame',
        title: "Neon Cyberpunk",
        starsPrice: 1290,
        backgroundImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
        icon: "🌐",
        frameClass: "name-frame-neon",
        accentColor: "from-cyan-400 to-purple-600",
        isNew: true
    },
    {
        id: 'frame_lightning',
        type: 'frame',
        title: "Tempestade Relâmpago",
        description: "O caos elétrico encapsulado em uma moldura. Faísca com a fúria dos céus tempestuosos.",
        starsPrice: 1490,
        backgroundImage: "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?w=800&q=80",
        icon: "⚡",
        frameClass: "name-frame-lightning",
        accentColor: "from-yellow-400 to-blue-500",
        isNew: true,
        isFeatured: false
    },
    {
        id: 'frame_galaxy',
        type: 'frame',
        title: "Galáxia Sombria",
        description: "O cosmos em suas mãos. Uma moldura que contém as nebulosas do universo.",
        starsPrice: 1690,
        backgroundImage: galaxiaImg,
        icon: "🌌",
        frameClass: "name-frame-galaxy",
        accentColor: "from-purple-600 to-blue-900",
        isNew: true,
        isFeatured: false
    },
    {
        id: 'lightning_bundle',
        type: 'bundle',
        title: "Kit Tempestade Completo",
        description: "Obtenha a experiência completa! Inclui a Moldura Tempestade (borda do avatar + nome colorido) E o exclusivo Efeito de Fundo Animado 'Tempestade' para o seu painel de Chat.",
        starsPrice: 2290,
        backgroundImage: "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?w=800&q=80",
        icon: "🌩️",
        frameClass: "name-frame-lightning",
        accentColor: "from-yellow-500 to-blue-600",
        isNew: true,
        isFeatured: false
    },
    {
        id: 'galaxy_bundle',
        type: 'bundle',
        title: "Kit Galáxia Completo",
        description: "Constelações ao seu redor. Este kit poderoso garante a Moldura Galáxia (borda do avatar + nome colorido) E o Efeito Imersivo animado 'Galáxia Sombria' nos seus Chats.",
        starsPrice: 2490,
        backgroundImage: galaxiaImg,
        icon: "🚀",
        frameClass: "name-frame-galaxy",
        accentColor: "from-purple-700 to-blue-900",
        isNew: true,
        isFeatured: false
    }
];
