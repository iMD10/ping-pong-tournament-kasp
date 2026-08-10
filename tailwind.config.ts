import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: rgb("--bg"),
        surface: rgb("--surface"),
        fg: rgb("--fg"),
        muted: rgb("--fg-muted"),
        subtle: rgb("--fg-subtle"),
        line: rgb("--border"),
        accent: rgb("--accent"),
        live: rgb("--live"),
        navy: rgb("--navy"),
      },
      // The default scale ran small for Arabic, which sits visually smaller than
      // Latin at the same px. Each step up by 1px, with line-height opened up a
      // little for Arabic ascenders/descenders. Spacing tokens are untouched, so
      // layouts keep their proportions.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // 13px
        sm: ["0.9375rem", { lineHeight: "1.4rem" }], // 15px
        base: ["1.0625rem", { lineHeight: "1.7rem" }], // 17px
      },
      fontFamily: {
        // --font-latin is Geist without its local("Arial") fallback; see layout.tsx.
        sans: ["var(--font-latin)", "var(--font-arabic)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
