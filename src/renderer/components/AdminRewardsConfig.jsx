import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { allItems } from '../data/storeItems';
import { FaTimes, FaSave, FaStar, FaGift, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const DAYS_PER_PAGE = 10;

const AdminRewardsConfig = ({ isOpen, onClose }) => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(0);

    useEffect(() => {
        if (isOpen) fetchConfigs();
    }, [isOpen]);

    const fetchConfigs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('daily_rewards_config')
            .select('*')
            .order('day_number', { ascending: true });

        // Build full 90-day array, filling gaps with defaults
        const fullConfigs = Array.from({ length: 90 }, (_, i) => {
            const dayNum = i + 1;
            const existing = data?.find(d => d.day_number === dayNum);
            return existing || {
                day_number: dayNum,
                reward_type: 'stars',
                reward_value: '500',
                reward_label: '500 Estrelas'
            };
        });
        setConfigs(fullConfigs);
        setLoading(false);
    };

    const updateConfig = (dayNum, field, value) => {
        setConfigs(prev => prev.map(c => {
            if (c.day_number !== dayNum) return c;
            const updated = { ...c, [field]: value };

            // Auto-update label
            if (field === 'reward_type' || field === 'reward_value') {
                if (updated.reward_type === 'stars') {
                    updated.reward_label = `${parseInt(updated.reward_value, 10) || 0} Estrelas`;
                } else {
                    const item = allItems.find(i => i.id === updated.reward_value);
                    updated.reward_label = item?.title || updated.reward_value;
                }
            }
            return updated;
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Batch upsert all configs
            const upsertData = configs.map(c => ({
                day_number: c.day_number,
                reward_type: c.reward_type,
                reward_value: c.reward_value,
                reward_label: c.reward_label
            }));

            const { error } = await supabase
                .from('daily_rewards_config')
                .upsert(upsertData, { onConflict: 'day_number' });

            if (error) throw error;
            onClose();
        } catch (err) {
            console.error('Error saving config:', err);
            alert('Erro ao salvar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Batch set: apply same reward to a range of days
    const handleBatchSet = (type, value) => {
        const startDay = page * DAYS_PER_PAGE;
        const endDay = Math.min(startDay + DAYS_PER_PAGE, 90);
        setConfigs(prev => prev.map(c => {
            if (c.day_number - 1 >= startDay && c.day_number - 1 < endDay) {
                const label = type === 'stars'
                    ? `${parseInt(value, 10) || 0} Estrelas`
                    : (allItems.find(i => i.id === value)?.title || value);
                return { ...c, reward_type: type, reward_value: value, reward_label: label };
            }
            return c;
        }));
    };

    if (!isOpen) return null;

    const grantableItems = allItems.filter(i => i.type !== 'bundle');
    const totalPages = Math.ceil(90 / DAYS_PER_PAGE);
    const startDay = page * DAYS_PER_PAGE;
    const endDay = Math.min(startDay + DAYS_PER_PAGE, 90);
    const visibleConfigs = configs.slice(startDay, endDay);

    const modalContent = (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-2xl bg-[#1e1f2b] rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FaGift className="text-purple-400" /> Configurar Recompensas (90 Dias)
                        </h2>
                        <p className="text-gray-400 text-xs mt-1">Defina a recompensa para cada dia do ciclo.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                        <FaTimes />
                    </button>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-2 border-b border-white/5 bg-[#13141f]">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-2 py-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
                    >
                        <FaChevronLeft /> Anterior
                    </button>
                    <span className="text-xs text-gray-400">
                        Dias <span className="text-white font-bold">{startDay + 1}</span> – <span className="text-white font-bold">{endDay}</span> de 90
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-2 py-1 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 flex items-center gap-1"
                    >
                        Próximo <FaChevronRight />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-2">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">Carregando...</div>
                    ) : visibleConfigs.map(config => (
                        <div key={config.day_number} className="bg-[#13141f] rounded-xl border border-white/5 p-3 flex items-center gap-3">
                            {/* Day label */}
                            <div className="w-14 flex-shrink-0">
                                <span className="text-xs font-bold text-white">Dia {config.day_number}</span>
                            </div>

                            {/* Type selector */}
                            <select
                                value={config.reward_type}
                                onChange={(e) => {
                                    updateConfig(config.day_number, 'reward_type', e.target.value);
                                    if (e.target.value === 'stars') {
                                        updateConfig(config.day_number, 'reward_value', '500');
                                    } else {
                                        updateConfig(config.day_number, 'reward_value', grantableItems[0]?.id || '');
                                    }
                                }}
                                className="bg-[#0b0c15] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500/50 w-28"
                            >
                                <option value="stars">⭐ Estrelas</option>
                                <option value="item">🎁 Item</option>
                            </select>

                            {/* Value input */}
                            {config.reward_type === 'stars' ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                    <input
                                        type="number"
                                        min="1"
                                        value={config.reward_value}
                                        onChange={(e) => updateConfig(config.day_number, 'reward_value', e.target.value)}
                                        className="bg-[#0b0c15] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 w-24 focus:outline-none focus:border-yellow-500/50"
                                    />
                                    <FaStar className="text-yellow-400 text-xs" />
                                </div>
                            ) : (
                                <select
                                    value={config.reward_value}
                                    onChange={(e) => updateConfig(config.day_number, 'reward_value', e.target.value)}
                                    className="bg-[#0b0c15] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 flex-1 focus:outline-none focus:border-purple-500/50"
                                >
                                    {grantableItems.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.icon} {item.title}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Preview */}
                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">
                                {config.reward_label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-5 pt-3 border-t border-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold rounded-xl transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors text-sm flex items-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        <FaSave /> {saving ? 'Salvando...' : 'Salvar Tudo'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default AdminRewardsConfig;
