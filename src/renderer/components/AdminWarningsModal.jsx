import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FaTimes, FaExclamationTriangle, FaTrash, FaEdit, FaSave } from 'react-icons/fa';
import AlertModal from './AlertModal';
import ConfirmationModal from './ConfirmationModal';
import { COMMUNITY_RULES } from '../constants/communityRules';

const AdminWarningsModal = ({ isOpen, onClose, user }) => {
    const { user: currentUser } = useAuth();
    const [warnings, setWarnings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // New Alert State
    const [newAlertReason, setNewAlertReason] = useState('');

    // Edit State
    const [editingWarningId, setEditingWarningId] = useState(null);
    const [editReason, setEditReason] = useState('');

    // Modal states
    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        if (isOpen && user?.id) {
            fetchWarnings();
        }
    }, [isOpen, user]);

    const showAlert = (type, title, message) => setAlertState({ isOpen: true, type, title, message });
    const showConfirm = (title, message, onConfirm) => setConfirmState({ isOpen: true, title, message, onConfirm });

    const fetchWarnings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_warnings')
                .select('*, admin:admin_id(username)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setWarnings(data || []);
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao carregar alertas: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyAlert = async () => {
        if (!newAlertReason.trim()) return showAlert('info', 'Atenção', 'Digite o motivo do alerta.');
        setActionLoading(true);
        try {
            // 1. Aplicar o alerta
            const { error: alertError } = await supabase.from('user_warnings').insert({
                user_id: user.id,
                admin_id: currentUser.id,
                reason: newAlertReason.trim()
            });
            if (alertError) throw alertError;

            // 2. Buscar contagem atualizada de alertas ativos para checar gatilhos
            const { data: currentWarnings, error: countError } = await supabase
                .from('user_warnings')
                .select('id')
                .eq('user_id', user.id);

            if (countError) throw countError;
            const alertCount = currentWarnings.length;

            // 3. Lógica de Banimento Progressivo
            let banDuration = null;
            let banLabel = "";

            if (alertCount === 5) { banDuration = 3; banLabel = "3 dias"; }
            else if (alertCount === 7) { banDuration = 30; banLabel = "30 dias"; }
            else if (alertCount === 10) { banDuration = 90; banLabel = "90 dias"; }
            else if (alertCount >= 11) { banDuration = 'permanent'; banLabel = "Permanente"; }

            if (banDuration) {
                console.log(`[Moderation] Threshold met (${alertCount} alerts). Applying automatic ban: ${banLabel}`);

                let expiresAt = null;
                if (banDuration !== 'permanent') {
                    const date = new Date();
                    date.setDate(date.getDate() + banDuration);
                    expiresAt = date.toISOString();
                }

                // Inserir registro de banimento
                const { error: banError } = await supabase.from('user_bans').insert({
                    user_id: user.id,
                    admin_id: currentUser.id, // O admin que deu o alerta que gatilhou
                    reason: `Banimento Automático: Acúmulo de ${alertCount} alertas.`,
                    expires_at: expiresAt
                });

                if (banError) throw banError;

                // Atualizar status do perfil (opcional, dependendo de como o AuthContext checa)
                await supabase.from('profiles').update({ status: 'banned' }).eq('id', user.id);

                showAlert('warning', 'Sistema de Tolerância', `O usuário atingiu ${alertCount} alertas e foi banido automaticamente por: ${banLabel}.`);
            } else {
                showAlert('success', 'Sucesso', 'Alerta aplicado com sucesso!');
            }

            setNewAlertReason('');
            fetchWarnings();
        } catch (error) {
            console.error('[Admin] Error applying alert/automatic ban:', error);
            showAlert('error', 'Erro', 'Erro ao aplicar alerta/banimento: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteWarning = (warningId) => {
        showConfirm('Perdoar Alerta', 'Tem certeza que deseja perdoar/excluir este alerta?', async () => {
            try {
                const { error } = await supabase.from('user_warnings').delete().eq('id', warningId);
                if (error) throw error;
                fetchWarnings();
                showAlert('success', 'Sucesso', 'Alerta perdoado com sucesso!');
            } catch (error) {
                showAlert('error', 'Erro', 'Erro ao excluir alerta: ' + error.message);
            }
        });
    };

    const handleStartEdit = (warning) => {
        setEditingWarningId(warning.id);
        setEditReason(warning.reason);
    };

    const handleSaveEdit = async (warningId) => {
        if (!editReason.trim()) return showAlert('info', 'Atenção', 'O motivo não pode estar vazio.');
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('user_warnings')
                .update({ reason: editReason.trim() })
                .eq('id', warningId);
            if (error) throw error;
            setEditingWarningId(null);
            fetchWarnings();
            showAlert('success', 'Sucesso', 'Alerta atualizado com sucesso!');
        } catch (error) {
            showAlert('error', 'Erro', 'Erro ao atualizar alerta: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1e1f2b] w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1e1f2b] sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <FaExclamationTriangle className="text-yellow-500" /> Alertas do Usuário
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">Gerenciando: <span className="text-purple-400 font-bold">{user.username}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all">
                        <FaTimes />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {/* Apply new alert section */}
                    <div className="bg-black/20 p-5 rounded-2xl border border-white/5 text-left">
                        <h4 className="text-sm font-bold text-gray-300 uppercase mb-3">Aplicar Novo Alerta</h4>

                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Infração (Regras)</label>
                        <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white outline-none focus:border-yellow-500 mb-3 text-sm"
                            onChange={(e) => {
                                const rule = COMMUNITY_RULES.find(r => r.id === parseInt(e.target.value));
                                if (rule) setNewAlertReason(`Regra #${rule.id}: ${rule.title} - ${rule.description}`);
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>Selecione uma regra (opcional)...</option>
                            {COMMUNITY_RULES.map(rule => (
                                <option key={rule.id} value={rule.id}>#{rule.id} - {rule.title}</option>
                            ))}
                        </select>

                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo Detalhado / Personalizado</label>
                        <textarea
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-yellow-500 min-h-[80px] mb-3 text-sm"
                            placeholder="Descreva o motivo da infração..."
                            value={newAlertReason}
                            onChange={(e) => setNewAlertReason(e.target.value)}
                        />
                        <button
                            onClick={handleApplyAlert}
                            disabled={actionLoading || !newAlertReason.trim()}
                            className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Aplicar Alerta
                        </button>
                    </div>

                    {/* History */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-300 uppercase mb-4 flex items-center justify-between">
                            Histórico de Alertas ({warnings.length})
                            <span className="text-[10px] bg-red-500/10 text-red-500 px-3 py-1 rounded-lg border border-red-500/20 normal-case font-medium">
                                5 alertas = Banimento
                            </span>
                        </h4>

                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Carregando alertas...</div>
                        ) : warnings.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 bg-black/20 rounded-2xl border border-white/5">Nenhum alerta registrado.</div>
                        ) : (
                            <div className="space-y-3">
                                {warnings.map(warning => (
                                    <div key={warning.id} className="bg-black/30 p-4 rounded-xl border border-red-500/20 text-left">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-mono bg-black/50 px-2 py-1 rounded">
                                                    {new Date(warning.created_at).toLocaleString('pt-BR')}
                                                </span>
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${warning.acknowledged ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                                    {warning.acknowledged ? 'Lido' : 'Não Lido'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                {editingWarningId !== warning.id && (
                                                    <button
                                                        onClick={() => handleStartEdit(warning)}
                                                        className="text-gray-400 hover:text-blue-400 p-1.5 hover:bg-white/5 rounded transition-all"
                                                        title="Editar Alerta"
                                                    >
                                                        <FaEdit size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteWarning(warning.id)}
                                                    className="text-gray-400 hover:text-red-400 p-1.5 hover:bg-white/5 rounded transition-all"
                                                    title="Perdoar Alerta"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {editingWarningId === warning.id ? (
                                            <div className="mt-2 space-y-2">
                                                <textarea
                                                    className="w-full bg-black/50 border border-blue-500/30 rounded-xl p-3 text-white outline-none focus:border-blue-500 min-h-[80px] text-sm"
                                                    value={editReason}
                                                    onChange={(e) => setEditReason(e.target.value)}
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setEditingWarningId(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 rounded-lg">Cancelar</button>
                                                    <button onClick={() => handleSaveEdit(warning.id)} disabled={actionLoading} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1"><FaSave /> Salvar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-200 text-sm bg-black/50 p-3 rounded-lg whitespace-pre-wrap">{warning.reason}</p>
                                        )}

                                        <div className="mt-3 text-[10px] text-gray-500 text-right">
                                            Aplicado por: <span className="text-gray-400 font-bold">{warning.admin?.username || 'Sistema'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={() => {
                    confirmState.onConfirm();
                    setConfirmState({ ...confirmState, isOpen: false });
                }}
                title={confirmState.title}
                message={confirmState.message}
            />
        </div>
    );
};

export default AdminWarningsModal;
