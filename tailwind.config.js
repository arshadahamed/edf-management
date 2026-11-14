module.exports = {
  content: [
    './public/index.html',
    './public/login.html',
    './public/404.html',
    './public/about.html',
    './public/gallery.html',
    './public/js/landing-ngo.js',
    './public/js/landing-3d-ngo.js',
    './public/js/landing-i18n.js',
    './public/js/edf-lottie-icons.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5',
        'primary-dark': '#4338ca',
        secondary: '#10b981',
        accent: '#8b5cf6',
        danger: '#ef4444',
        success: '#10b981',
        emerald: {
          950: '#041c15',
          900: '#062c22',
          850: '#083529',
          800: '#0a3d30',
          700: '#0f5241',
          600: '#146b54',
          500: '#10b981',
          100: '#e6f7f2',
          50: '#f0fbf7'
        },
        amber: {
          450: '#d4af37',
          550: '#b8861c'
        },
        parchment: {
          DEFAULT: '#faf8f5',
          dark: '#f3eee3'
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Cinzel', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
      },
      aspectRatio: {
        '4/3': '4 / 3'
      },
      scale: {
        '108': '1.08'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        }
      }
    }
  }
};
