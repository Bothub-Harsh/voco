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
        // Refined zinc mapping for dark mode:
        // 950 = Card background (#111318)
        // 900 = Secondary surface / inner containers (#191C23)
        // 850 = Dividers (#292E38)
        // 800 = Visible borders (#303541)
        // 700 = Hover border / secondary border (#424958)
        // 400 = Secondary text (#AAB2C0)
        // 100 = Primary dark text (#F5F6FA)
        zinc: {
          50: '#FAFAFD',
          100: '#F5F6FA',
          200: '#E2E6EE',
          300: '#CCD2DE',
          400: '#AAB2C0',
          500: '#7E889B',
          600: '#586174',
          700: '#424958',
          800: '#303541',
          850: '#292E38',
          900: '#191C23',
          950: '#111318',
        },
        dark: {
          bg: '#000000',
          card: '#111318',
          surface: '#191C23',
          border: '#303541',
          divider: '#292E38',
          text: '#F5F6FA',
          muted: '#AAB2C0',
          accent: '#6554F5',
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
