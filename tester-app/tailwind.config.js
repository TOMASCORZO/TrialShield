/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0a0a0a',
        darker: '#050505',
        primary: '#3b82f6',
        accent: '#f59e0b',
        danger: '#ef4444',
        success: '#10b981',
      }
    },
  },
  plugins: [],
}
