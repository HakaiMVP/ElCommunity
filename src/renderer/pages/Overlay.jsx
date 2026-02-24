import React, { useState, useEffect, useRef } from 'react';

const Overlay = () => {
    const [perfData, setPerfData] = useState({ memory: 0, cpu: 0, freeMb: 0, game: null, gameFps: 0, gpuPercent: 0, ramPercent: 0, diskPercent: 0 });
    const [isMinimal, setIsMinimal] = useState(true);
    const [prevFps, setPrevFps] = useState(0);
    const [toggleKey, setToggleKey] = useState("Alt+'");
    const [notifications, setNotifications] = useState([]);
    const notifIdRef = useRef(0);

    // Helper to add a notification
    const addNotification = (data) => {
        if (!data) return;
        const id = ++notifIdRef.current;
        const notif = { ...data, id, createdAt: Date.now() };
        setNotifications(prev => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    // Listen for performance updates
    useEffect(() => {
        if (window.electron?.onPerformanceUpdate) {
            window.electron.onPerformanceUpdate((data) => {
                if (data) setPerfData(data);
            });
        }
    }, []);

    // Listen for notifications via DOM events (dispatched from preload.js)
    // This is bulletproof: preload registers the IPC listener before React loads,
    // stores notifications in a queue, and dispatches DOM events.
    useEffect(() => {
        // Process any notifications that arrived before React mounted
        if (window.__overlayNotifQueue?.length > 0) {
            console.log('[Overlay] Processing queued notifications:', window.__overlayNotifQueue.length);
            window.__overlayNotifQueue.forEach(data => addNotification(data));
            window.__overlayNotifQueue = [];
        }

        // Listen for new notifications via DOM event
        const handler = (e) => {
            console.log('[Overlay] Received notification via DOM event:', e.detail);
            addNotification(e.detail);
        };
        window.addEventListener('overlay-notif', handler);
        return () => window.removeEventListener('overlay-notif', handler);
    }, []);

    // Game settings state (synced via IPC)
    const [gameSettings, setGameSettings] = useState({
        overlayEnabled: true,
        overlayMode: 'minimal',
        overlayPosition: 'top-right',
        showFps: true,
        showCpu: true,
        showGpu: true,
        showRam: true,
        showDisk: true,
    });

    // Debug logs to identify black screen issues
    useEffect(() => {
        console.log('[Overlay] Rendering. Enabled:', gameSettings.overlayEnabled, 'Mode:', gameSettings.overlayMode);
    }, [gameSettings]);

    // Listen for game settings updates from main window via IPC
    useEffect(() => {
        if (window.electron?.onGameSettings) {
            const removeListener = window.electron.onGameSettings((settings) => {
                if (!settings) return;
                console.log('[Overlay] Received settings:', settings);
                setGameSettings(prev => ({ ...prev, ...settings }));
                if (settings.overlayMode !== undefined) {
                    setIsMinimal(settings.overlayMode === 'minimal');
                }
            });
            return removeListener;
        }

        // Request initial settings to ensure we are synced
        if (window.electron?.requestGameSettings) {
            console.log('[Overlay] Requesting initial settings...');
            window.electron.requestGameSettings();
        }
    }, []);

    // Listen for shortcut updates to display dynamic hint
    useEffect(() => {
        if (window.electron?.onShortcutsUpdate) {
            const removeListener = window.electron.onShortcutsUpdate((shortcuts) => {
                if (shortcuts?.toggleOverlay) {
                    setToggleKey(shortcuts.toggleOverlay);
                }
            });
            return removeListener;
        }
    }, []);

    // Toggle minimal mode with hotkey (Ctrl+Shift+O)
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'O') {
                setIsMinimal(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Smooth FPS animation
    useEffect(() => {
        const target = perfData.gameFps;
        if (prevFps !== target) {
            setPrevFps(target);
        }
    }, [perfData.gameFps]);

    // Notification Toast Component - INLINE rendering (not a sub-component to avoid remount issues)
    const renderNotifications = () => (
        <div style={{
            position: 'fixed',
            bottom: '60px',
            left: '16px',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '8px',
            zIndex: 10000,
            pointerEvents: 'none',
            fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
            maxWidth: '320px'
        }}>
            {notifications.slice(0, 3).map((notif) => (
                <div key={notif.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, rgba(15,15,25,0.95) 0%, rgba(30,25,50,0.92) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(147,51,234,0.3)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(147,51,234,0.15)',
                    opacity: 1,
                    position: 'relative'
                }}>
                    {/* Avatar */}
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: notif.type === 'comment'
                            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                            : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.1)'
                    }}>
                        {notif.avatar ? (
                            <img src={notif.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>
                                {notif.type === 'comment' ? '💬' : '✉️'}
                            </span>
                        )}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: notif.type === 'comment' ? '#fbbf24' : '#a78bfa',
                            letterSpacing: '0.3px',
                            marginBottom: '2px',
                            textTransform: 'uppercase'
                        }}>
                            {notif.title || (notif.type === 'comment' ? 'Novo Comentário' : 'Nova Mensagem')}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#d1d5db',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: '1.3'
                        }}>
                            {notif.body || ''}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // Format shortcut for display
    const displayToggleKey = toggleKey
        .replace(/CommandOrControl/g, 'Ctrl')
        .replace(/Super/g, 'Win')
        .replace(/Plus/g, '+')
        .replace(/Return/g, 'Enter')
        .replace(/Space/g, 'Space');

    const getFpsColor = (fps) => {
        if (fps >= 60) return '#00ff87';
        if (fps >= 45) return '#a8ff00';
        if (fps >= 30) return '#ffd000';
        if (fps >= 15) return '#ff6b00';
        return '#ff2d55';
    };

    const getFpsGlow = (fps) => {
        const color = getFpsColor(fps);
        return `0 0 20px ${color}40, 0 0 40px ${color}20`;
    };

    const getBarColor = (percent) => {
        if (percent >= 90) return '#ff2d55';
        if (percent >= 70) return '#ff6b00';
        if (percent >= 50) return '#ffd000';
        return '#00ff87';
    };

    // Position mapping
    const getPositionStyle = () => {
        const pos = gameSettings.overlayPosition;
        const style = {};
        if (pos.includes('top')) style.top = '8px';
        if (pos.includes('bottom')) style.bottom = '8px';
        if (pos.includes('left')) style.left = '8px';
        if (pos.includes('right')) style.right = '8px';
        return style;
    };

    const getFullPositionStyle = () => {
        const pos = gameSettings.overlayPosition;
        const style = {};
        if (pos.includes('top')) style.top = '10px';
        if (pos.includes('bottom')) style.bottom = '10px';
        if (pos.includes('left')) style.left = '10px';
        if (pos.includes('right')) style.right = '10px';
        return style;
    };

    const MiniBar = ({ value, max = 100, label, suffix = '%' }) => {
        const pct = Math.min(100, Math.max(0, (value / max) * 100));
        const color = getBarColor(pct);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ color: '#8a8f98', minWidth: '28px', fontWeight: 600, letterSpacing: '0.5px' }}>{label}</span>
                <div style={{
                    flex: 1,
                    height: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    minWidth: '40px'
                }}>
                    <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${color}90, ${color})`,
                        borderRadius: '2px',
                        transition: 'width 0.6s ease, background 0.4s ease',
                        boxShadow: `0 0 6px ${color}60`
                    }} />
                </div>
                <span style={{
                    color: color,
                    fontWeight: 700,
                    minWidth: '30px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums'
                }}>{value}{suffix}</span>
            </div>
        );
    };

    const Separator = () => (
        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
    );

    const MetricItem = ({ value, label, color }) => (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span style={{
                fontSize: '13px',
                fontWeight: 700,
                color: color,
                transition: 'color 0.4s ease'
            }}>{value}%</span>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#666', letterSpacing: '0.5px' }}>{label}</span>
        </div>
    );

    const fps = perfData.gameFps;
    const hasFps = fps > 0;
    const fpsColor = getFpsColor(fps);

    // Build list of visible metrics
    const metrics = [];
    if (gameSettings.showCpu) metrics.push({ value: perfData.cpu, label: 'CPU', color: getBarColor(perfData.cpu) });
    if (gameSettings.showGpu) metrics.push({ value: perfData.gpuPercent || 0, label: 'GPU', color: getBarColor(perfData.gpuPercent || 0) });
    if (gameSettings.showRam) metrics.push({ value: perfData.ramPercent || 0, label: 'RAM', color: getBarColor(perfData.ramPercent || 0) });
    if (gameSettings.showDisk) metrics.push({ value: perfData.diskPercent || 0, label: 'DSK', color: getBarColor(perfData.diskPercent || 0) });

    // ─── Modo Minimalista ─────────────────────────────────
    if (isMinimal) {
        return (
            <>
                {gameSettings.overlayEnabled && (
                    <div style={{
                        position: 'fixed',
                        ...getPositionStyle(),
                        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                        userSelect: 'none',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.4s ease'
                    }}>
                        {/* FPS */}
                        {gameSettings.showFps && (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                                <span style={{
                                    fontSize: '22px',
                                    fontWeight: 800,
                                    color: hasFps ? fpsColor : '#555',
                                    textShadow: hasFps ? `0 0 10px ${fpsColor}40` : 'none',
                                    letterSpacing: '-0.5px',
                                    transition: 'color 0.4s ease'
                                }}>{hasFps ? Math.round(fps) : '--'}</span>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#888', letterSpacing: '0.5px' }}>FPS</span>
                            </div>
                        )}

                        {/* Separator between FPS and metrics */}
                        {gameSettings.showFps && metrics.length > 0 && <Separator />}

                        {/* Metrics */}
                        {metrics.map((m, i) => (
                            <React.Fragment key={m.label}>
                                <MetricItem value={m.value} label={m.label} color={m.color} />
                                {/* Add separator between CPU/GPU group and RAM/DSK group */}
                                {i === 1 && metrics.length > 2 && <Separator />}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                {renderNotifications()}
            </>
        );
    }

    // ─── Modo Completo ────────────────────────────────────
    return (<>
        {gameSettings.overlayEnabled && (
            <div style={{
                position: 'fixed',
                ...getFullPositionStyle(),
                width: '180px',
                background: 'linear-gradient(135deg, rgba(15,15,20,0.88) 0%, rgba(25,25,35,0.85) 100%)',
                padding: '14px 16px 12px',
                borderRadius: '12px',
                fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                fontSize: '12px',
                color: '#e0e0e0',
                userSelect: 'none',
                pointerEvents: 'none',
                border: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                zIndex: 9999,
                transition: 'opacity 0.3s ease'
            }}>
                {/* ── FPS Display ── */}
                {gameSettings.showFps && (
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '10px',
                        position: 'relative'
                    }}>
                        <div style={{
                            fontSize: '36px',
                            fontWeight: 900,
                            color: hasFps ? fpsColor : '#444',
                            lineHeight: 1,
                            letterSpacing: '-2px',
                            textShadow: hasFps ? getFpsGlow(fps) : 'none',
                            transition: 'color 0.4s ease, text-shadow 0.4s ease',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {hasFps ? Math.round(fps) : '--'}
                        </div>
                        <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: hasFps ? fpsColor : '#555',
                            letterSpacing: '3px',
                            marginTop: '2px',
                            opacity: 0.8,
                            transition: 'color 0.4s ease'
                        }}>
                            FPS
                        </div>
                    </div>
                )}

                {/* ── Divider ── */}
                <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                    margin: '0 -4px 10px'
                }} />

                {/* ── Game Info ── */}
                {perfData.game && (
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#6b7280',
                            letterSpacing: '1.5px',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {perfData.game.name}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <MiniBar label="CPU" value={perfData.game.cpu} />
                            <MiniBar label="MEM" value={Math.round(perfData.game.memory / 1024 * 10) / 10} max={16} suffix="GB" />
                        </div>
                    </div>
                )}

                {/* ── System Stats ── */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    paddingTop: perfData.game ? '8px' : '0',
                    borderTop: perfData.game ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                    {gameSettings.showCpu && <MiniBar label="CPU" value={perfData.cpu} />}
                    {gameSettings.showGpu && <MiniBar label="GPU" value={perfData.gpuPercent || 0} />}
                    {gameSettings.showRam && <MiniBar label="RAM" value={perfData.ramPercent || 0} />}
                    {gameSettings.showDisk && <MiniBar label="DSK" value={perfData.diskPercent || 0} />}
                </div>

                {/* ── Hotkey hint ── */}
                <div style={{
                    fontSize: '8px',
                    color: '#3a3f4a',
                    marginTop: '8px',
                    textAlign: 'center',
                    letterSpacing: '0.5px'
                }}>
                    {displayToggleKey}
                </div>
            </div>
        )}
        {renderNotifications()}
    </>);
};

export default Overlay;
