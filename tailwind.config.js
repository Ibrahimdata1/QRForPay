/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0066CC',
        secondary: '#00A651',
        accent: '#FF6B35',
        warning: '#FFC107',
        danger: '#DC3545',
        background: '#F5F7FA',
        surface: '#FFFFFF',
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B7280',
        'text-light': '#9CA3AF',
        border: '#E5E7EB',
      },
    },
  },
  plugins: [],
};
