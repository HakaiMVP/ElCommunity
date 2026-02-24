import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FaHome, FaStore, FaBook, FaCompass, FaSignOutAlt, FaCog, FaComments, FaGamepad, FaUserShield, FaShoppingBag, FaBoxOpen, FaBell } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../hooks/useAdmin';
import { supabase } from '../supabaseClient';
import ProfileSettingsModal from './ProfileSettingsModal';
import GameSettingsModal from './GameSettingsModal';
import NotificationPanel from './NotificationPanel';
import ForcedWarningModal from './ForcedWarningModal';
import BannedScreen from './BannedScreen';
import Logo from './Logo';

const MainLayout = () => {
    const { signOut, user, userProfile, isBanned } = useAuth();
    const { isAdmin } = useAdmin();
    const navigate = useNavigate();

    const [unreadCount, setUnreadCount] = React.useState(0);
    const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
    const [isGameSettingsOpen, setIsGameSettingsOpen] = React.useState(false);
    const [isNotifPanelOpen, setIsNotifPanelOpen] = React.useState(false);

    // Warning system
    const [unacknowledgedWarning, setUnacknowledgedWarning] = React.useState(null);

    // Removed local userProfile state and fetch logic, using context
    const isElectron = !!window.electron?.isElectron;

    // Redirect to login if user is missing (Safety Guard)
    React.useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user, navigate]);

    // Notify Electron main process to create overlay (only when user enters the app)
    React.useEffect(() => {
        if (!user || !window.electron?.notifyLoggedIn) return;

        const initOverlay = async () => {
            let settings = null;
            try {
                // Try fetching from Supabase
                const { data } = await supabase
                    .from('game_settings')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    settings = {
                        overlayEnabled: data.overlay_enabled ?? true,
                        overlayMode: data.overlay_mode || 'minimal',
                        overlayPosition: data.overlay_position || 'top-right',
                        overlayGameOnly: data.overlay_game_only ?? false,
                        showFps: data.show_fps ?? true,
                        showCpu: data.show_cpu ?? true,
                        showGpu: data.show_gpu ?? true,
                        showRam: data.show_ram ?? true,
                        showDisk: data.show_disk ?? true,
                    };
                    // Update local cache
                    localStorage.setItem('game-settings', JSON.stringify(settings));
                }
            } catch (e) {
                console.error('[MainLayout] Error fetching settings:', e);
            }

            // Fallback to localStorage if Supabase failed or returned no data
            if (!settings) {
                const saved = localStorage.getItem('game-settings');
                if (saved) {
                    try {
                        settings = JSON.parse(saved);
                    } catch (e) { /* ignore */ }
                }
            }

            // Fetch shortcuts from localStorage
            const savedShortcuts = localStorage.getItem('user-shortcuts');
            if (savedShortcuts) {
                try {
                    const shortcuts = JSON.parse(savedShortcuts);
                    if (settings) {
                        settings.shortcuts = shortcuts;
                    } else {
                        settings = { shortcuts };
                    }
                } catch (e) { /* ignore */ }
            }

            // Fetch closeToTray setting
            let closeToTray = true;
            if (window.electron?.storage) {
                const storedTray = await window.electron.storage.getItem('closeToTray');
                if (storedTray !== null && storedTray !== undefined) {
                    closeToTray = storedTray;
                }
            } else {
                const localTrayStr = localStorage.getItem('closeToTray');
                if (localTrayStr) {
                    try { closeToTray = JSON.parse(localTrayStr); } catch (e) { }
                }
            }

            if (settings) {
                settings.closeToTray = closeToTray;
            } else {
                settings = { closeToTray };
            }

            // Send to Electron (settings or null for defaults)
            window.electron.notifyLoggedIn(settings);
        };

        initOverlay();
    }, [user]);

    // Fetch Unacknowledged Warnings
    React.useEffect(() => {
        if (!user) return;

        const checkWarnings = async () => {
            try {
                // Procurar alertas que não foram lidos (acknowledged = false)
                // A tabela precisa ter essa coluna. Vou adicionar na migration/aviso ao usuário
                const { data, error } = await supabase
                    .from('user_warnings')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('acknowledged', false)
                    .order('created_at', { ascending: true }) // Pegar o mais antigo primeiro
                    .limit(1)
                    .single();

                if (data && !error) {
                    setUnacknowledgedWarning(data);
                }
            } catch (err) {
                // Ignore errors (fallback for missing column before SQL runs)
                console.warn("Could not fetch warnings (column might be missing):", err);
            }
        };

        checkWarnings();
    }, [user]);

    const handleAcknowledgeWarning = async (warningId) => {
        try {
            await supabase
                .from('user_warnings')
                .update({ acknowledged: true })
                .eq('id', warningId);

            setUnacknowledgedWarning(null);

            // Re-check for more warnings
            const { data, error } = await supabase
                .from('user_warnings')
                .select('*')
                .eq('user_id', user.id)
                .eq('acknowledged', false)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            if (data && !error) {
                setUnacknowledgedWarning(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Fetch and Poll for Unread Messages + Trigger Overlay Notifications
    React.useEffect(() => {
        if (!user) return;

        let lastKnownUnread = -1; // -1 means first fetch (don't notify on initial load)

        const fetchUnread = async () => {
            // Count unread messages
            const { count: msgCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .eq('is_read', false);

            // Count unread warnings
            const { count: warnCount } = await supabase
                .from('user_warnings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('acknowledged', false);

            const newCount = (msgCount || 0) + (warnCount || 0);

            // If unread count increased → new message arrived → send notification
            if (lastKnownUnread >= 0 && newCount > lastKnownUnread) {
                console.log('[MainLayout] Unread count increased:', lastKnownUnread, '→', newCount);
                try {
                    // Fetch the latest unread message to show in notification
                    const { data: latestMsg } = await supabase
                        .from('messages')
                        .select('sender_id, content')
                        .eq('receiver_id', user.id)
                        .eq('is_read', false)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (latestMsg) {
                        const { data: senderProfile } = await supabase
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', latestMsg.sender_id)
                            .single();
                        const senderName = senderProfile?.username || 'Alguém';
                        const messagePreview = (latestMsg.content || '').slice(0, 80);

                        if (window.electron?.sendNotification) {
                            console.log('[MainLayout] Sending notification:', senderName, messagePreview);
                            window.electron.sendNotification({
                                type: 'message',
                                title: senderName,
                                body: messagePreview || 'Nova mensagem',
                                avatar: senderProfile?.avatar_url || null
                            });
                        }
                    }
                } catch (e) {
                    console.error('[MainLayout] Error fetching latest message for notification:', e);
                }
            }

            lastKnownUnread = newCount;
            setUnreadCount(newCount);
        };

        fetchUnread();
        const interval = setInterval(fetchUnread, 3000);

        // Keep the real-time channel for instant badge updates (best effort)
        const channel = supabase
            .channel(`layout_notifications_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
                if (payload.new?.receiver_id === user.id || payload.old?.receiver_id === user.id) {
                    fetchUnread();
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_warnings' }, (payload) => {
                if (payload.new?.user_id === user.id || payload.old?.user_id === user.id) {
                    fetchUnread();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [user]);

    const handleSignOut = async () => {
        if (window.electron?.notifyLoggedOut) {
            window.electron.notifyLoggedOut();
        }
        await signOut();
        navigate('/');
    };

    const NavItem = ({ to, icon: Icon, label, badge }) => (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `relative group flex items-center justify-center w-12 h-12 mb-3 rounded-2xl transition-all duration-300 ${isActive
                    ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] rounded-xl nav-active'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-purple-600/50 hover:text-white hover:rounded-xl'
                }`
            }
        >
            <Icon size={20} />

            {/* Tooltip */}
            <div className="absolute left-full ml-3 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                {label}
                <div className="absolute top-1/2 right-full -mt-1 -mr-px border-4 border-transparent border-r-black/90"></div>
            </div>

            {/* Notification Badge */}
            {badge > 0 && (
                <div className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#1e1f2b]">
                    {badge > 99 ? '99+' : badge}
                </div>
            )}


            {/* Active Indicator Bar */}
            <div className="absolute left-0 w-1 bg-white rounded-r-full transition-all duration-300 h-0 group-hover:h-4 group-[.nav-active]:h-8"></div>
        </NavLink>
    );

    if (!user) return null; // Prevent rendering crashes

    // Se o usuário está banido, mostra apenas a tela de banimento
    if (isBanned && userProfile) {
        return <BannedScreen />;
    }

    return (
        <div className="flex h-screen w-full bg-[#0b0c15] overflow-hidden">
            {/* Background elements preserved from login */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="stars opacity-50"></div>
                <div className="twinkling opacity-30"></div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="w-[72px] flex-shrink-0 flex flex-col items-center py-4 bg-[#1E1F22] z-20">
                {/* ElCommunity Logo/Home */}
                <div className="mb-4 group relative">
                    <div
                        onClick={() => isElectron && setIsGameSettingsOpen(true)}
                        className={`relative w-12 h-12 rounded-[24px] group-hover:rounded-[16px] bg-[#313338] hover:bg-[#5865F2] transition-all duration-300 flex items-center justify-center text-white font-bold text-xl shadow-md cursor-pointer overflow-hidden`}
                        title={isElectron ? 'Game Settings' : 'ElCommunity'}
                    >
                        <div className={`transition-all duration-300 transform group-hover:scale-110`}>
                            {isElectron ? <FaGamepad size={24} /> : <Logo size={30} />}
                        </div>
                    </div>
                </div>

                <div className="w-8 h-[2px] bg-[#35363C] rounded-full mb-4"></div>

                {/* Main Nav Items */}
                <div className="flex-1 flex flex-col w-full items-center gap-2">
                    <NavItem to="/dashboard" icon={FaHome} label="Início" />
                    <NavItem to="/market" icon={FaStore} label="Mercado" />
                    <NavItem to="/store" icon={FaShoppingBag} label="Loja" />
                    <NavItem to="/guides" icon={FaBook} label="Guias" />
                    <NavItem to="/explore" icon={FaCompass} label="Explorar" />
                    <NavItem to="/chat" icon={FaComments} label="Chat" badge={unreadCount} />
                    {isAdmin && <NavItem to="/admin" icon={FaUserShield} label="Admin" />}
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col w-full items-center mt-auto pb-4 gap-3">
                    <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="w-12 h-12 flex items-center justify-center text-green-400 bg-[#313338] hover:bg-green-600 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all duration-300 group"
                        title="Configurações"
                    >
                        <FaCog size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="w-12 h-12 flex items-center justify-center text-red-400 bg-[#313338] hover:bg-red-500 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all duration-300"
                        title="Sair"
                    >
                        <FaSignOutAlt size={20} />
                    </button>
                </div>
            </nav>

            {/* Content Area */}
            <main className="flex-1 relative z-10 overflow-hidden flex flex-col glass-content">
                {/* Top Header / Context Bar (Optional for now, but good for future) */}
                <div className="h-12 border-b border-white/5 flex items-center px-4 bg-[#0b0c15]/50 backdrop-blur-sm relative z-50">
                    <span className="text-gray-400 text-sm font-medium">ElCommunity</span>
                    <span className="mx-2 text-gray-600">/</span>
                    <span className="text-white text-sm font-bold">Navegação</span>

                    {/* Notification Bell */}
                    <div className="ml-auto flex items-center relative">
                        <button
                            onClick={() => setIsNotifPanelOpen(!isNotifPanelOpen)}
                            className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 ${isNotifPanelOpen ? 'text-purple-400 bg-white/10' : 'text-gray-400 hover:text-purple-400 hover:bg-white/5'}`}
                            title="Notificações"
                        >
                            <FaBell size={16} className={unreadCount > 0 ? 'text-purple-400' : ''} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 border-2 border-[#0b0c15] animate-pulse">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <NotificationPanel
                            isOpen={isNotifPanelOpen}
                            onClose={() => setIsNotifPanelOpen(false)}
                        />
                    </div>
                </div>

                {/* Scrollable Page Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1200px] mx-auto w-full h-full">
                        <Outlet />
                    </div>
                </div>

                {/* Profile Settings Modal */}
                <ProfileSettingsModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                />

                {/* Game Settings Modal (Electron only) */}
                {isElectron && (
                    <GameSettingsModal
                        isOpen={isGameSettingsOpen}
                        onClose={() => setIsGameSettingsOpen(false)}
                    />
                )}

                {/* Forced User Warning Modal */}
                {unacknowledgedWarning && (
                    <ForcedWarningModal
                        warning={unacknowledgedWarning}
                        onAcknowledge={handleAcknowledgeWarning}
                    />
                )}
            </main>
        </div>
    );
};

export default MainLayout;
