/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Avenir Next', 'Helvetica Neue', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Cascadia Code', 'monospace'],
      },
      colors: {
        'anica-ink': '#11120d',
        'anica-paper': '#f2eddf',
        'anica-cream': '#fff8e6',
        'anica-lime': '#d8ff3e',
        'anica-signal': '#f15a24',
        'anica-steel': '#40535d',
        'anica-blue': '#1d4e89',
        'anica-line': '#d6cbb7',
      },
    },
  },
  plugins: [],
};
