import React from 'react';
import { FaTimes, FaExclamationTriangle, FaDoorOpen } from 'react-icons/fa';

const LeaveCommunityModal = ({ communityName, onClose, onConfirm, loading }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#1e2029] border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl scale-100 animate-scale-in">
                {/* Header */}
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <FaExclamationTriangle className="text-3xl text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Sair da Comunidade?</h2>
                    <p className="text-gray-400">
                        Você tem certeza que deseja sair de <strong className="text-white">{communityName}</strong>?
                        <br />
                        Você perderá o acesso a canais exclusivos e terá que solicitar entrada novamente se for uma comunidade privada.
                    </p>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                        {loading ? 'Saindo...' : <><FaDoorOpen /> Sair Agora</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeaveCommunityModal;
