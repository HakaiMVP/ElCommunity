import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FaBan, FaSignOutAlt, FaCalendarAlt, FaAlignLeft } from 'react-icons/fa';

const BannedScreen = () => {
    const { banInfo, signOut } = useAuth();

    // Fallback info if banInfo is somehow missing but isBanned is true
    const reason = banInfo?.reason || "Nenhum motivo fornecido.";
    const expiresAt = banInfo?.expires_at
        ? new Date(banInfo.expires_at).toLocaleString('pt-BR')
        : "Permanente";

    return (
        <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0f] p-4 text-white font-sans overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.08)_0%,transparent_70%)] animate-pulse" />
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-900/10 rounded-full blur-[120px] animate-pulse delay-1000" />

            <div className="max-w-lg w-full bg-[#12131a]/80 backdrop-blur-xl rounded-[2.5rem] border border-red-500/20 shadow-[0_40px_100px_-20px_rgba(220,38,38,0.2)] overflow-hidden relative animate-fade-in-up">
                {/* Top red line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent shadow-[0_0_15px_rgba(220,38,38,0.5)]" />

                <div className="p-10 relative z-10 flex flex-col items-center text-center">
                    <div className="relative group mb-8">
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
                        <div className="w-28 h-28 bg-[#0a0a0f] border-2 border-red-500/40 rounded-full flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-110">
                            <FaBan className="text-6xl text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce-slow" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase italic">Conta <span className="text-red-600">Suspensa</span></h1>
                    <p className="text-gray-400 mb-10 max-w-sm font-medium leading-relaxed">
                        Seu acesso foi revogado por uma violação direta dos termos de conduta da <span className="text-white font-bold">ElCommunity</span>.
                    </p>

                    <div className="w-full space-y-4 mb-10">
                        <div className="bg-white/[0.03] rounded-3xl p-6 border border-white/5 text-left group hover:border-red-500/30 transition-all duration-300">
                            <span className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></div>
                                Motivo da Punição
                            </span>
                            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-gray-200 font-medium leading-relaxed italic text-[15px]">
                                "{reason}"
                            </div>
                        </div>

                        <div className="bg-white/[0.03] rounded-3xl p-6 border border-white/5 text-left group hover:border-red-500/30 transition-all duration-300">
                            <span className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                                Data de Expiração
                            </span>
                            <p className="text-xl font-black text-white bg-red-600/10 px-4 py-2 rounded-xl w-fit border border-red-500/20">
                                {expiresAt}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={signOut}
                        className="group relative w-full py-5 font-black rounded-2xl overflow-hidden transition-all active:scale-95 shadow-xl"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 group-hover:opacity-90 transition-opacity"></div>
                        <span className="relative flex items-center justify-center gap-3 text-white uppercase tracking-widest text-sm">
                            <FaSignOutAlt className="group-hover:-translate-x-1 transition-transform" /> Sair da Plataforma
                        </span>
                    </button>

                    <p className="text-[11px] text-gray-500 mt-8 font-medium italic opacity-60">
                        Acha que é um engano? Procure um administrador nos canais oficiais.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BannedScreen;
