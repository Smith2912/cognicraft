/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1F1C2D',
        'dark-surface': '#2A263E',
        'dark-card': '#3B3753',
        'dark-border': '#4A4566',
        'dark-text-primary': '#E0DFFD',
        'dark-text-secondary': '#A09ECB',
        'dark-accent': '#7B61FF',
        'dark-accent-hover': '#937FFF',
      },
    },
  },
  plugins: [],
};
