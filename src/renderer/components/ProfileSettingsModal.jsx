import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaTimes, FaCamera, FaUser, FaSave, FaSync, FaCropAlt, FaCheck, FaBoxOpen, FaKeyboard, FaTachometerAlt, FaUndo, FaCheckCircle, FaExclamationTriangle, FaDesktop, FaWindowMinimize, FaGavel, FaListOl } from 'react-icons/fa';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/canvasUtils';
import Inventory from '../pages/Inventory';
import AlertModal from './AlertModal';
import { COMMUNITY_RULES } from '../constants/communityRules';

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const { user, userProfile } = useAuth();
    const isElectron = !!window.electron?.isElectron;
    const [nickname, setNickname] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewCoverUrl, setPreviewCoverUrl] = useState(null);
    const [displayId, setDisplayId] = useState(null);
    const [lastNicknameChange, setLastNicknameChange] = useState(null);

    // Crop State
    const [imageToCrop, setImageToCrop] = useState(null);
    const [cropType, setCropType] = useState('avatar'); // 'avatar' | 'cover'
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Tab State
    const [activeTab, setActiveTab] = useState('profile');

    // Warnings State
    const [warnings, setWarnings] = useState([]);
    const [loadingWarnings, setLoadingWarnings] = useState(false);
    const [showRules, setShowRules] = useState(false);

    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    // Shortcuts State
    const [shortcuts, setShortcuts] = useState(() => {
        const saved = localStorage.getItem('user-shortcuts');
        return saved ? JSON.parse(saved) : { toggleOverlay: "Alt+'" };
    });
    const [isRecording, setIsRecording] = useState(false);
    const [registrationResults, setRegistrationResults] = useState({});
    const [closeToTray, setCloseToTray] = useState(true);

    useEffect(() => {
        if (isOpen && window.electron?.storage) {
            window.electron.storage.getItem('closeToTray').then(val => {
                if (val !== null && val !== undefined) setCloseToTray(val);
            });
        }
    }, [isOpen]);

    const handleToggleCloseToTray = (val) => {
        setCloseToTray(val);
        localStorage.setItem('closeToTray', JSON.stringify(val));
        if (window.electron) {
            window.electron.storage.setItem('closeToTray', val);
            window.electron.sendGameSettings({ closeToTray: val });
        }
    };

    useEffect(() => {
        if (window.electron?.onShortcutStatus) {
            const removeListener = window.electron.onShortcutStatus((results) => {
                setRegistrationResults(results);
            });
            return removeListener;
        }
    }, []);

    // Load shortcuts from Supabase
    useEffect(() => {
        if (!isOpen || !user) return;

        const loadShortcuts = async () => {
            try {
                const { data, error } = await supabase
                    .from('game_settings')
                    .select('shortcuts')
                    .eq('id', user.id)
                    .single();

                if (!error && data?.shortcuts) {
                    setShortcuts(data.shortcuts);
                    localStorage.setItem('user-shortcuts', JSON.stringify(data.shortcuts));
                    if (window.electron?.updateShortcuts) {
                        window.electron.updateShortcuts(data.shortcuts);
                    }
                }
            } catch (e) {
                console.error('[ProfileSettings] Error loading shortcuts:', e);
            }
        };

        loadShortcuts();
    }, [isOpen, user]);

    const DEFAULT_SHORTCUT = "Alt+'";

    // Keys that should never be used as shortcuts
    const BLOCKED_KEYS = new Set([
        'PrintScreen', 'ScrollLock', 'Pause', 'ContextMenu',
        'MediaPlayPause', 'MediaTrackNext', 'MediaTrackPrevious', 'MediaStop',
        'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
        'LaunchMail', 'LaunchApp1', 'LaunchApp2',
    ]);

    // Modifier key names — these alone don't form a shortcut
    const MODIFIER_KEYS = new Set([
        'Control', 'Shift', 'Alt', 'Meta',
        'CommandOrControl', 'Super', 'AltGraph', 'CapsLock',
    ]);

    // Physical code → Electron accelerator name
    const CODE_TO_ACCELERATOR = {
        'Equal': '=', 'Minus': '-',
        'NumpadAdd': 'numadd', 'NumpadSubtract': 'numsub',
        'NumpadMultiply': 'nummult', 'NumpadDivide': 'numdiv',
        'NumpadDecimal': 'numdec',
        'Numpad0': 'num0', 'Numpad1': 'num1', 'Numpad2': 'num2',
        'Numpad3': 'num3', 'Numpad4': 'num4', 'Numpad5': 'num5',
        'Numpad6': 'num6', 'Numpad7': 'num7', 'Numpad8': 'num8',
        'Numpad9': 'num9', 'NumpadEnter': 'Return', 'NumLock': 'numlock',
        'Quote': "'", 'Backquote': '`',
        'BracketLeft': '[', 'BracketRight': ']',
        'Semicolon': ';', 'Comma': ',', 'Period': '.', 'Slash': '/',
        'IntlRo': '/', 'Backslash': '\\', 'IntlBackslash': '\\',
        'Space': 'Space',
        'ArrowUp': 'Up', 'ArrowDown': 'Down',
        'ArrowLeft': 'Left', 'ArrowRight': 'Right',
        'Tab': 'Tab', 'Backspace': 'Backspace',
        'Delete': 'Delete', 'Insert': 'Insert',
        'Home': 'Home', 'End': 'End',
        'PageUp': 'PageUp', 'PageDown': 'PageDown',
        'Enter': 'Return',
    };

    const getDisplayShortcut = (shortcutStr) => {
        if (!shortcutStr) return 'Nenhum';
        return shortcutStr
            .replace(/CommandOrControl/g, 'Ctrl')
            .replace(/Super/g, 'Win')
            .replace(/Plus/g, '+')
            .replace(/Return/g, 'Enter')
            .replace(/Space/g, 'Espaço')
            .replace(/\bnum(\d)/g, 'Num $1')
            .replace(/\bnumadd\b/g, 'Num +')
            .replace(/\bnumsub\b/g, 'Num -')
            .replace(/\bnummult\b/g, 'Num *')
            .replace(/\bnumdiv\b/g, 'Num /')
            .replace(/\bnumdec\b/g, 'Num .')
            .replace(/\bnumlock\b/g, 'NumLock');
    };

    const [shortcutError, setShortcutError] = useState(null);
    const [shortcutSuccess, setShortcutSuccess] = useState(false);

    const handleKeyDown = useCallback((e) => {
        if (!isRecording) return;
        e.preventDefault();
        e.stopPropagation();

        // ── Escape ALWAYS cancels, no exceptions ──
        if (e.key === 'Escape' || e.code === 'Escape') {
            setIsRecording(false);
            return;
        }

        // ── Build modifier list ──
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('CommandOrControl');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');
        if (e.metaKey) modifiers.push('Super');

        // ── Resolve the actual key name from physical code ──
        let keyName = '';

        if (CODE_TO_ACCELERATOR[e.code]) {
            keyName = CODE_TO_ACCELERATOR[e.code];
            // Equal + Shift = Plus in Electron
            if (e.code === 'Equal' && e.shiftKey) keyName = 'Plus';
        } else if (e.code.startsWith('Key') && e.code.length === 4) {
            // KeyA → A, KeyZ → Z (layout-independent)
            keyName = e.code.charAt(3);
        } else if (/^F\d{1,2}$/.test(e.code)) {
            // F1-F24
            keyName = e.code;
        } else if (/^Digit\d$/.test(e.code)) {
            // Digit0-Digit9
            keyName = e.code.charAt(5);
        } else if (e.key === 'Dead') {
            // Dead key fallback — use code mapping for ABNT etc.
            const deadMap = { 'Quote': "'", 'Backquote': '`', 'BracketLeft': '[', 'BracketRight': ']' };
            keyName = deadMap[e.code] || '';
        } else if (e.key.length === 1) {
            keyName = e.key.toUpperCase();
        }

        // ── Final normalization ──
        if (keyName === '+') keyName = 'Plus';
        if (keyName === ' ') keyName = 'Space';

        // ── Skip if only modifier pressed ──
        if (!keyName || MODIFIER_KEYS.has(keyName) || keyName === 'Dead') {
            return;
        }

        // ── Check blocked keys ──
        if (BLOCKED_KEYS.has(e.code) || BLOCKED_KEYS.has(e.key)) {
            setShortcutError('Essa tecla não pode ser usada como atalho.');
            setTimeout(() => setShortcutError(null), 3000);
            setIsRecording(false);
            return;
        }

        // ── Require at least one modifier ──
        if (modifiers.length === 0 && !['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(keyName)) {
            setShortcutError('Use pelo menos um modificador (Ctrl, Alt, Shift ou Win).');
            setTimeout(() => setShortcutError(null), 3000);
            setIsRecording(false);
            return;
        }

        const shortcutStr = [...modifiers, keyName].join('+');

        const newShortcuts = { ...shortcuts, toggleOverlay: shortcutStr };
        setShortcuts(newShortcuts);
        setIsRecording(false);
        setShortcutError(null);
        setShortcutSuccess(true);
        setTimeout(() => setShortcutSuccess(false), 3000);
        saveShortcuts(newShortcuts);
    }, [isRecording, shortcuts]);

    useEffect(() => {
        if (isRecording) {
            setShortcutError(null);
            setShortcutSuccess(false);
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isRecording, handleKeyDown]);

    const saveShortcuts = async (newShortcuts) => {
        localStorage.setItem('user-shortcuts', JSON.stringify(newShortcuts));

        if (window.electron?.updateShortcuts) {
            window.electron.updateShortcuts(newShortcuts);
        }

        if (user) {
            try {
                await supabase.from('game_settings').update({
                    shortcuts: newShortcuts,
                    updated_at: new Date().toISOString()
                }).eq('id', user.id);
                console.log('[ProfileSettings] Shortcuts saved to Supabase');
            } catch (e) {
                console.error('[ProfileSettings] Error saving shortcuts to DB:', e);
            }
        }
    };

    const handleResetShortcut = () => {
        const newShortcuts = { ...shortcuts, toggleOverlay: DEFAULT_SHORTCUT };
        setShortcuts(newShortcuts);
        setShortcutError(null);
        setShortcutSuccess(true);
        setTimeout(() => setShortcutSuccess(false), 3000);
        setRegistrationResults(prev => ({ ...prev, toggleOverlay: true }));
        saveShortcuts(newShortcuts);
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleFileSelect = (event, type) => {
        if (event.target.files && event.target.files.length > 0) {
            setCropType(type);
            const reader = new FileReader();
            reader.addEventListener('load', () => setImageToCrop(reader.result));
            reader.readAsDataURL(event.target.files[0]);
        }
    };

    const handleCropSave = async () => {
        try {
            setUploading(true);
            const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);

            const fileExt = 'jpg';
            const fileName = `${user.id}-${cropType}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            if (cropType === 'avatar') {
                setAvatarUrl(publicUrl);
                setPreviewUrl(publicUrl);
            } else {
                setCoverUrl(publicUrl);
                setPreviewCoverUrl(publicUrl);
            }
            setImageToCrop(null);
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao processar imagem: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Sessão expirada. Por favor, saia e entre novamente no aplicativo.');
            }

            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    username: nickname,
                    avatar_url: avatarUrl
                }
            });

            if (authError) throw authError;

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    username: nickname,
                    bio: bio,
                    avatar_url: avatarUrl,
                    cover_url: coverUrl,
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.warn('Metadata updated but profile sync failed:', profileError);
                showAlert('warning', 'Aviso', 'Aviso: problema ao sincronizar perfil público.');
            }
            showAlert('success', 'Sucesso', 'Perfil atualizado com sucesso!');
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao atualizar perfil: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (user && isOpen) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('username, bio, avatar_url, cover_url, display_id, last_nickname_change')
                    .eq('id', user.id)
                    .single();

                let initialNickname = user.user_metadata?.username || '';
                let initialAvatar = user.user_metadata?.avatar_url || '';
                let initialCover = '';

                if (!error && data) {
                    initialNickname = data.username || initialNickname;
                    setBio(data.bio || '');
                    initialAvatar = data.avatar_url || initialAvatar;
                    initialCover = data.cover_url || '';
                    setDisplayId(data.display_id);
                    setLastNicknameChange(data.last_nickname_change);
                }

                setNickname(initialNickname);
                setAvatarUrl(initialAvatar);
                setCoverUrl(initialCover);
                setPreviewUrl(initialAvatar);
                setPreviewCoverUrl(initialCover);
            }
        };
        fetchProfile();
    }, [user, isOpen]);

    useEffect(() => {
        const fetchWarnings = async () => {
            if (user && isOpen && activeTab === 'warnings') {
                setLoadingWarnings(true);
                try {
                    const { data, error } = await supabase
                        .from('user_warnings')
                        .select('*, admin:admin_id(username)')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    setWarnings(data || []);
                } catch (err) {
                    console.error('Error fetching warnings:', err);
                } finally {
                    setLoadingWarnings(false);
                }
            }
        };
        fetchWarnings();
    }, [user, isOpen, activeTab]);

    if (!isOpen) return null;

    const hasMagma = userProfile?.equipped_frame === 'avatar-magma' || userProfile?.equipped_effect === 'effect-king_of_curses';
    const hasGold = userProfile?.equipped_frame === 'avatar-gold';
    const hasNeon = userProfile?.equipped_frame === 'avatar-neon' || userProfile?.equipped_effect === 'effect-domain_expansion';
    const hasLightning = userProfile?.equipped_frame === 'avatar-lightning' || userProfile?.equipped_effect === 'effect-lightning_storm';
    const hasGalaxy = userProfile?.equipped_frame === 'avatar-galaxy' || userProfile?.equipped_effect === 'effect-dark_galaxy';

    const previewNameColor = hasMagma ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]'
        : hasGold ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]'
            : hasNeon ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]'
                : hasLightning ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                    : hasGalaxy ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.8)]'
                        : 'text-white';

    const modalContent = (
        <div className="fixed top-0 left-0 w-full h-full z-[99999] flex bg-[#0e0f14] animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            {/* Sidebar / Tabs */}
            <div className="w-[300px] h-full bg-[#161721] flex flex-col pt-12 pr-4 pb-6 pl-8 border-r border-white/5 shadow-2xl z-10 shrink-0">
                <div className="mb-8">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-4 mb-4 shrink-0">
                        Configurações do Usuário
                    </h2>
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-bold flex items-center gap-3 transition-colors ${activeTab === 'profile' ? 'bg-[#2d2f3b] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <FaUser className="text-lg opacity-80" /> Minha Conta
                        </button>
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-bold flex items-center gap-3 transition-colors ${activeTab === 'inventory' ? 'bg-[#2d2f3b] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <FaBoxOpen className="text-lg opacity-80" /> Inventário
                        </button>
                        <button
                            onClick={() => setActiveTab('warnings')}
                            className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-bold flex items-center gap-3 transition-colors ${activeTab === 'warnings' ? 'bg-[#2d2f3b] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="relative">
                                <FaExclamationTriangle className={`text-lg opacity-80 ${warnings.length > 0 ? 'text-red-400' : ''}`} />
                            </div>
                            <span className={warnings.length > 0 ? 'text-red-400' : ''}>Alertas</span>
                            {warnings.length > 0 && (
                                <span className="ml-auto bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30">
                                    {warnings.length}
                                </span>
                            )}
                        </button>
                        {/* Electron Only Tabs */}
                        {isElectron && (
                            <>
                                <button
                                    onClick={() => setActiveTab('shortcuts')}
                                    className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-bold flex items-center gap-3 transition-colors ${activeTab === 'shortcuts' ? 'bg-[#2d2f3b] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <FaKeyboard className="text-lg opacity-80" /> Atalhos
                                </button>
                                <button
                                    onClick={() => setActiveTab('general')}
                                    className={`w-full text-left py-3 px-4 rounded-xl text-[15px] font-bold flex items-center gap-3 transition-colors ${activeTab === 'general' ? 'bg-[#2d2f3b] text-white shadow-md' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <FaDesktop className="text-lg opacity-80" /> Geral
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Back / Close Button */}
                <div className="mt-auto pr-4">
                    <button
                        onClick={onClose}
                        className="group w-full py-3.5 rounded-xl border border-white/10 bg-[#1e1f2b] hover:bg-white/10 hover:border-white/20 transition-all text-[15px] font-bold text-gray-300 flex items-center justify-center gap-2 hover:text-red-400 shadow-lg"
                    >
                        <FaTimes className="group-hover:rotate-90 transition-transform duration-300" /> Voltar
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0e0f14] relative">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-12 lg:p-16">
                    <div className="max-w-4xl mx-auto w-full">
                        {activeTab === 'profile' ? (
                            <div className="space-y-12 pb-24">
                                {/* Section Header */}
                                <div>
                                    <h2 className="text-2xl font-black text-white mb-2">Minha Conta</h2>
                                    <p className="text-gray-400 font-medium">Personalize como as outras pessoas veem o seu perfil na comunidade.</p>
                                </div>

                                <div className="bg-[#1e1f2b] rounded-3xl pb-8 border border-white/5 shadow-2xl relative overflow-hidden">
                                    {/* Cover Image Background in Profile Card */}
                                    <div className="relative h-48 bg-[#0b0c10] border-b border-white/5 group">
                                        {previewCoverUrl || coverUrl ? (
                                            <img src={previewCoverUrl || coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-tr from-purple-900/60 to-indigo-900/40"></div>
                                        )}
                                        <label className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-xl cursor-copy hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg font-bold text-sm">
                                            <FaCamera size={14} /> Mudar Capa
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleFileSelect(e, 'cover')}
                                                disabled={uploading}
                                            />
                                        </label>
                                    </div>

                                    {/* Avatar Area */}
                                    <div className="relative mt-28 mb-8 flex items-end justify-between px-8">
                                        <div className="relative group -mt-24">
                                            <div className={`w-[120px] h-[120px] rounded-full bg-[#161721] flex items-center justify-center shadow-2xl overflow-hidden z-10 relative ${userProfile?.equipped_frame || ''} ring-[6px] ring-[#1e1f2b]`}>
                                                <div className="w-full h-full">
                                                    {previewUrl || avatarUrl ? (
                                                        <img src={previewUrl || avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-5xl font-bold text-white">
                                                            {nickname.slice(0, 1).toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <label className="absolute top-0 right-0 p-2.5 bg-purple-600 rounded-full cursor-pointer hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/50 border-4 border-[#1e1f2b] group-hover:scale-110 z-20 tooltip">
                                                <FaCamera className="text-white" size={14} />
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileSelect(e, 'avatar')}
                                                    disabled={uploading}
                                                />
                                            </label>
                                            {uploading && (
                                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center z-30 ring-[6px] ring-[#1e1f2b]">
                                                    <FaSync className="text-white animate-spin" size={24} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6 px-8">
                                        {/* Nickname Input */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center justify-between">
                                                <span>Nome de Exibição</span>
                                                {displayId !== null && <span className="text-purple-500/50 lowercase font-medium tracking-normal text-sm">#{displayId}</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                placeholder="Seu novo nickname..."
                                                className="w-full bg-[#0e0f14] border border-white/5 rounded-xl py-3 px-4 text-white text-[15px] focus:outline-none focus:border-purple-500 focus:bg-[#161721] transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-600"
                                                disabled={(() => {
                                                    if (!lastNicknameChange) return false;
                                                    const lastChange = new Date(lastNicknameChange);
                                                    const now = new Date();
                                                    const diffDays = (now - lastChange) / (1000 * 60 * 60 * 24);
                                                    return diffDays < 7 && nickname === (user.user_metadata?.username || '');
                                                })()}
                                            />
                                            {lastNicknameChange && (() => {
                                                const lastChange = new Date(lastNicknameChange);
                                                const now = new Date();
                                                const diffDays = (now - lastChange) / (1000 * 60 * 60 * 24);
                                                if (diffDays < 7) {
                                                    const remainingDays = Math.ceil(7 - diffDays);
                                                    return (
                                                        <p className="text-[11px] text-amber-500 font-bold max-w-sm mt-1">
                                                            Alteração disponível em {remainingDays} {remainingDays === 1 ? 'dia' : 'dias'}.
                                                        </p>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        {/* Bio Input */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Sobre Mim</label>
                                            <div className="relative">
                                                <textarea
                                                    value={bio}
                                                    onChange={(e) => setBio(e.target.value)}
                                                    placeholder="Conte um pouco sobre você..."
                                                    rows="4"
                                                    maxLength={160}
                                                    className="w-full bg-[#0e0f14] border border-white/5 rounded-xl py-3 px-4 text-white text-[15px] focus:outline-none focus:border-purple-500 focus:bg-[#161721] transition-all shadow-inner resize-none placeholder:text-gray-600"
                                                />
                                                <p className="absolute bottom-3 right-3 text-[10px] text-gray-600 font-bold">{bio.length}/160</p>
                                            </div>
                                        </div>

                                        {/* Final Adjustments / Preview Info */}
                                        <div className="pt-4 border-t border-white/5">
                                            <div className="bg-[#161721] border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                                                <div>
                                                    <h4 className="text-white font-bold mb-1">Pré-visualização do Chat</h4>
                                                    <p className="text-[13px] text-gray-400">Veja como seu nome aparecerá na comunidade.</p>
                                                </div>
                                                <div className={`px-6 py-3 rounded-xl shadow-inner border transition-all duration-500 overflow-hidden relative ${userProfile?.equipped_effect ? `${userProfile?.equipped_effect} border-transparent bg-transparent` : 'bg-[#0e0f14] border-white/5'}`}>
                                                    {userProfile?.equipped_effect && <div className="absolute inset-0 bg-[#0e0f14]/80 z-[-1]"></div>}
                                                    <span className={`font-bold text-xl relative z-10 ${previewNameColor}`}>
                                                        {nickname || user.user_metadata?.username || 'Usuário'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'shortcuts' ? (
                            <div className="space-y-10 pb-24 animate-fade-in">
                                <div>
                                    <h2 className="text-2xl font-black text-white mb-2">Atalhos de Teclado</h2>
                                    <p className="text-gray-400 font-medium">Configure teclas de acesso rápido para as funcionalidades do sistema.</p>
                                </div>

                                {/* Success/Error Banner */}
                                {shortcutError && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-6 py-4 flex items-center gap-3 animate-fade-in">
                                        <FaExclamationTriangle className="text-red-400 text-lg shrink-0" />
                                        <span className="text-red-300 text-sm font-semibold">{shortcutError}</span>
                                    </div>
                                )}
                                {shortcutSuccess && !shortcutError && (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-6 py-4 flex items-center gap-3 animate-fade-in">
                                        <FaCheckCircle className="text-green-400 text-lg shrink-0" />
                                        <span className="text-green-300 text-sm font-semibold">Atalho registrado com sucesso!</span>
                                    </div>
                                )}

                                <div className="space-y-5">
                                    {/* Toggle Overlay Shortcut */}
                                    <div className={`bg-[#1e1f2b] rounded-3xl p-8 border shadow-xl transition-all duration-500 ${isRecording ? 'border-purple-500/50 ring-2 ring-purple-500/20'
                                        : shortcutSuccess ? 'border-green-500/30'
                                            : registrationResults.toggleOverlay === false ? 'border-red-500/30'
                                                : 'border-white/5 hover:border-purple-500/30'
                                        }`}>
                                        <div className="flex items-start justify-between gap-6">
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                                                    <FaTachometerAlt className="text-purple-500" /> Alternar Overlay de FPS
                                                </h3>
                                                <p className="text-gray-400 text-sm">Mostra ou oculta o painel de desempenho durante o jogo.</p>
                                            </div>

                                            <div className="flex flex-col items-end gap-3">
                                                <button
                                                    onClick={() => { setIsRecording(true); setShortcutError(null); setShortcutSuccess(false); }}
                                                    className={`min-w-[160px] px-6 py-3.5 rounded-xl border font-mono font-bold text-lg transition-all flex items-center justify-center gap-3 ${isRecording
                                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 animate-pulse ring-4 ring-purple-500/20'
                                                        : registrationResults.toggleOverlay === false
                                                            ? 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20'
                                                            : 'bg-black/40 border-white/10 text-white hover:border-purple-500/40 hover:bg-purple-600/10 cursor-pointer'
                                                        }`}
                                                    title={isRecording ? 'Pressione Esc para cancelar' : 'Clique para gravar novo atalho'}
                                                >
                                                    {isRecording ? (
                                                        <span className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                                                            Pressione...
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-2">
                                                            <FaKeyboard className="text-sm opacity-50" />
                                                            {getDisplayShortcut(shortcuts.toggleOverlay)}
                                                        </span>
                                                    )}
                                                </button>

                                                {/* Status messages */}
                                                {isRecording && (
                                                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest animate-fade-in">
                                                        Esc para cancelar
                                                    </span>
                                                )}
                                                {registrationResults.toggleOverlay === false && !isRecording && !shortcutError && (
                                                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest animate-fade-in">
                                                        Atalho em conflito com outro programa
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reset button */}
                                        {shortcuts.toggleOverlay !== DEFAULT_SHORTCUT && !isRecording && (
                                            <div className="mt-5 pt-5 border-t border-white/5 flex justify-end">
                                                <button
                                                    onClick={handleResetShortcut}
                                                    className="text-xs text-gray-500 hover:text-purple-400 font-bold uppercase tracking-widest flex items-center gap-2 transition-colors py-2 px-4 rounded-lg hover:bg-white/5"
                                                >
                                                    <FaUndo className="text-[10px]" /> Restaurar padrão ({getDisplayShortcut(DEFAULT_SHORTCUT)})
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info card */}
                                    <div className="bg-purple-600/5 rounded-2xl p-6 border border-purple-500/10">
                                        <ul className="text-xs text-gray-500 leading-relaxed space-y-2">
                                            <li>• Atalhos globais funcionam mesmo com o aplicativo em segundo plano.</li>
                                            <li>• Requer pelo menos um modificador (<span className="text-gray-300">Ctrl</span>, <span className="text-gray-300">Alt</span>, <span className="text-gray-300">Shift</span> ou <span className="text-gray-300">Win</span>), exceto teclas F1-F12.</li>
                                            <li>• Evite combinações usadas pelo Windows (ex: <span className="text-gray-300">Alt+Tab</span>, <span className="text-gray-300">Ctrl+Alt+Del</span>).</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'general' ? (
                            <div className="space-y-10 pb-24 animate-fade-in">
                                <div>
                                    <h2 className="text-2xl font-black text-white mb-2">Geral</h2>
                                    <p className="text-gray-400 font-medium">Configurações gerais de comportamento do aplicativo.</p>
                                </div>

                                <div className="space-y-5">
                                    <div className="bg-[#1e1f2b] rounded-3xl p-8 border border-white/5 shadow-xl transition-all duration-500 hover:border-purple-500/30">
                                        <div className="flex items-start justify-between gap-6">
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                                                    <FaWindowMinimize className="text-purple-500" /> Minimizar para a Bandeja
                                                </h3>
                                                <p className="text-gray-400 text-sm">Quando ativo, clicar no botão de fechar (X) fará com que o aplicativo apenas se minimize para a bandeja do sistema perto do relógio em vez de fechar completamente.</p>
                                            </div>

                                            <div className="flex flex-col items-end gap-3 mt-2">
                                                <button
                                                    onClick={() => handleToggleCloseToTray(!closeToTray)}
                                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 shadow-inner ${closeToTray ? 'bg-purple-600' : 'bg-gray-700'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${closeToTray ? 'left-[26px]' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'warnings' ? (
                            <div className="space-y-10 pb-24 animate-fade-in">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                                                <FaExclamationTriangle className="text-red-500" /> Histórico de Alertas
                                            </h2>
                                            <p className="text-gray-400 font-medium">Avisos aplicados ao seu perfil pela moderação da ElCommunity.</p>
                                        </div>
                                        <button
                                            onClick={() => setShowRules(true)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105"
                                        >
                                            <FaListOl className="text-purple-400" /> Regras da Comunidade
                                        </button>
                                    </div>
                                    <div className="mt-8 bg-[#161721] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl relative group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent pointer-events-none"></div>

                                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-red-500/20 rounded-lg">
                                                    <FaExclamationTriangle className="text-red-500" />
                                                </div>
                                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Escada de Punição</h4>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 uppercase bg-black/40 px-3 py-1 rounded-full border border-white/5">
                                                Tolerância Progressiva
                                            </span>
                                        </div>

                                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                                            {[
                                                { count: 5, time: "3 Dias", color: "from-yellow-500/20 to-yellow-600/10", text: "text-yellow-500", border: "border-yellow-500/20" },
                                                { count: 7, time: "30 Dias", color: "from-orange-500/20 to-orange-600/10", text: "text-orange-500", border: "border-orange-500/20" },
                                                { count: 10, time: "90 Dias", color: "from-red-500/20 to-red-600/10", text: "text-red-500", border: "border-red-500/20" },
                                                { count: 11, time: "Permanente", color: "from-red-700/30 to-black/40", text: "text-red-600", border: "border-red-600/30" }
                                            ].map((step, i) => (
                                                <div key={i} className={`relative p-4 rounded-2xl border ${step.border} bg-gradient-to-br ${step.color} flex flex-col items-center text-center transition-all duration-300 hover:scale-105 group/step shadow-lg`}>
                                                    <div className={`text-2xl font-black mb-1 ${step.text}`}>{step.count}</div>
                                                    <div className="text-[9px] uppercase font-bold text-gray-400 mb-2">Alertas</div>
                                                    <div className="w-full h-px bg-white/5 mb-2"></div>
                                                    <div className={`text-[11px] font-black uppercase tracking-tight ${step.text}`}>Ban: {step.time}</div>

                                                    {/* Current Status Indicator (Mental Note: You could sync this with warnings.length) */}
                                                    {warnings.length >= step.count && (
                                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-lg animate-bounce border-2 border-[#161721]">
                                                            <FaCheck className="text-[10px] text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="px-6 py-4 bg-red-500/5 border-t border-white/5 italic">
                                            <p className="text-[11px] text-gray-500 font-medium text-center">
                                                "O sistema monitora seu comportamento. Cada alerta aproxima você da próxima restrição automática."
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {loadingWarnings ? (
                                        <div className="text-center py-10">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
                                            <p className="text-gray-500">Carregando histórico...</p>
                                        </div>
                                    ) : warnings.length === 0 ? (
                                        <div className="bg-[#1e1f2b] p-12 rounded-[2.5rem] border border-green-500/10 text-center flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-b from-green-500/[0.02] to-transparent pointer-events-none"></div>
                                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.1)] group-hover:scale-110 transition-transform duration-500">
                                                <FaCheckCircle className="text-green-500 text-4xl" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-3">Você é um membro exemplar!</h3>
                                            <p className="text-gray-400 max-w-sm leading-relaxed font-medium">
                                                Não encontramos nenhum registro de alerta ou infração no seu histórico. Obrigado por contribuir para uma comunidade saudável e respeitosa!
                                            </p>
                                            <div className="mt-8 px-6 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] font-black text-green-500 uppercase tracking-widest animate-pulse">
                                                Status: Conta Impecável
                                            </div>
                                        </div>
                                    ) : (
                                        warnings.map((warning, index) => (
                                            <div key={warning.id} className="bg-[#1e1f2b] rounded-3xl p-6 border border-red-500/20 flex flex-col gap-3 shadow-lg relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-red-500/10 text-red-400 text-xs font-bold px-2 py-1 rounded border border-red-500/20">
                                                            Alerta #{warnings.length - index}
                                                        </span>
                                                        <span className="text-gray-500 text-xs font-mono">
                                                            {new Date(warning.created_at).toLocaleString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Motivo do Alerta</p>
                                                    <p className="text-gray-200 text-sm whitespace-pre-wrap bg-black/30 p-4 rounded-xl border border-white/5">
                                                        {warning.reason}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-600 mt-2 text-right">
                                                    Aplicado por: {warning.admin?.username || 'Sistema'}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full animate-fade-in flex flex-col">
                                {/* Inventory specific content wrapper */}
                                <Inventory isModalContent={true} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Save Banner (Discord Style) */}
                {
                    activeTab === 'profile' && (
                        <div className="bg-[#161721] border-t border-white/5 p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20 sticky bottom-0 flex justify-between items-center">
                            <p className="text-gray-400 font-medium pl-4">Salve suas alterações antes de trocar de aba ou sair.</p>
                            <div className="flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="py-3 px-8 rounded-xl font-bold bg-[#2d2f3b] text-gray-300 hover:bg-[#3f414e] hover:text-white transition-colors"
                                >
                                    Esc - Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={(saving || uploading)}
                                    className="py-3 px-8 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-all shadow-lg shadow-green-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? <FaSync className="animate-spin" /> : <FaSave />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Cropper Modal Overlay */}
            {
                imageToCrop && (
                    <div className="fixed inset-0 z-[110] bg-[#0b0c15] flex flex-col items-center justify-center p-8 backdrop-blur-md">
                        <div className="w-full max-w-2xl bg-[#1e1f2b] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#161721]">
                                <h3 className="font-black text-xl flex items-center gap-3 text-white tracking-widest uppercase">
                                    <FaCropAlt className="text-purple-500" /> Ajustar Imagem
                                </h3>
                                <button onClick={() => setImageToCrop(null)} className="text-gray-400 hover:text-red-400 transition-colors bg-white/5 p-2 rounded-xl">
                                    <FaTimes size={18} />
                                </button>
                            </div>

                            <div className="relative h-[400px] bg-black">
                                <Cropper
                                    image={imageToCrop}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={cropType === 'avatar' ? 1 : 3} // 1:1 for Avatar, 3:1 for Cover
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    cropShape={cropType === 'avatar' ? 'round' : 'rect'}
                                    showGrid={true}
                                />
                            </div>

                            <div className="p-8 bg-[#161721] border-t border-white/5 space-y-6">
                                <div className="flex items-center gap-6">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-widest w-16">Zoom</span>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(e.target.value)}
                                        className="flex-1 accent-purple-600 h-2 bg-black/50 rounded-full appearance-none"
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={() => setImageToCrop(null)}
                                        className="flex-1 py-4 rounded-2xl font-bold bg-[#2d2f3b] text-gray-300 hover:bg-[#3f414e] hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCropSave}
                                        disabled={uploading}
                                        className="flex-[2] py-4 rounded-2xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/30 flex items-center justify-center gap-3"
                                    >
                                        {uploading ? <FaSync className="animate-spin" /> : <FaCheck className="text-lg" />}
                                        Aplicar Corte
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Community Rules Modal Overlay - Premium Redesign */}
            {showRules && (
                <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
                    {/* Background Decorative Glows */}
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>

                    <div className="bg-[#12131a]/80 w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 relative">
                            <div className="absolute inset-0 bg-white/[0.02] pointer-events-none"></div>
                            <div className="relative z-10">
                                <h3 className="text-3xl font-black text-white flex items-center gap-4 tracking-tight">
                                    <div className="p-3 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-2xl shadow-lg shadow-purple-900/40">
                                        <FaGavel className="text-white text-2xl" />
                                    </div>
                                    Regras da Comunidade
                                </h3>
                                <p className="text-gray-400 text-sm mt-2 font-medium bg-white/5 px-3 py-1 rounded-full w-fit">Essenciais para o nosso ecossistema</p>
                            </div>
                            <button
                                onClick={() => setShowRules(false)}
                                className="p-4 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-2xl transition-all text-gray-400 shadow-inner group"
                            >
                                <FaTimes className="group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-5">
                            {COMMUNITY_RULES.map((rule, idx) => (
                                <div
                                    key={rule.id}
                                    className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6 rounded-[2rem] border border-white/5 hover:border-purple-500/40 transition-all duration-500 group relative overflow-hidden flex flex-col gap-2 hover:shadow-[0_10px_30px_-10px_rgba(168,85,247,0.2)] hover:scale-[1.01]"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors"></div>

                                    <div className="flex gap-5 relative z-10">
                                        <div className="flex-shrink-0">
                                            <div className="w-14 h-14 rounded-2xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-transparent bg-clip-text bg-gradient-to-tr from-purple-400 to-blue-400 font-black text-2xl group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:border-purple-500/50">
                                                {rule.id.toString().padStart(2, '0')}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-white font-black text-xl mb-1 group-hover:text-purple-300 transition-colors">{rule.title}</h4>
                                            <p className="text-gray-400 text-[15px] leading-relaxed font-medium group-hover:text-gray-300 transition-colors">{rule.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-10 border-t border-white/5 bg-black/40 flex justify-center backdrop-blur-md">
                            <button
                                onClick={() => setShowRules(false)}
                                className="group relative px-12 py-4 font-black rounded-2xl overflow-hidden transition-all active:scale-95"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 group-hover:bg-[length:200%_100%] transition-all duration-500 bg-[length:100%_100%] animate-gradient-x"></div>
                                <span className="relative text-white text-lg flex items-center gap-3">
                                    <FaCheckCircle /> Entendi, serei um ótimo membro!
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertModal
                isOpen={alertState.isOpen}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
                onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );

    return createPortal(modalContent, document.body);
};

export default ProfileSettingsModal;
