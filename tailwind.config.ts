import type { Config } from 'tailwindcss';

// Warm, paper-and-earth palette with one vermilion accent. Separation comes from shifting
// between these background tones, not from borders and shadows.
const config: Config = {
  content: ['./src/app/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3EEE5',
        sand: '#E8DFCF',
        dune: '#D9CBB3',
        clay: '#B9A486',
        ink: { DEFAULT: '#1E1A15', 2: '#51493F', 3: '#8C8273' },
        accent: { DEFAULT: '#D8431A', soft: '#F2D3C2', deep: '#A93212' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-ui)', 'ui-sans-serif'],
      },
      letterSpacing: { eyebrow: '0.14em' },
    },
  },
  plugins: [],
};
export default config;
