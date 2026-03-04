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

                // Sync to Public Profile
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
        { id: 'avatar_decoration', label: 'Decorações de Avatar', icon: FaStar },
        { id: 'profile_effect', label: 'Efeitos de Perfil', icon: FaStar },
        { id: 'name_color', label: 'Cores de Nome', icon: FaStar },
        { id: 'card_background', label: 'Fundos de Cartão', icon: FaStar },
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
