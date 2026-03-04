import React, { useState, useEffect } from 'react';
import PremiumCard from '../components/PremiumCard';
import ProductModal from '../components/ProductModal';
import PurchaseModal from '../components/PurchaseModal';
import AlertModal from '../components/AlertModal';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaGem, FaSearch, FaStar, FaBorderAll, FaBoxOpen, FaMagic, FaPalette, FaImage } from 'react-icons/fa';
import { allItems } from '../data/storeItems';
import { getCosmeticsForUser } from '../utils/cosmetics';

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

    // Calculate discounted price for bundles based on already-owned items
    const getBundleDiscountedPrice = (item) => {
        if (!item || item.type !== 'bundle' || !item.bundleItems) return null;
        const ownedSubItems = item.bundleItems.filter(subId => ownedItems.includes(subId));
        if (ownedSubItems.length === 0) return null; // No discount
        // Sum prices of owned sub-items
        const ownedValue = ownedSubItems.reduce((sum, subId) => {
            const subItem = allItems.find(i => i.id === subId);
            return sum + (subItem?.starsPrice || 0);
        }, 0);
        return Math.max(0, (item.starsPrice || 0) - ownedValue);
    };

    // Triggered when user clicks "Buy" on an item
    const handleBuyClick = (item) => {
        if (ownedItems.includes(item.id)) {
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
            // Use discounted price for bundles
            const discounted = getBundleDiscountedPrice(item);
            const price = discounted != null ? discounted : (item.starsPrice ?? 0);

            if (currentStars < price) {
                return false;
            }

            try {
                // Determine items to insert
                let itemsToInsert = [];
                if (item.type === 'bundle' && item.bundleItems) {
                    itemsToInsert.push({ user_id: user.id, item_id: item.id, item_type: item.type });
                    for (const subItemId of item.bundleItems) {
                        const subItemDef = allItems.find(i => i.id === subItemId);
                        if (subItemDef && !ownedItems.includes(subItemDef.id)) {
                            itemsToInsert.push({ user_id: user.id, item_id: subItemDef.id, item_type: subItemDef.type });
                        }
                    }
                } else {
                    itemsToInsert.push({ user_id: user.id, item_id: item.id, item_type: item.type });
                }

                const { error: itemError } = await supabase
                    .from('user_items')
                    .insert(itemsToInsert);
                if (itemError) throw itemError;

                const newStars = currentStars - price;
                const { error: starsError } = await supabase
                    .from('profiles')
                    .update({ stars: newStars })
                    .eq('id', user.id);
                if (starsError) throw starsError;

                await fetchUserItems();
                await refreshProfile();
                return true;
            } catch (error) {
                console.error('Error buying item:', error);
                throw error;
            }
        } else {
            showAlert('info', 'Em Breve', "Integração com pagamento de dinheiro real em breve!");
            return false;
        }
    };

    const handleEquipItem = async (item) => {
        if (!user) return;
        try {
            // Note: Now we equip directly to profiles and user_items.
            // Bundles themselves are not strictly "equipped" in the visual sense, 
            // the user equips the individual pieces. But if they try to equip a bundle from the store,
            // we should equip all its pieces.

            const isCurrentlyEquipped = equippedItems.includes(item.id);
            let itemsToProcess = [item];

            if (item.type === 'bundle' && item.bundleItems) {
                itemsToProcess = item.bundleItems.map(bId => allItems.find(i => i.id === bId)).filter(Boolean);
                itemsToProcess.push(item); // Process the bundle record itself too
            }

            if (isCurrentlyEquipped) {
                // UNEQUIP Logic
                const { error } = await supabase
                    .from('user_items')
                    .update({ is_equipped: false })
                    .eq('user_id', user.id)
                    .in('item_id', itemsToProcess.map(i => i.id));

                if (error) throw error;

                // Sync to Public Profile to clear it
                let profileUpdates = {};
                for (const unequipItem of itemsToProcess) {
                    if (unequipItem.type === 'avatar_decoration') profileUpdates.equipped_avatar_decoration = null;
                    if (unequipItem.type === 'profile_effect') profileUpdates.equipped_profile_effect = null;
                    if (unequipItem.type === 'name_color') profileUpdates.equipped_name_color = null;
                    if (unequipItem.type === 'card_background') profileUpdates.equipped_card_background = null;

                    // Legacy cleans
                    if (unequipItem.type === 'avatar_decoration') profileUpdates.equipped_frame = null;
                    if (unequipItem.type === 'profile_effect') profileUpdates.equipped_effect = null;
                }

                if (Object.keys(profileUpdates).length > 0) {
                    await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
                }

            } else {
                // EQUIP Logic
                const { data: currentEquipped } = await supabase
                    .from('user_items')
                    .select('item_id, item_type')
                    .eq('user_id', user.id)
                    .eq('is_equipped', true);

                let typesToUnequip = itemsToProcess.map(i => i.type);

                const itemsBeingUnequipped = currentEquipped?.filter(eq => typesToUnequip.includes(eq.item_type)) || [];

                if (itemsBeingUnequipped.length > 0) {
                    await supabase
                        .from('user_items')
                        .update({ is_equipped: false })
                        .eq('user_id', user.id)
                        .in('item_id', itemsBeingUnequipped.map(i => i.item_id));
                }

                const { error } = await supabase
                    .from('user_items')
                    .update({ is_equipped: true })
                    .eq('user_id', user.id)
                    .in('item_id', itemsToProcess.map(i => i.id));

                if (error) throw error;

                // 4. Sync to Public Profile
                let profileUpdates = {};

                // Find the specific types in the process list to override profile with
                for (const processItem of itemsToProcess) {
                    if (processItem.type === 'avatar_decoration') profileUpdates.equipped_avatar_decoration = processItem.id;
                    if (processItem.type === 'profile_effect') profileUpdates.equipped_profile_effect = processItem.id;
                    if (processItem.type === 'name_color') profileUpdates.equipped_name_color = processItem.id;
                    if (processItem.type === 'card_background') profileUpdates.equipped_card_background = processItem.id;

                    // Nullify legacy fields if using new system
                    if (processItem.type === 'avatar_decoration') profileUpdates.equipped_frame = null;
                    if (processItem.type === 'profile_effect') profileUpdates.equipped_effect = null;
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

    const filteredItems = allItems.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.type === activeCategory;
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const categories = [
        { id: 'all', label: 'Todos', icon: FaBorderAll },
        { id: 'bundle', label: 'Kits Completos', icon: FaBoxOpen },
        { id: 'avatar_decoration', label: 'Decorações de Avatar', icon: FaStar },
        { id: 'profile_effect', label: 'Efeitos de Perfil', icon: FaMagic },
        { id: 'name_color', label: 'Cores de Nome', icon: FaPalette },
        { id: 'card_background', label: 'Fundos de Cartão', icon: FaImage }
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
            {(activeCategory === 'all' || activeCategory === 'bundle') && !searchQuery && allItems.find(i => i.isFeatured) && (
                <div className="relative w-full mb-8 animate-in fade-in zoom-in duration-700">
                    <div
                        className="relative w-full h-[350px] md:h-[450px] rounded-[2.5rem] overflow-hidden group cursor-pointer border border-white/10 shadow-2xl flex items-center"
                        onClick={() => setSelectedItem(allItems.find(i => i.isFeatured))}
                    >
                        <img src={allItems.find(i => i.isFeatured).backgroundImage} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0c15] via-[#0b0c15]/80 to-transparent"></div>

                        <div className="relative z-10 p-8 md:p-16 flex flex-col justify-center max-w-2xl">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20">
                                    Destaque
                                </span>
                                <span className="text-purple-400 text-xs font-bold uppercase tracking-widest opacity-70">
                                    Kit de Edição Limitada
                                </span>
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tighter drop-shadow-2xl">
                                {allItems.find(i => i.isFeatured).title}
                            </h2>
                            <p className="text-gray-300 text-base md:text-lg mb-8 line-clamp-2 max-w-xl font-medium leading-relaxed">
                                {allItems.find(i => i.isFeatured).description}
                            </p>

                            <div className="flex items-center gap-4">
                                <button className="bg-white text-[#0b0c15] px-8 py-3.5 rounded-2xl font-black hover:bg-gray-100 transition-all shadow-xl shadow-white/5 active:scale-95 flex items-center gap-2">
                                    <FaStar className="text-yellow-500" />
                                    Adquirir por {allItems.find(i => i.isFeatured).starsPrice.toLocaleString('pt-BR')}
                                </button>
                                <button className="px-7 py-3.5 rounded-2xl border border-white/20 hover:bg-white/10 transition-all font-bold backdrop-blur-md active:scale-95">
                                    Ver Detalhes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Categories & Filter - Higher Z-index and better appearance */}
            <div className="sticky top-0 z-[60] bg-[#0b0c15]/90 backdrop-blur-md py-4 -mx-8 px-8 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar shadow-lg shadow-black/20">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2.5 transition-all whitespace-nowrap border-2 ${activeCategory === cat.id
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-[#1e1f2b] border-transparent text-gray-500 hover:border-white/10 hover:text-white'
                            }`}
                    >
                        <cat.icon className={activeCategory === cat.id ? 'text-white' : 'text-gray-600'} /> {cat.label}
                    </button>
                ))}
            </div>

            {/* Grid - Increased top margin relative to sticky bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {filteredItems.map(item => (
                    // Skip the featured item if it's already shown in hero (only when viewing 'all' and no search)
                    ((activeCategory === 'all' && !searchQuery && item.isFeatured) ? null : (
                        <div key={item.id} className={`${item.type === 'bundle' ? 'sm:col-span-2 h-[240px]' : 'h-[260px]'}`}>
                            <PremiumCard
                                {...item}
                                playerName={userProfile?.username || user?.user_metadata?.username || 'Player'}
                                onClick={() => setSelectedItem(item)}
                            />
                        </div>
                    ))
                ))}
            </div>

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
                discountedPrice={purchaseItem ? getBundleDiscountedPrice(purchaseItem) : null}
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

