/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dead or Alive brand palette
        blood: {
          50: '#fff0f0',
          100: '#ffe0e0',
          500: '#e53e3e',
          600: '#c53030',
          700: '#9b2c2c',
          900: '#63171b',
        },
        survival: {
          50: '#f0fff4',
          100: '#c6f6d5',
          500: '#38a169',
          600: '#2f855a',
          700: '#276749',
          900: '#1c4532',
        },
        void: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a26',
          600: '#242433',
        },
        neon: '#00ff88',
        ember: '#ff4500',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body: ['"Rajdhani"', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      animation: {
        'pulse-red': 'pulseRed 1s ease-in-out infinite',
        'pulse-green': 'pulseGreen 1s ease-in-out infinite',
        flicker: 'flicker 3s linear infinite',
        'door-shake': 'doorShake 0.5s ease-in-out',
        countdown: 'countdown 1s ease-in-out',
        'scan-line': 'scanLine 2s linear infinite',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(229, 62, 62, 0.4)' },
          '50%': { boxShadow: '0 0 0 20px rgba(229, 62, 62, 0)' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(56, 161, 105, 0.4)' },
          '50%': { boxShadow: '0 0 0 20px rgba(56, 161, 105, 0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.6' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.4' },
          '97%': { opacity: '1' },
        },
        doorShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        countdown: {
          '0%': { transform: 'scale(1.5)', opacity: '0' },
          '30%': { transform: 'scale(1)', opacity: '1' },
          '80%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
      backgroundImage: {
        'grid-void': 'linear-gradient(rgba(0,255,136,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-void': '40px 40px',
      },
    },
  },
  plugins: [],
};
