import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          500: '#2563eb',
          700: '#1d4ed8',
          950: '#172554',
        },
      },
    },
  },
  plugins: [],
};

export default config;
