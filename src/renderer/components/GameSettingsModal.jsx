import React, { useState, useEffect } from 'react';
import { FaTimes, FaGamepad, FaDesktop, FaTachometerAlt, FaLayerGroup, FaSave, FaMicrochip, FaMemory, FaHdd, FaEye, FaEyeSlash, FaSync, FaQuestionCircle } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const GameSettingsModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        overlayEnabled: true,
        overlayMode: 'minimal',
        overlayPosition: 'top-right',
        overlayGameOnly: false,
        showFps: true,
        showCpu: true,
        showGpu: true,
        showRam: true,
        showDisk: true,
    });

    const [processList, setProcessList] = useState([]);
    const [selectedProcess, setSelectedProcess] = useState(null);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load settings from Supabase (fallback to localStorage)
    useEffect(() => {
        if (!isOpen || !user) return;

        const loadSettings = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('game_settings')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (!error && data) {
                    const loaded = {
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
                    setSettings(loaded);
                    localStorage.setItem('game-settings', JSON.stringify(loaded));
                } else {
                    // Fallback to localStorage
                    const saved = localStorage.getItem('game-settings');
                    if (saved) {
                        try { setSettings(prev => ({ ...prev, ...JSON.parse(saved) })); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) {
                // Offline fallback
                const saved = localStorage.getItem('game-settings');
                if (saved) {
                    try { setSettings(prev => ({ ...prev, ...JSON.parse(saved) })); } catch (e) { /* ignore */ }
                }
            }
            setLoading(false);
        };

        loadSettings();
    }, [isOpen, user]);

    // Fetch running windows
    const fetchProcesses = async () => {
        setLoadingProcesses(true);
        try {
            if (window.electron?.getRunningWindows) {
                const windows = await window.electron.getRunningWindows();
                setProcessList(windows || []);
            }
        } catch (e) {
            console.error('Error fetching processes:', e);
        }
        setLoadingProcesses(false);
    };

    useEffect(() => {
        if (isOpen) fetchProcesses();
    }, [isOpen]);

    // Handle updates from main process (e.g. shortcut toggles)
    useEffect(() => {
        if (!isOpen) return;
        if (window.electron?.onGameSettings) {
            const removeListener = window.electron.onGameSettings((newSettings) => {
                if (newSettings) {
                    // Strip shortcuts to avoid merging them into game settings state
                    const { shortcuts, ...gameOnly } = newSettings;
                    setSettings(prev => ({ ...prev, ...gameOnly }));
                }
            });
            return removeListener;
        }
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);

        // Save to localStorage (cache)
        localStorage.setItem('game-settings', JSON.stringify(settings));
        localStorage.setItem('osd-minimal', String(settings.overlayMode === 'minimal'));

        // Save to Supabase
        if (user) {
            try {
                // Use update to avoid clobbering other columns like 'shortcuts'
                await supabase.from('game_settings').update({
                    overlay_enabled: settings.overlayEnabled,
                    overlay_mode: settings.overlayMode,
                    overlay_position: settings.overlayPosition,
                    overlay_game_only: settings.overlayGameOnly,
                    show_fps: settings.showFps,
                    show_cpu: settings.showCpu,
                    show_gpu: settings.showGpu,
                    show_ram: settings.showRam,
                    show_disk: settings.showDisk,
                    updated_at: new Date().toISOString(),
                }).eq('id', user.id);
            } catch (e) {
                console.error('Error saving game settings to DB:', e);
            }
        }

        // Send settings to overlay via IPC (strip shortcuts to avoid re-registration)
        if (window.electron?.sendGameSettings) {
            const { shortcuts, ...gameOnly } = settings;
            window.electron.sendGameSettings(gameOnly);
        }

        // Select process via IPC if changed
        if (selectedProcess && window.electron?.selectProcess) {
            window.electron.selectProcess(selectedProcess.pid);
        }

        setSaving(false);
        onClose();
    };

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        // Immediate feedback for overlay toggle and metrics (strip shortcuts)
        if (window.electron?.sendGameSettings) {
            const { shortcuts, ...gameOnly } = newSettings;
            window.electron.sendGameSettings(gameOnly);
        }
    };

    if (!isOpen) return null;

    const Toggle = ({ value, onChange, label, icon: Icon, helpTooltip }) => (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="text-purple-400" size={14} />}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">{label}</span>
                    {helpTooltip && (
                        <div className="group relative flex items-center">
                            <FaQuestionCircle className="text-gray-500 hover:text-white cursor-help transition-colors" size={12} />
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-black/90 text-xs text-gray-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 text-center border border-white/10 shadow-xl">
                                {helpTooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black/90"></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`relative w-10 h-5 rounded-full transition-all duration-300 ${value ? 'bg-purple-600' : 'bg-gray-700'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
        </div>
    );

    const PositionButton = ({ pos, label }) => (
        <button
            onClick={() => updateSetting('overlayPosition', pos)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${settings.overlayPosition === pos
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-black/30 text-gray-400 hover:bg-white/5 border border-white/5'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1e1f2b] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <FaGamepad className="text-purple-500" /> Game Settings
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">

                    {/* ── Overlay Section ── */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <FaLayerGroup size={12} /> Overlay
                        </h3>
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                            <Toggle
                                value={settings.overlayEnabled}
                                onChange={(v) => updateSetting('overlayEnabled', v)}
                                label="Overlay Ativo"
                                icon={settings.overlayEnabled ? FaEye : FaEyeSlash}
                                helpTooltip="Para que todas as funções funcionem corretamente, execute o programa como administrador."
                            />
                            {/* Game Only mode removed by user request */}
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-gray-300">Modo</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => updateSetting('overlayMode', 'minimal')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${settings.overlayMode === 'minimal'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-black/30 text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        Minimalista
                                    </button>
                                    <button
                                        onClick={() => updateSetting('overlayMode', 'full')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${settings.overlayMode === 'full'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-black/30 text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        Completo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Position ── */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Posição do Overlay
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <PositionButton pos="top-left" label="↖ Superior Esq." />
                            <PositionButton pos="top-right" label="↗ Superior Dir." />
                            <PositionButton pos="bottom-left" label="↙ Inferior Esq." />
                            <PositionButton pos="bottom-right" label="↘ Inferior Dir." />
                        </div>
                    </div>

                    {/* ── Metrics Toggles ── */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <FaTachometerAlt size={12} /> Métricas
                        </h3>
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                            <Toggle value={settings.showFps} onChange={(v) => updateSetting('showFps', v)} label="FPS" icon={FaTachometerAlt} />
                            <Toggle value={settings.showCpu} onChange={(v) => updateSetting('showCpu', v)} label="CPU" icon={FaMicrochip} />
                            <Toggle value={settings.showGpu} onChange={(v) => updateSetting('showGpu', v)} label="GPU" icon={FaDesktop} />
                            <Toggle value={settings.showRam} onChange={(v) => updateSetting('showRam', v)} label="RAM" icon={FaMemory} />
                            <Toggle value={settings.showDisk} onChange={(v) => updateSetting('showDisk', v)} label="Armazenamento" icon={FaHdd} />
                        </div>
                    </div>

                    {/* ── Process Selection ── */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <FaDesktop size={12} /> Processo
                            </h3>
                            <button
                                onClick={fetchProcesses}
                                className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                            >
                                {loadingProcesses ? 'Carregando...' : 'Atualizar'}
                            </button>
                        </div>
                        <div className="bg-black/20 rounded-xl border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                            {processList.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    {loadingProcesses ? 'Buscando processos...' : 'Nenhum processo encontrado'}
                                </div>
                            ) : (
                                processList.map((proc, i) => (
                                    <button
                                        key={`${proc.pid}-${i}`}
                                        onClick={() => setSelectedProcess(proc)}
                                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all border-b border-white/5 last:border-0 ${selectedProcess?.pid === proc.pid
                                            ? 'bg-purple-600/20 text-purple-300'
                                            : 'text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        <FaDesktop size={12} className="flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold truncate">{proc.title || proc.name}</div>
                                            <div className="text-[10px] opacity-50">{proc.name} • PID: {proc.pid}</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-black/20 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-1 py-3 px-4 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <FaSync className="animate-spin" /> : <FaSave />}
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameSettingsModal;
