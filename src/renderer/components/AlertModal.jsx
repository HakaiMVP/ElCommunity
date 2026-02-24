import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

const AlertModal = ({ isOpen, onClose, type = 'info', title, message, autoClose = false, duration = 3000 }) => {
    if (!isOpen) return null;

    useEffect(() => {
        if (autoClose) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, autoClose, duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <FaCheckCircle className="text-4xl text-green-500" />;
            case 'error': return <FaExclamationCircle className="text-4xl text-red-500" />;
            default: return <FaInfoCircle className="text-4xl text-blue-500" />;
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return 'border-green-500/30 shadow-green-500/10';
            case 'error': return 'border-red-500/30 shadow-red-500/10';
            default: return 'border-blue-500/30 shadow-blue-500/10';
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return 'bg-green-500/10';
            case 'error': return 'bg-red-500/10';
            default: return 'bg-blue-500/10';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                className={`bg-[#1e2029] border ${getColor()} rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-scale-in relative`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <FaTimes />
                </button>

                <div className="p-8 text-center flex flex-col items-center">
                    <div className={`w-20 h-20 ${getBgColor()} rounded-full flex items-center justify-center mb-6 animate-pulse`}>
                        {getIcon()}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        {message}
                    </p>

                    <button
                        onClick={onClose}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] ${type === 'success' ? 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20' :
                                type === 'error' ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' :
                                    'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                            }`}
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
