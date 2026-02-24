/**
 * Formats a user's display name with their sequential ID.
 * @param {Object} profile - The user profile object (from profiles table)
 * @param {string} fallbackName - The fallback name if profile is missing (e.g. author_name from content)
 * @returns {string} The formatted name (e.g. "Username#123" or "Username")
 */
export const formatUserName = (profile, fallbackName) => {
    return profile?.username || fallbackName || 'Usuário Desconhecido';
};


/**
 * Gets the valid avatar URL or a fallback.
 * @param {Object} profile - The user profile object
 * @returns {string|null} The avatar URL or null
 */
export const getUserAvatar = (profile) => {
    return profile?.avatar_url || null;
};
