/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffc9c9',
          300: '#ffa8a8',
          400: '#ff6b6b',
          500: '#fa5252',
          600: '#c5050c', // Wisconsin Red
          700: '#9b0409',
          800: '#7a0307',
          900: '#5c0205',
        },
        accent: {
          50: '#fbfaf8',
          100: '#f7f5f2', // Light Beige
          200: '#efebe4',
          300: '#e5e1d8', // Medium Beige
          400: '#d6d0c2',
          500: '#c2baaa',
          600: '#a39b8c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(20px, -50px) scale(1.1)' },
          '50%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '75%': { transform: 'translate(50px, 50px) scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      boxShadow: {
        'glow': '0 0 20px rgba(197, 5, 12, 0.4)',
        'glow-lg': '0 0 40px rgba(197, 5, 12, 0.3)',
      }
    },
  },
  plugins: [],
}

