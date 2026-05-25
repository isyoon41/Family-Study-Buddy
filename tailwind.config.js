/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-8px)' },
          '80%': { transform: 'translateX(8px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
          '50%':       { transform: 'translateY(-6px)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
        },
        sparkle: {
          '0%, 100%': { transform: 'scale(1)',    opacity: '1' },
          '50%':       { transform: 'scale(1.2)', opacity: '0.8' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0px rgba(59,130,246,0)' },
          '50%':       { boxShadow: '0 0 20px rgba(59,130,246,0.5)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '70%':  { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        'celebrate': {
          '0%':   { transform: 'scale(1) rotate(0deg)' },
          '25%':  { transform: 'scale(1.15) rotate(-3deg)' },
          '50%':  { transform: 'scale(1.2) rotate(3deg)' },
          '75%':  { transform: 'scale(1.1) rotate(-2deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        'flame': {
          '0%, 100%': { transform: 'scaleY(1) rotate(-2deg)' },
          '50%':       { transform: 'scaleY(1.1) rotate(2deg)' },
        },
      },
      animation: {
        shake:        'shake 0.5s ease-in-out',
        float:        'float 3s ease-in-out infinite',
        'bounce-soft':'bounce-soft 2s ease-in-out infinite',
        sparkle:      'sparkle 1.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up':   'slide-up 0.4s ease-out forwards',
        'pop-in':     'pop-in 0.4s ease-out forwards',
        celebrate:    'celebrate 0.5s ease-in-out',
        flame:        'flame 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
