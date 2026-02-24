import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import AlertModal from '../components/AlertModal';

const Register = () => {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const [alertState, setAlertState] = useState({ isOpen: false, type: 'info', title: '', message: '', onClose: null });

    const showAlert = (type, title, message, onClose = null) => {
        setAlertState({ isOpen: true, type, title, message, onClose });
    };

    const handleSubmit = async (e) => {
        // ... existing submit logic ...
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signUp(email, password, username);
            showAlert('success', 'Cadastro Realizado', 'Registro realizado! Verifique seu email para confirmar.', () => {
                navigate('/'); // Redirect to login
            });
        } catch (err) {
            setError('Falha ao registrar: ' + (err.message || 'Tente novamente'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-bg flex items-center justify-center min-h-screen w-full relative">
            <div className="stars"></div>
            <div className="twinkling"></div>

            <div className="w-full max-w-[500px] p-10 glass-panel rounded-2xl z-50 flex flex-col animate-fade-in transition-all duration-300 relative">
                {/* Visual Flair - Glow orb */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-600 rounded-full mix-blend-screen filter blur-[80px] opacity-20 pointer-events-none"></div>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h2>
                    <p className="mt-2 text-gray-400">Comece sua jornada.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2 group">
                        <label className="text-xs font-bold text-purple-300 uppercase tracking-widest group-focus-within:text-purple-400 transition-colors">
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-lg input-glass focus:outline-none placeholder-gray-600 relative z-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2 group relative z-50">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-purple-300 uppercase tracking-widest group-focus-within:text-purple-400 transition-colors">
                                Nickname
                            </label>
                            <div className="relative group/tooltip">
                                <span className="cursor-help text-purple-400/70 hover:text-purple-300 text-xs border border-purple-400/50 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2 bg-black/90 border border-purple-500/30 rounded text-xs text-gray-300 shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none">
                                    Para identificar você, coloque o nome do seu personagem principal aqui (Isso é muito importante)
                                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-black/90"></div>
                                </div>
                            </div>
                        </div>

                        <input
                            type="text"
                            required
                            className="w-full p-3 rounded-lg input-glass focus:outline-none placeholder-gray-600 relative z-50"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2 group">
                        <label className="text-xs font-bold text-purple-300 uppercase tracking-widest group-focus-within:text-purple-400 transition-colors">
                            Senha
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full p-3 rounded-lg input-glass focus:outline-none placeholder-gray-600 relative z-50 pr-10"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-50 focus:outline-none"
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded text-sm text-center relative z-50">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 mt-4 font-bold text-white rounded-lg btn-space uppercase tracking-wide text-sm relative z-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Carregando...' : 'Cadastrar'}
                    </button>

                    <div className="mt-4 text-center">
                        <Link to="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Já tem uma conta?</Link>
                    </div>
                </form>
            </div>

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={() => {
                    setAlertState({ ...alertState, isOpen: false });
                    if (alertState.onClose) alertState.onClose();
                }}
                type={alertState.type}
                title={alertState.title}
                message={alertState.message}
            />
        </div >
    );
};

export default Register;
