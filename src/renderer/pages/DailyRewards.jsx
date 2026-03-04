import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { allItems } from '../data/storeItems';
import AlertModal from '../components/AlertModal';
import { FaGift, FaStar, FaCheck, FaLock, FaClock, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// Get today's date in Brasilia time (UTC-3)
const getBrasiliaDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
};

// Get time remaining until midnight Brasilia
const getTimeUntilMidnight = () => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const midnight = new Date(brasiliaTime);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - brasiliaTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { hours, minutes, seconds };
};

const DAYS_PER_PAGE = 14;

const DailyRewards = () => {
    const { user, userProfile, refreshProfile } = useAuth();
    const [rewards, setRewards] = useState([]); // Config for each day
    const [claims, setClaims] = useState([]); // User's all claims
    const [startDate, setStartDate] = useState(null); // User's day-1 date
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [countdown, setCountdown] = useState(getTimeUntilMidnight());
    const [page, setPage] = useState(0);
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const todayDate = getBrasiliaDate();

    const showAlert = (type, title, message) => {
        setAlertState({ isOpen: true, type, title, message });
    };

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(getTimeUntilMidnight());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Calculate current day number (1-90) based on user's start date
    const getCurrentDayNumber = useCallback(() => {
        if (!startDate) return 1;
        const start = new Date(startDate + 'T00:00:00');
        const today = new Date(todayDate + 'T00:00:00');
        const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
        // Cycle: if past 90, wrap around
        if (diffDays > 90) return ((diffDays - 1) % 90) + 1;
        if (diffDays < 1) return 1;
        return diffDays;
    }, [startDate, todayDate]);

    // Fetch rewards config and user claims
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch config
            const { data: configData } = await supabase
                .from('daily_rewards_config')
                .select('*')
                .order('day_number', { ascending: true });

            // Fetch user claims
            const { data: claimsData } = await supabase
                .from('daily_rewards_claims')
                .select('*')
                .eq('user_id', user.id)
                .order('claim_date', { ascending: true });

            setRewards(configData || []);
            setClaims(claimsData || []);

            // Determine start date: the earliest claim_date minus (day_number - 1) days
            // Or if no claims, today is day 1
            if (claimsData && claimsData.length > 0) {
                const firstClaim = claimsData[0];
                const firstDate = new Date(firstClaim.claim_date + 'T00:00:00');
                firstDate.setDate(firstDate.getDate() - (firstClaim.day_number - 1));
                setStartDate(firstDate.toISOString().split('T')[0]);
            } else {
                setStartDate(todayDate);
            }
        } catch (err) {
            console.error('Error fetching daily rewards:', err);
        } finally {
            setLoading(false);
        }
    }, [user, todayDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const currentDayNumber = getCurrentDayNumber();

    // Auto-scroll to current day's page
    useEffect(() => {
        if (!loading && currentDayNumber > 0) {
            setPage(Math.floor((currentDayNumber - 1) / DAYS_PER_PAGE));
        }
    }, [loading, currentDayNumber]);

    // Claim today's reward
    const handleClaim = async () => {
        if (!user || claiming) return;
        setClaiming(true);
        try {
            const todayReward = rewards.find(r => r.day_number === currentDayNumber);
            if (!todayReward) {
                showAlert('error', 'Erro', 'Nenhuma recompensa configurada para o dia de hoje.');
                setClaiming(false);
                return;
            }

            // Check if already claimed today
            const alreadyClaimed = claims.some(c => c.claim_date === todayDate);
            if (alreadyClaimed) {
                showAlert('info', 'Já Reivindicado', 'Você já reivindicou a recompensa de hoje!');
                setClaiming(false);
                return;
            }

            // Insert claim
            const { error: claimError } = await supabase
                .from('daily_rewards_claims')
                .insert({
                    user_id: user.id,
                    claim_date: todayDate,
                    day_number: currentDayNumber,
                    reward_type: todayReward.reward_type,
                    reward_value: todayReward.reward_value
                });

            if (claimError) {
                if (claimError.code === '23505') {
                    showAlert('info', 'Já Reivindicado', 'Você já reivindicou a recompensa de hoje!');
                    setClaiming(false);
                    return;
                }
                throw claimError;
            }

            // Grant the reward
            if (todayReward.reward_type === 'stars') {
                const starsAmount = parseInt(todayReward.reward_value, 10) || 0;
                const currentStars = userProfile?.stars ?? 0;
                const { error: starsError } = await supabase
                    .from('profiles')
                    .update({ stars: currentStars + starsAmount })
                    .eq('id', user.id);
                if (starsError) throw starsError;
            } else if (todayReward.reward_type === 'item') {
                const { data: existingItem } = await supabase
                    .from('user_items')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('item_id', todayReward.reward_value)
                    .single();

                if (!existingItem) {
                    const itemDef = allItems.find(i => i.id === todayReward.reward_value);
                    const { error: itemError } = await supabase
                        .from('user_items')
                        .insert({
                            user_id: user.id,
                            item_id: todayReward.reward_value,
                            item_type: itemDef?.type || 'unknown'
                        });
                    if (itemError) throw itemError;
                }
            }

            await refreshProfile();
            await fetchData();
            showAlert('success', '🎉 Recompensa Reivindicada!', `Você recebeu: ${todayReward.reward_label}`);
        } catch (err) {
            console.error('Error claiming reward:', err);
            showAlert('error', 'Erro', 'Não foi possível reivindicar. Tente novamente.');
        } finally {
            setClaiming(false);
        }
    };

    // Determine card state for each day number
    const getCardState = (dayNum) => {
        const isClaimed = claims.some(c => c.day_number === dayNum);
        if (dayNum === currentDayNumber) {
            const todayClaimed = claims.some(c => c.claim_date === todayDate);
            return todayClaimed ? 'claimed' : 'available';
        } else if (dayNum < currentDayNumber) {
            return isClaimed ? 'claimed' : 'expired';
        } else {
            return 'locked';
        }
    };

    const getRewardForDay = (dayNum) => rewards.find(r => r.day_number === dayNum);

    const getRewardIcon = (reward) => {
        if (!reward) return <FaGift className="text-xl" />;
        if (reward.reward_type === 'stars') return <FaStar className="text-xl text-yellow-400" />;
        const item = allItems.find(i => i.id === reward.reward_value);
        return item?.icon ? <span className="text-xl">{item.icon}</span> : <FaGift className="text-xl text-purple-400" />;
    };

    // Get item background image if reward is a store item
    const getItemImage = (reward) => {
        if (!reward || reward.reward_type !== 'item') return null;
        const item = allItems.find(i => i.id === reward.reward_value);
        return item?.backgroundImage || null;
    };

    // Page calculations
    const totalPages = Math.ceil(90 / DAYS_PER_PAGE);
    const startDay = page * DAYS_PER_PAGE + 1;
    const endDay = Math.min(startDay + DAYS_PER_PAGE - 1, 90);

    return (
        <div className="min-h-full p-6 text-white relative flex flex-col gap-6 pb-32 max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-black tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500">
                        Recompensas Diárias
                    </span>
                </h1>
                <p className="text-gray-400 mt-1 text-sm">
                    Dia <span className="text-white font-bold">{currentDayNumber}</span> de <span className="text-white font-bold">90</span> — Volte todo dia para reivindicar!
                </p>

                {/* Countdown */}
                <div className="mt-3 inline-flex items-center gap-2 bg-[#1e1f2b] border border-white/10 rounded-2xl px-5 py-2 shadow-xl">
                    <FaClock className="text-orange-400 text-sm" />
                    <span className="text-gray-400 text-xs">Reseta em:</span>
                    <span className="text-white font-mono font-bold text-sm tabular-nums">
                        {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Progress Bar */}
            {!loading && (
                <div className="bg-[#1e1f2b]/50 rounded-2xl border border-white/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">Progresso</span>
                        <span className="text-xs text-gray-400">
                            <span className="text-purple-400 font-bold">{claims.length}</span> / 90 dias reivindicados
                        </span>
                    </div>
                    <div className="w-full h-2 bg-[#0b0c15] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${(claims.length / 90) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Calendar Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-2 bg-[#1e1f2b] border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <FaChevronLeft className="text-xs" /> Anterior
                        </button>
                        <span className="text-sm text-gray-400">
                            Dias <span className="text-white font-bold">{startDay}</span> – <span className="text-white font-bold">{endDay}</span>
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-2 bg-[#1e1f2b] border border-white/10 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            Próximo <FaChevronRight className="text-xs" />
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-7 gap-2.5">
                        {Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i).map(dayNum => {
                            const state = getCardState(dayNum);
                            const reward = getRewardForDay(dayNum);
                            const isToday = dayNum === currentDayNumber;
                            const itemImage = getItemImage(reward);

                            return (
                                <div
                                    key={dayNum}
                                    className={`relative flex flex-col items-center rounded-xl border p-3 transition-all duration-300 overflow-hidden ${isToday
                                        ? state === 'claimed'
                                            ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10'
                                            : 'bg-gradient-to-b from-purple-600/20 to-purple-900/10 border-purple-500/40 shadow-lg shadow-purple-500/20 scale-105'
                                        : state === 'claimed'
                                            ? 'bg-green-500/5 border-green-500/20'
                                            : state === 'expired'
                                                ? 'bg-red-500/5 border-red-500/10 opacity-40'
                                                : 'bg-[#1e1f2b]/50 border-white/5 opacity-50'
                                        }`}
                                >
                                    {/* Item background image */}
                                    {itemImage && state !== 'claimed' && state !== 'expired' && (
                                        <div className="absolute inset-0 z-0">
                                            <img src={itemImage} alt="" className="w-full h-full object-cover opacity-50" />
                                            {/* Stronger bottom gradient to protect the label text */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c15] via-transparent to-[#0b0c15]/40" />
                                        </div>
                                    )}

                                    {/* Today indicator */}
                                    {isToday && (
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                                            <span className="bg-purple-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                                                Hoje
                                            </span>
                                        </div>
                                    )}

                                    {/* Day number */}
                                    <span className={`relative z-10 text-[10px] font-bold mb-2 ${isToday ? 'text-purple-300' : 'text-gray-500'}`}>
                                        Dia {dayNum}
                                    </span>

                                    {/* Reward icon area — hide when item has a background image */}
                                    {(state === 'claimed' || state === 'expired' || !itemImage) && (
                                        <div className={`relative z-10 w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${state === 'claimed'
                                            ? 'bg-green-500/20'
                                            : state === 'available'
                                                ? 'bg-purple-500/20 animate-pulse'
                                                : state === 'expired'
                                                    ? 'bg-red-500/10'
                                                    : 'bg-white/5'
                                            }`}>
                                            {state === 'claimed' ? (
                                                <FaCheck className="text-base text-green-400" />
                                            ) : state === 'expired' ? (
                                                <FaLock className="text-sm text-red-400/50" />
                                            ) : state === 'locked' ? (
                                                <FaLock className="text-sm text-gray-600" />
                                            ) : (
                                                getRewardIcon(reward)
                                            )}
                                        </div>
                                    )}

                                    {/* Reward label */}
                                    <span className={`relative z-10 text-[10px] font-bold text-center leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${state === 'claimed'
                                            ? 'text-green-400'
                                            : state === 'expired'
                                                ? 'text-red-400/60'
                                                : isToday
                                                    ? 'text-white'
                                                    : 'text-gray-300'
                                        }`}>
                                        {reward?.reward_label || '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Claim Button */}
            {!loading && (() => {
                const todayState = getCardState(currentDayNumber);
                const todayReward = getRewardForDay(currentDayNumber);
                if (todayState === 'available' && todayReward) {
                    return (
                        <div className="flex flex-col items-center gap-3 mt-2">
                            <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                            >
                                {claiming ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Reivindicando...
                                    </>
                                ) : (
                                    <>
                                        <FaGift className="text-xl" />
                                        Reivindicar Dia {currentDayNumber} — {todayReward.reward_label}
                                    </>
                                )}
                            </button>
                            <p className="text-gray-500 text-xs">Não perca sua recompensa de hoje!</p>
                        </div>
                    );
                } else if (todayState === 'claimed') {
                    return (
                        <div className="text-center mt-2">
                            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-3">
                                <FaCheck className="text-green-400" />
                                <span className="text-green-400 font-bold text-sm">Recompensa do dia {currentDayNumber} já reivindicada!</span>
                            </div>
                            <p className="text-gray-500 text-xs mt-2">Volte amanhã para mais recompensas.</p>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Info Section */}
            <div className="mt-4 bg-[#1e1f2b]/50 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <FaGift className="text-purple-400" /> Como Funciona
                </h3>
                <ul className="text-xs text-gray-400 space-y-2">
                    <li>• São <span className="text-white font-medium">90 dias</span> de recompensas únicas</li>
                    <li>• As recompensas <span className="text-orange-400 font-medium">resetam à meia-noite</span> (horário de Brasília)</li>
                    <li>• Se não reivindicar antes da meia-noite, a recompensa é <span className="text-red-400 font-medium">perdida</span></li>
                    <li>• Quanto mais dias seguidos, <span className="text-yellow-400 font-medium">maiores as recompensas!</span></li>
                    <li>• Após os 90 dias o ciclo <span className="text-purple-400 font-medium">recomeça</span></li>
                </ul>
            </div>

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

export default DailyRewards;
