import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Logo from '../components/Logo';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        // ... existing submit logic ...
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password, rememberMe);
            navigate('/dashboard'); // Redirect after login
        } catch (err) {
            setError('Falha ao entrar: ' + (err.message || 'Verifique suas credenciais'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-bg flex items-center justify-center min-h-screen w-full relative">
            {/* ... background elements ... */}
            <div className="stars"></div>
            <div className="twinkling"></div>

            <div className="w-full max-w-[850px] p-10 glass-panel rounded-2xl z-50 flex flex-col md:flex-row items-center animate-fade-in transition-all duration-300 relative overflow-hidden">
                {/* ... visual flair ... */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 pointer-events-none"></div>

                {/* Login Form Section */}
                <div className="flex-1 md:pr-12 w-full">
                    <div className="text-center md:text-left mb-8">
                        <h2 className="text-3xl font-bold text-white tracking-tight">Bem-vindo de volta!</h2>
                        <p className="mt-2 text-gray-400">Explore estratégias, troque itens e domine Elios.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2 group">
                            <label className="text-xs font-bold text-purple-300 uppercase tracking-widest group-focus-within:text-purple-400 transition-colors">
                                Email
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 rounded-lg input-glass focus:outline-none placeholder-gray-600 relative z-50"
                                placeholder="elsword@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                                    placeholder="••••••••••••"
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
                            <div className="flex justify-between items-center mt-2">
                                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
                                    <input
                                        type="checkbox"
                                        className="accent-purple-500 rounded border-white/10 bg-black/30"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    Manter conectado
                                </label>
                                <div className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium transition-colors">
                                    Esqueceu a senha?
                                </div>
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
                            className="w-full py-3 mt-2 font-bold text-white rounded-lg btn-space uppercase tracking-wide text-sm relative z-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>

                        <div className="mt-4 text-sm text-gray-400 text-center">
                            Novo na ElCommunity? <Link to="/register" className="text-purple-400 hover:text-purple-300 font-bold transition-colors">Criar Conta</Link>
                        </div>
                    </form>
                </div>

                {/* Decorative Side Panel for Desktop */}
                <div className="hidden md:flex flex-col items-center justify-center pl-12 border-l border-white/10 w-[300px] text-center">
                    <div className="mb-6 relative">
                        <Logo size={128} className="animate-pulse-slow" />
                        <div className="absolute inset-0 bg-white/10 blur-3xl opacity-20 animate-pulse pointer-events-none"></div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Conexão Infinita em Elios</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Sua jornada por Elios fica mais forte quando estamos em comunidade.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
