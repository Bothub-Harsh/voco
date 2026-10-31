/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6554F5',
          600: '#5243E4',
          700: '#4334D0',
          800: '#372AB0',
          900: '#2E2290',
        },
        // Soft Charcoal Dark Mode palette:
        // 950 = Card background (#1B1D25)
        // 900 = Secondary surface / inner containers (#222530)
        // 850 = Dividers (#2A2E3C)
        // 800 = Visible borders (#30333E)
        // 700 = Hover border (#3C4050)
        // 500 = Muted text (#A5A8B5)
        // 400 = Secondary text (#8B8E9C)
        // 100 = Primary dark text (#F1F1F5)
        zinc: {
          50: '#FAFAFD',
          100: '#F1F1F5',
          200: '#E2E4EC',
          300: '#C8CADB',
          400: '#8B8E9C',
          500: '#A5A8B5',
          600: '#6B6E80',
          700: '#3C4050',
          800: '#30333E',
          850: '#2A2E3C',
          900: '#222530',
          950: '#1B1D25',
        },
        dark: {
          bg: '#121318',
          card: '#1B1D25',
          surface: '#222530',
          border: '#30333E',
          divider: '#2A2E3C',
          text: '#F1F1F5',
          muted: '#A5A8B5',
          accent: '#8875F5',
          success: '#28C995',
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'elevated': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
