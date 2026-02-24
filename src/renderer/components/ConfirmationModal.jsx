import React, { useEffect } from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

/**
 * A reusable modal for confirming dangerous actions.
 * 
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Function to close the modal
 * @param {function} onConfirm - Function to call when confirmed
 * @param {string} title - Modal title (default: "Confirmar Ação")
 * @param {string} message - Modal message (default: "Tem certeza?")
 * @param {string} confirmText - Text for confirm button (default: "Confirmar")
 * @param {string} cancelText - Text for cancel button (default: "Cancelar")
 * @param {string} confirmColor - Color class for confirm button (default: "bg-red-600 hover:bg-red-700")
 * @param {boolean} loading - Loading state for confirm button
 */
const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirmar Ação",
    message = "Tem certeza que deseja prosseguir com esta ação? Esta operação não pode ser desfeita.",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    confirmColor = "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    loading = false
}) => {
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (isOpen && e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="p-6 pb-0 flex items-start gap-4">
                    <div className="bg-red-900/30 p-3 rounded-full shrink-0 flex items-center justify-center">
                        <FaExclamationTriangle className="text-red-500 text-xl" />
                    </div>
                    <div className="flex-1">
                        <h3 id="modal-title" className="text-xl font-bold text-white mb-2">
                            {title}
                        </h3>
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 flex justify-end gap-3 mt-4 bg-gray-900/50 border-t border-gray-700/50">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`px-5 py-2 rounded-lg text-white font-bold shadow-lg transition-all focus:outline-none focus:ring-2 ${confirmColor} ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Processando...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
