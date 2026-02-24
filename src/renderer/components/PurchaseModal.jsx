import React, { useState, useEffect } from 'react';
import { FaStar, FaShoppingCart, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const PurchaseModal = ({ item, userStars = 0, onConfirm, onClose, isOpen }) => {
    const [step, setStep] = useState('confirm'); // confirm, processing, success, error
    const [paymentMethod, setPaymentMethod] = useState(null); // 'stars' or 'brl'
    const [errorMsg, setErrorMsg] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('confirm');
            setPaymentMethod(null);
            setErrorMsg('');
        }
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const handlePurchase = async (method) => {
        setPaymentMethod(method);

        if (method === 'stars') {
            const price = item.starsPrice || 0;
            if (userStars < price) {
                setStep('error');
                setErrorMsg(`Saldo insuficiente! Faltam ${(price - userStars).toLocaleString('pt-BR')} estrelas.`);
                return;
            }
        }

        setStep('processing');

        // Simulate API delay for better UX
        setTimeout(async () => {
            try {
                const success = await onConfirm(method);
                if (success) {
                    setStep('success');
                } else {
                    setStep('error');
                    setErrorMsg('Erro ao processar a compra. Tente novamente.');
                }
            } catch (err) {
                setStep('error');
                setErrorMsg(err.message || 'Erro desconhecido.');
            }
        }, 800);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className={`relative w-full max-w-md bg-[#1e1f2b] rounded-3xl border border-white/10 shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 ${step === 'error' ? 'animate-shake' : ''}`}>

                {/* Header Background */}
                <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${item.accentColor ? item.accentColor : 'from-purple-600 to-blue-600'} opacity-20`}></div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-colors z-20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className="relative p-8 pt-10 text-center z-10">

                    {/* CONFIRMATION STATE */}
                    {step === 'confirm' && (
                        <>
                            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-[#0f1016] border border-white/10 flex items-center justify-center shadow-lg relative group">
                                <div className={`absolute inset-0 bg-gradient-to-br ${item.accentColor} opacity-20 rounded-2xl`}></div>
                                {item.icon ? (
                                    <span className="text-5xl drop-shadow-md">{item.icon}</span>
                                ) : (
                                    <img src={item.mainImage} alt={item.title} className="w-16 h-16 object-contain drop-shadow" />
                                )}
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-2">{item.title}</h2>
                            <p className="text-gray-400 text-sm mb-8">Confirmar compra com estrelas?</p>

                            <div className="space-y-3">
                                {/* Pay with Stars */}
                                <button
                                    onClick={() => handlePurchase('stars')}
                                    className="w-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 hover:from-yellow-500/20 hover:to-orange-500/20 border border-yellow-500/30 hover:border-yellow-500/50 p-4 rounded-xl flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-400 group-hover:scale-110 transition-transform">
                                            <FaStar />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-yellow-400 text-sm">Usar Estrelas</p>
                                            <p className="text-xs text-yellow-500/60">Saldo: {userStars.toLocaleString()} ⭐</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-white flex items-center gap-1">
                                        {item.starsPrice ? item.starsPrice.toLocaleString() : 'N/A'} <FaStar className="text-xs text-yellow-400" />
                                    </span>
                                </button>

                            </div>
                        </>
                    )}

                    {/* PROCESSING STATE */}
                    {step === 'processing' && (
                        <div className="py-10">
                            <div className="w-16 h-16 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
                            <h3 className="text-xl font-bold text-white">Processando...</h3>
                            <p className="text-gray-400 text-sm mt-2">Só um momento, estamos preparando seu item.</p>
                        </div>
                    )}

                    {/* SUCCESS STATE */}
                    {step === 'success' && (
                        <div className="py-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                <FaCheckCircle className="text-4xl" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Compra Confirmada!</h3>
                            <p className="text-gray-400 text-sm mb-8">
                                O item <span className="text-white font-bold">{item.title}</span> foi adicionado ao seu inventário.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-colors"
                            >
                                Perfeito!
                            </button>
                        </div>
                    )}

                    {/* ERROR STATE */}
                    {step === 'error' && (
                        <div className="py-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                                {paymentMethod === 'stars' ? <FaStar className="text-4xl" /> : <FaExclamationTriangle className="text-4xl" />}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado.</h3>
                            <p className="text-gray-300 text-sm mb-8 px-4 leading-relaxed">
                                {errorMsg}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                {paymentMethod === 'stars' && (
                                    <button
                                        className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-xl shadow-lg transition-colors"
                                        onClick={() => alert("Redirecionar para compra de estrelas (Em breve)")}
                                    >
                                        Comprar Estrelas
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PurchaseModal;
