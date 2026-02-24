import React, { useState, useEffect } from 'react';
import PremiumCard from '../components/PremiumCard';
import ProductModal from '../components/ProductModal';
import AlertModal from '../components/AlertModal';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaBoxOpen, FaStar, FaBorderAll, FaSearch, FaGem, FaBriefcase } from 'react-icons/fa';
import { allItems } from '../data/storeItems';

const Inventory = ({ isModalContent = false }) => {
    const { user, userProfile, refreshProfile } = useAuth();
    const [selectedItem, setSelectedItem] = useState(null);
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
    }, [user]);

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
            console.error('Error fetching inventory:', error);
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
                if (item.type === 'frame') {
                    await supabase.from('profiles').update({ equipped_frame: null }).eq('id', user.id);
                } else if (item.type === 'effect') {
                    await supabase.from('profiles').update({ equipped_effect: null }).eq('id', user.id);
                } else if (item.type === 'bundle') {
                    await supabase.from('profiles').update({ equipped_frame: null, equipped_effect: null }).eq('id', user.id);
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
            setSelectedItem(null); // Close modal on equip/unequip for smoother UX in inventory
        } catch (error) {
            console.error('Error toggling equip state:', error);
            showAlert('error', 'Erro', 'Não foi possível equipar/desequipar o item.');
        }
    };

    // Filter items to only show OWNED items
    const inventoryItems = allItems.filter(item => ownedItems.includes(item.id));

    const filteredItems = inventoryItems.filter(item => {
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
        <div className="w-full flex flex-col pb-32">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 px-4">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3 text-white">
                        Inventário
                        <FaBriefcase className="text-purple-500 text-2xl" />
                    </h1>
                    <p className="text-gray-400 font-medium">Equipe e gerencie os seus itens comprados na loja.</p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Procurar no inventário..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#161721] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-[#252736] transition-all shadow-inner text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Categories & Filter */}
            <div className={`py-4 mb-6 border-b border-white/5 flex gap-2 overflow-x-auto custom-scrollbar ${isModalContent ? 'px-0 mb-8' : 'sticky top-0 z-20 bg-[#0e0f14]/90 backdrop-blur-md px-4 -mx-4'}`}>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all whitespace-nowrap border ${activeCategory === cat.id
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-[#161721] border-white/5 text-gray-400 hover:bg-[#2d2f3b] hover:text-white'
                            }`}
                    >
                        <cat.icon /> {cat.label}
                    </button>
                ))}
            </div>

            {/* Empty State */}
            {inventoryItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4">
                    <div className="w-24 h-24 bg-[#161721] rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/5">
                        <FaBoxOpen className="text-gray-600 text-5xl" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Inventário Vazio</h3>
                    <p className="text-gray-400 max-w-sm">Você ainda não possui nenhum item premium. Visite a Loja para adquirir designs incríveis para a sua conta!</p>
                </div>
            )}

            {/* Grid */}
            {inventoryItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
                    {filteredItems.map(item => (
                        <div key={item.id} className="h-[280px]">
                            <PremiumCard
                                {...item}
                                onClick={() => setSelectedItem(item)}
                                // Inventory specific visual tweaks
                                isInventory={true}
                                isEquipped={equippedItems.includes(item.id)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Modals */}
            <ProductModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                isOwned={true} // In inventory, everything is owned
                isEquipped={selectedItem && equippedItems.includes(selectedItem.id)}
                onEquip={() => handleEquipItem(selectedItem)}
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

export default Inventory;
