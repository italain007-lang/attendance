/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f9', 100: '#d5def0', 500: '#1e3a6e', 600: '#17305c', 700: '#102447', 900: '#0a1730' },
        present: '#16a34a',
        absent: '#dc2626',
        late: '#ea580c',
        excused: '#2563eb',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
