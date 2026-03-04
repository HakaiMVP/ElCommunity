import { allItems } from '../data/storeItems';

export const getCosmeticsForUser = (userProfile) => {
    const equippedDecorationId = userProfile?.equipped_avatar_decoration || null;
    const equippedEffectId = userProfile?.equipped_profile_effect || null;
    const equippedNameColorId = userProfile?.equipped_name_color || null;
    const equippedBackgroundId = userProfile?.equipped_card_background || null;

    let cosmetics = {
        nameColor: 'text-white',
        avatarBorder: 'border-[3px] border-gray-600',
        bannerBackground: 'bg-gradient-to-br from-indigo-900 via-purple-900 to-[#0f1015]',
        profileEffect: null,
        cardBackground: 'bg-[#1e1f2b]'
    };

    // Name Color overrides
    if (equippedNameColorId) {
        const item = allItems.find(i => i.id === equippedNameColorId && i.type === 'name_color');
        if (item && item.cssClass) cosmetics.nameColor = item.cssClass;
    }

    // Avatar Border overrides
    if (equippedDecorationId) {
        const item = allItems.find(i => i.id === equippedDecorationId && i.type === 'avatar_decoration');
        if (item && item.cssClass) cosmetics.avatarBorder = item.cssClass;
    }

    // Profile Effect (Banner) overrides — return the renderEffect function itself
    if (equippedEffectId) {
        const item = allItems.find(i => i.id === equippedEffectId && i.type === 'profile_effect');
        if (item && item.renderEffect) {
            cosmetics.profileEffect = item.renderEffect;
            cosmetics.bannerBackground = item.baseBanner || 'bg-black';
        }
    }

    // Card Background overrides
    if (equippedBackgroundId) {
        const item = allItems.find(i => i.id === equippedBackgroundId && i.type === 'card_background');
        if (item && item.cssClass) cosmetics.cardBackground = item.cssClass;
    }

    return cosmetics;
};
