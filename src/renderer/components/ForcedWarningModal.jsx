import React from 'react';
import { createPortal } from 'react-dom';
import { FaExclamationTriangle } from 'react-icons/fa';

const ForcedWarningModal = ({ warning, onAcknowledge }) => {
    if (!warning) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e1f2b] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-red-500/30 flex flex-col relative animate-fade-in-up">
                {/* Header Pattern */}
                <div className="h-2 w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500"></div>

                <div className="p-8 pb-6 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <FaExclamationTriangle className="text-red-500 text-4xl" />
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">Aviso da Moderação</h2>
                    <p className="text-gray-400 font-medium mb-6">Você recebeu um novo alerta em sua conta.</p>

                    <div className="w-full bg-[#161721] p-5 rounded-2xl border border-white/5 text-left mb-8 shadow-inner">
                        <p className="text-xs text-red-400 font-bold uppercase tracking-widest mb-2">Motivo</p>
                        <p className="text-gray-200 text-sm whitespace-pre-wrap">{warning.reason}</p>
                    </div>

                    <button
                        onClick={() => onAcknowledge(warning.id)}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/40 transition-all uppercase tracking-widest text-sm"
                    >
                        Eu Entendi
                    </button>
                    <p className="text-xs text-gray-500 mt-4 italic">
                        O acúmulo de alertas pode resultar no banimento permanente da sua conta.
                    </p>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ForcedWarningModal;
