import React from 'react';
import logoSrc from '../assets/icon-transparent.png'; // Vite bundler import

const Logo = ({ size = 120, className = "" }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <img
                src={logoSrc}
                alt="ElCommunity Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                className="drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            />

            {/* Subtle Glow Effect for visibility on dark backgrounds */}
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full -z-10 opacity-30"></div>
        </div>
    );
};

export default Logo;
