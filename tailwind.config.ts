import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Light theme colors
        light: {
          bg: "#FFFFFF",
          surface: "#F5F5F5",
          text: "#172030",
          primary: "#2695C9",
          gold: "#D18D04",
        },
      },
      animation: {
        shimmer: "shimmer 2s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-out",
        fadeOut: "fadeOut 0.2s ease-in",
        slideDown: "slideDown 0.4s ease-out forwards",
        slideUp: "slideUp 0.3s ease-out forwards",
        popIn: "popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        fillSlide: "fillSlide 0.25s ease-out",
        tabFillDown: "tabFillDown 0.4s ease-out forwards",
        tabFillUp: "tabFillUp 0.4s ease-out forwards",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(1.15)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        fillSlide: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        growUp: {
          "0%": { height: "0%" },
          "100%": { height: "100%" },
        },
        growRight: {
          "0%": { width: "0%" },
          "100%": { width: "50%" },
        },
        growLeft: {
          "0%": { width: "0%" },
          "100%": { width: "50%" },
        },
        tabFillDown: {
          "0%": { clipPath: "inset(0 0 100% 0)", opacity: "0.25" },
          "40%": { clipPath: "inset(0 0 0 0)", opacity: "0.25" },
          "100%": { clipPath: "inset(calc(100% - 3px) 0 0 0)", opacity: "1" },
        },
        tabFillUp: {
          "0%": { clipPath: "inset(100% 0 0 0)", opacity: "0.25" },
          "40%": { clipPath: "inset(0 0 0 0)", opacity: "0.25" },
          "100%": { clipPath: "inset(calc(100% - 3px) 0 0 0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
