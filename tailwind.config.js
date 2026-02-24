/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                discord: {
                    bg: '#313338',       // Modern Discord dark background
                    dark: '#2b2d31',     // Sidebar/Panels
                    darker: '#1e1f22',   // Deeper background (channel list)
                    light: '#f2f3f5',
                    primary: '#5865F2',  // Blurple
                    primaryHover: '#4752c4',
                    secondary: '#4e5058',
                    input: '#1e1f22',    // Input background
                    text: {
                        normal: '#dbdee1',
                        muted: '#949ba4',
                        header: '#f2f3f5',
                    },
                    green: '#23a559',
                    red: '#da373c',
                    link: '#00a8fc',
                }
            },
            backgroundImage: {
                'login-pattern': "url('https://discord.com/assets/f9e7943f65586616428c.png')", // We can use a similar subtle pattern or color
            },
            fontFamily: {
                sans: ['"gg sans"', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
            },
            keyframes: {
                'slide-up': {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'scale-in': {
                    '0%': { transform: 'scale(0.9)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                }
            },
            animation: {
                'slide-up': 'slide-up 0.3s ease-out forwards',
                'fade-in': 'fade-in 0.2s ease-out forwards',
                'scale-in': 'scale-in 0.2s ease-out forwards',
            }
        },
    },
    plugins: [],
}
