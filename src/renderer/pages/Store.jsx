import React, { useState, useEffect } from 'react';
import PremiumCard from '../components/PremiumCard';
import ProductModal from '../components/ProductModal';
import PurchaseModal from '../components/PurchaseModal';
import AlertModal from '../components/AlertModal';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaFire, FaGem, FaSearch, FaFilter, FaStar, FaMagic, FaBorderAll, FaBoxOpen, FaShoppingCart } from 'react-icons/fa';
import { allItems } from '../data/storeItems';

const Store = () => {
    const { user, userProfile, refreshProfile } = useAuth();
    const [selectedItem, setSelectedItem] = useState(null);
    const [purchaseItem, setPurchaseItem] = useState(null);
    const [ownedItems, setOwnedItems] = useState([]);
    const [equippedItems, setEquippedItems] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    useEffect(() => {
        if (user) {
            fetchUserItems();
        }

        // Auto-refresh stars every 5 seconds
        const interval = setInterval(() => {
            if (user) refreshProfile();
        }, 5000);

        return () => clearInterval(interval);
    }, [user, refreshProfile]);

    const fetchUserItems = async () => {
        try {
            const { data, error } = await supabase
                .from('user_items')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            setOwnedItems(data.map(item => item.item_id));
            setEquippedItems(data.filter(item => item.is_equipped).map(item => item.item_id));
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    };

    // Triggered when user clicks "But" on an item
    const handleBuyClick = (item) => {
        if (ownedItems.includes(item.id)) {
            // If already owned, maybe just equip? separate logic.
            // For now, prevent rebuying or show owned state
            return;
        }
        setPurchaseItem(item);
    }

    // Called by PurchaseModal when user confirms purchase method
    const handlePurchaseConfirm = async (method) => {
        if (!user || !purchaseItem) return false;

        const item = purchaseItem;

        if (method === 'stars') {
            const currentStars = userProfile?.stars ?? 0;
            const price = item.starsPrice ?? 0;

            if (currentStars < price) {
                // Should be caught by modal validation, but double check
                return false;
            }

            try {
                // 1. Add item to user_items
                const { error: itemError } = await supabase
                    .from('user_items')
                    .insert([{
                        user_id: user.id,
                        item_id: item.id,
                        item_type: item.type
                    }]);
                if (itemError) throw itemError;

                // 2. Deduct stars from profile
                const newStars = currentStars - price;
                const { error: starsError } = await supabase
                    .from('profiles')
                    .update({ stars: newStars })
                    .eq('id', user.id);
                if (starsError) throw starsError;

                await fetchUserItems();
                await refreshProfile();
                return true; // Success
            } catch (error) {
                console.error('Error buying item:', error);
                throw error; // Pass to modal
            }
        } else {
            // BRL Payment Logic (Mock for now)
            showAlert('info', 'Em Breve', "Integração com pagamento BRL em breve!");
            return false;
        }
    };

    const handleEquipItem = async (item) => {
        if (!user) return;
        try {
            const isCurrentlyEquipped = equippedItems.includes(item.id);

            if (isCurrentlyEquipped) {
                // UNEQUIP Logic
                const { error } = await supabase
                    .from('user_items')
                    .update({ is_equipped: false })
                    .eq('user_id', user.id)
                    .eq('item_id', item.id);

                if (error) throw error;

                // Sync to Public Profile to clear it
                let profileUpdates = {};
                if (item.type === 'frame') profileUpdates.equipped_frame = null;
                if (item.type === 'effect') profileUpdates.equipped_effect = null;
                if (item.type === 'bundle') {
                    profileUpdates.equipped_frame = null;
                    profileUpdates.equipped_effect = null;
                }

                if (Object.keys(profileUpdates).length > 0) {
                    await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
                }

            } else {
                // EQUIP Logic
                // 1. Fetch currently equipped items to know what to unequip
                const { data: currentEquipped } = await supabase
                    .from('user_items')
                    .select('item_id, item_type')
                    .eq('user_id', user.id)
                    .eq('is_equipped', true);

                let typesToUnequip = [item.type];
                if (item.type === 'frame') typesToUnequip.push('bundle');
                if (item.type === 'effect') typesToUnequip.push('bundle');
                if (item.type === 'bundle') {
                    typesToUnequip.push('frame');
                    typesToUnequip.push('effect');
                }

                // Find items being unequipped to clear their profile slots safely
                const itemsBeingUnequipped = currentEquipped?.filter(eq => typesToUnequip.includes(eq.item_type)) || [];

                // 2. Unequip all items of conflicting types
                if (itemsBeingUnequipped.length > 0) {
                    await supabase
                        .from('user_items')
                        .update({ is_equipped: false })
                        .eq('user_id', user.id)
                        .in('item_id', itemsBeingUnequipped.map(i => i.item_id));
                }

                // 3. Equip this item
                const { error } = await supabase
                    .from('user_items')
                    .update({ is_equipped: true })
                    .eq('user_id', user.id)
                    .eq('item_id', item.id);

                if (error) throw error;

                // 4. Sync to Public Profile
                let profileUpdates = {};

                // First, nullify properties of unequipped items
                for (const eq of itemsBeingUnequipped) {
                    if (eq.item_type === 'frame') profileUpdates.equipped_frame = null;
                    if (eq.item_type === 'effect') profileUpdates.equipped_effect = null;
                    if (eq.item_type === 'bundle') {
                        profileUpdates.equipped_frame = null;
                        profileUpdates.equipped_effect = null;
                    }
                }

                // Then override with the new item's properties
                if (item.type === 'frame') {
                    profileUpdates.equipped_frame = 'avatar-' + item.id.replace('frame_', '');
                } else if (item.type === 'effect') {
                    profileUpdates.equipped_effect = 'effect-' + item.id;
                } else if (item.type === 'bundle') {
                    if (item.id === 'yuji_bundle') {
                        profileUpdates.equipped_frame = 'avatar-magma';
                        profileUpdates.equipped_effect = 'effect-king_of_curses';
                    } else if (item.id === 'gojo_bundle') {
                        profileUpdates.equipped_frame = 'avatar-neon';
                        profileUpdates.equipped_effect = 'effect-domain_expansion';
                    } else if (item.id === 'lightning_bundle') {
                        profileUpdates.equipped_frame = 'avatar-lightning';
                        profileUpdates.equipped_effect = 'effect-lightning_storm';
                    } else if (item.id === 'galaxy_bundle') {
                        profileUpdates.equipped_frame = 'avatar-galaxy';
                        profileUpdates.equipped_effect = 'effect-dark_galaxy';
                    }
                }

                if (Object.keys(profileUpdates).length > 0) {
                    await supabase
                        .from('profiles')
                        .update(profileUpdates)
                        .eq('id', user.id);
                }
            }

            fetchUserItems();
            refreshProfile();
        } catch (error) {
            console.error('Error equipping item:', error);
        }
    };

    // Store Data imported from storeItems.js

    const filteredItems = allItems.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.type === activeCategory;
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categories = [
        { id: 'all', label: 'Todos', icon: FaBorderAll },
        { id: 'frame', label: 'Molduras', icon: FaStar },
        { id: 'bundle', label: 'Kits Completos', icon: FaBoxOpen }
    ];

    return (
        <div className="min-h-full p-8 text-white relative flex flex-col gap-8 pb-32 max-w-7xl mx-auto">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black flex items-center gap-3 tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Loja Premium</span>
                        <FaGem className="text-purple-500 text-2xl animate-pulse" />
                    </h1>
                    <p className="text-gray-400 mt-2 font-medium">Itens exclusivos para personalizar seu perfil.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Stars Display Box */}
                    <div className="bg-[#1e1f2b] border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 font-bold text-sm shadow-xl min-w-[140px] group hover:border-yellow-500/30 transition-all">
                        <div className="bg-yellow-400/10 p-2 rounded-lg group-hover:bg-yellow-400/20 transition-colors">
                            <FaStar className="text-yellow-400 text-lg drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Suas Estrelas</span>
                            <span className="text-lg tracking-tight">{(userProfile?.stars ?? 0).toLocaleString('pt-BR')}</span>
                        </div>
                    </div>

                    <div className="relative flex-1 md:w-80 group">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Procurar itens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1e1f2b] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-[#252736] transition-all shadow-lg text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Featured Hero (Only shows on 'all' or 'bundle' view) */}
            {(activeCategory === 'all' || activeCategory === 'bundle') && !searchQuery && (
                <div className="relative w-full h-[400px] rounded-[3rem] overflow-hidden group cursor-pointer border border-white/10 shadow-2xl" onClick={() => setSelectedItem(allItems[0])}>
                    <img src={allItems[0].backgroundImage} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>

                    <div className="absolute inset-0 p-12 flex flex-col justify-center max-w-2xl">
                        <span className="inline-block px-4 py-1 rounded-full bg-red-600 text-white text-xs font-bold w-fit mb-4">DESTAQUE DA SEMANA</span>
                        <h2 className="text-5xl font-black mb-4 leading-tight drop-shadow-lg">{allItems[0].title}</h2>
                        <p className="text-gray-300 text-lg mb-8 line-clamp-2">{allItems[0].description}</p>

                        <div className="flex items-center gap-6">
                            <button className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg shadow-white/10 flex items-center gap-2">
                                <FaStar className="text-yellow-500" />
                                Adquirir {allItems[0].starsPrice.toLocaleString('pt-BR')} Estrelas
                            </button>
                            <button className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 transition-colors font-medium backdrop-blur-sm">
                                Ver Detalhes
                            </button>
                        </div>
                    </div>

                    <img src={allItems[0].mainImage} className="absolute right-0 bottom-0 h-[110%] object-contain drop-shadow-[0_0_50px_rgba(255,0,0,0.3)] group-hover:scale-105 transition-transform duration-500" alt="" />
                </div>
            )}

            {/* Categories & Filter */}
            <div className="sticky top-0 z-20 bg-[#13141f]/80 backdrop-blur-xl py-4 -mx-8 px-8 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap border ${activeCategory === cat.id
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-[#1e1f2b] border-white/5 text-gray-400 hover:bg-[#2d2f3b] hover:text-white'
                            }`}
                    >
                        <cat.icon /> {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredItems.map(item => (
                    // Skip the very first item if it's already shown in hero (only when viewing 'all' and no search)
                    ((activeCategory === 'all' && !searchQuery && item.id === allItems[0].id) ? null : (
                        <div key={item.id} className="h-[380px]">
                            <PremiumCard
                                {...item}
                                onClick={() => setSelectedItem(item)}
                            />
                        </div>
                    ))
                ))}
            </div>

            {/* Modals */}
            {/* Modals */}
            <ProductModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                isOwned={selectedItem && ownedItems.includes(selectedItem.id)}
                isEquipped={selectedItem && equippedItems.includes(selectedItem.id)}
                onBuy={() => handleBuyClick(selectedItem)}
                onEquip={() => handleEquipItem(selectedItem)}
            />

            <PurchaseModal
                isOpen={!!purchaseItem}
                item={purchaseItem}
                userStars={userProfile?.stars ?? 0}
                onConfirm={handlePurchaseConfirm}
                onClose={() => setPurchaseItem(null)}
            />

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />
        </div>
    );
};

export default Store;
