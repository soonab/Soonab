import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        teal: { DEFAULT: '#2F7A7B' },  // brand core
        sage: '#A8B9A0',
        offwhite: '#F8F8F6',
        ink: '#2F2F2F',
        line: '#E6E7E9',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',                 // matches mockup cards
      },
      boxShadow: {
        card: '0 2px 10px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
export default config;
