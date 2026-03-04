import React from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaStar, FaShieldAlt, FaComments, FaShoppingBag, FaCheck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { allItems } from '../data/storeItems';

const ProductModal = ({ item, onClose, isOwned, isEquipped, onBuy, onEquip }) => {
    const { user } = useAuth();

    if (!item) return null;

    // Helper to extract preview cosmetics
    const getPreviewCosmetics = (previewItem) => {
        let cosmetics = {
            avatarBorder: '',
            nameColor: 'text-white drop-shadow-md',
            profileEffect: null,
            cardBackground: ''
        };

        let itemsToProcess = [previewItem];
        if (previewItem.type === 'bundle' && previewItem.bundleItems) {
            itemsToProcess = previewItem.bundleItems.map(id => allItems.find(i => i.id === id)).filter(Boolean);
        }

        itemsToProcess.forEach(subItem => {
            if (subItem.type === 'avatar_decoration') cosmetics.avatarBorder = subItem.cssClass;
            if (subItem.type === 'name_color') cosmetics.nameColor = subItem.cssClass;
            if (subItem.type === 'profile_effect') cosmetics.profileEffect = subItem.renderEffect;
            if (subItem.type === 'card_background') cosmetics.cardBackground = subItem.cssClass;
        });

        return cosmetics;

    };

    const preview = getPreviewCosmetics(item);

    const modalContent = (
        <div
            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
            onClick={onClose}
        >
            {/* Modal Container - Glassmorphism */}
            <div
                className="w-full max-w-5xl rounded-2xl overflow-hidden relative shadow-2xl border border-white/10 animate-scale-in flex flex-col md:flex-row"
                style={{
                    background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(10, 10, 15, 0.98))',
                    backdropFilter: 'blur(20px)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background Ambient Glow */}
                <div className={`absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl ${item.accentColor || 'from-purple-600/20 to-blue-600/20'} rounded-full blur-[120px] -z-10 pointer-events-none opacity-40`}></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full border border-white/5 backdrop-blur-sm"
                >
                    <FaTimes size={18} />
                </button>

                {/* LEFT: Live Preview (The "Reality" View) */}
                <div className="w-full md:w-5/12 p-8 flex flex-col items-center justify-center relative border-r border-white/5 bg-black/20">
                    <div className="text-center mb-8">
                        <h3 className="text-white/90 font-bold text-lg tracking-wide uppercase">Pré-visualização</h3>
                        <p className="text-gray-500 text-xs mt-1">Veja como seu perfil ficará na comunidade</p>
                    </div>

                    {/* Simulation Container */}
                    <div className="relative w-full max-w-[320px] space-y-8">

                        {/* Mock User Profile Card */}
                        <div className={`rounded-3xl shadow-2xl overflow-hidden border border-white/10 transform transition-transform hover:scale-[1.02] duration-500 w-full max-w-[300px] mx-auto relative ${preview.cardBackground ? preview.cardBackground : 'bg-[#1e1f2b]'}`}>

                            {/* Card Background Color overlay if not image */}
                            {!preview.cardBackground?.includes('bg-[url') && <div className="absolute inset-0 bg-[#1e1f2b] -z-20"></div>}
                            <div className="absolute inset-0 bg-black/40 z-[-10] pointer-events-none"></div>

                            {/* Profile Banner */}
                            <div className="h-28 bg-gradient-to-br from-indigo-900 via-purple-900 to-[#1e1f2b] relative">
                                <div className={`absolute inset-0 bg-gradient-to-r ${item.accentColor} opacity-50`}></div>
                                {item.backgroundImage && <img src={item.backgroundImage} className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />}

                                {/* Profile Effect (Banner Overlay) */}
                                {preview.profileEffect && (
                                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-80 backdrop-blur-sm mix-blend-screen">
                                        {preview.profileEffect()}
                                    </div>
                                )}

                                {/* Centered Avatar */}
                                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center">
                                    <div className={`w-24 h-24 rounded-full p-1 bg-[#1e1f2b] relative flex items-center justify-center ${preview.avatarBorder}`}>
                                        <div className="w-full h-full rounded-full overflow-hidden bg-gray-800">
                                            <img
                                                src={user?.user_metadata?.avatar_url || "https://i.pravatar.cc/150?img=12"}
                                                alt="Avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-[#1e1f2b] rounded-full z-20"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Profile Info */}
                            <div className="pt-16 pb-8 px-6 text-center flex flex-col items-center">
                                <h3 className={`font-bold text-xl inline-block mb-1 ${preview.nameColor}`}>
                                    {user?.user_metadata?.username || 'Glave'}
                                </h3>
                                <p className="text-purple-400/80 text-xs font-bold bg-purple-500/10 px-3 py-1 rounded-full inline-block mt-2 border border-purple-500/20 backdrop-blur-md">
                                    #{user?.id?.slice(0, 4) || '261'}
                                </p>
                            </div>
                        </div>

                        {/* NEW: Sidebar Item Preview */}
                        <div className="w-full max-w-[300px] mx-auto space-y-3">
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest text-center">Visual na Lista de Amigos</p>

                            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 transition-all cursor-default scale-110 shadow-2xl bg-white/5 backdrop-blur-md relative overflow-hidden">
                                {preview.cardBackground && <div className={`absolute inset-0 ${preview.cardBackground} opacity-30 -z-10`}></div>}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner text-white overflow-hidden flex-shrink-0 relative border-[2px] border-transparent ${preview.avatarBorder}`}>
                                    <img src={user?.user_metadata?.avatar_url || "https://i.pravatar.cc/150?img=12"} className="w-full h-full object-cover" />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1e1f2b] rounded-full"></div>
                                </div>
                                <div className="text-left overflow-hidden flex-1 relative z-10">
                                    <p className={`font-bold truncate text-sm ${preview.nameColor}`}>
                                        {user?.user_metadata?.username || 'Glave'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 truncate opacity-60">Visualizando anúncio...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Product Info */}
                <div className="w-full md:w-7/12 p-10 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                            {item.type === 'bundle' ? 'Pacote Completo' :
                                item.type === 'avatar_decoration' ? 'Decoração de Avatar' :
                                    item.type === 'name_color' ? 'Cor de Nome' :
                                        item.type === 'profile_effect' ? 'Efeito de Perfil' :
                                            item.type === 'card_background' ? 'Fundo de Cartão' : 'Personalização'}
                        </span>
                        {item.isNew && <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">Novo</span>}
                    </div>

                    <h1 className="text-4xl font-black text-white mb-4 tracking-tight shadow-md drop-shadow-lg drop-shadow-indigo-500/50">{item.title}</h1>

                    <p className="text-gray-300 leading-relaxed mb-8 border-l-4 border-indigo-500 pl-4 bg-white/5 py-4 pr-4 rounded-r-lg">
                        {item.description || "Adquira este item exclusivo e eleve seu status na comunidade para sempre."}
                    </p>

                    <div className="flex-1"></div>

                    {/* Purchase / Equip Section */}
                    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/10 mt-auto">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-xs font-bold uppercase">Preço Total</span>
                            {isOwned && <span className="text-green-400 text-xs font-bold flex items-center gap-1"><FaCheck /> Item Adquirido</span>}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FaStar className="text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" size={32} />
                                <div className="flex flex-col">
                                    <span className="text-3xl font-black text-white tracking-tight">
                                        {item.starsPrice ? item.starsPrice.toLocaleString('pt-BR') : 0}
                                    </span>
                                    <span className="text-xs text-yellow-500/60 font-bold uppercase tracking-wider">Estrelas</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {isEquipped ? (
                                    <button
                                        onClick={onEquip}
                                        className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-400 hover:text-red-300 font-bold py-3 px-8 rounded-lg cursor-pointer flex items-center gap-2 transition-all"
                                    >
                                        <FaTimes /> Desequipar
                                    </button>
                                ) : isOwned ? (
                                    <button
                                        onClick={onEquip}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-10 rounded-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] active:scale-95 transform flex items-center gap-2"
                                    >
                                        Equipar Agora
                                    </button>
                                ) : (
                                    <button
                                        onClick={onBuy}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-10 rounded-lg transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95 transform group relative overflow-hidden"
                                    >
                                        <span className="relative z-10 flex items-center gap-2"><FaShoppingBag /> Comprar Agora</span>
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-lg"></div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ProductModal;
