// ============================================================================
// FILE:       frontend/tailwind.config.js
// PURPOSE:    Tailwind CSS v3 design tokens, theme extensions, custom color
//             palettes (aurora, glassmorphic cards), and keyframe animations.
// HOW IT WORKS: Scans index.html and src/**/*.{ts,tsx} to generate minimal CSS.
//             Configures dark-first styling with class-based darkMode support.
// USED BY / DEPENDS ON: postcss.config.js, src/index.css, all React components.
// KEY CONCEPTS: Design tokens, JIT compiler, dark mode, custom keyframes.
// ============================================================================

/** @type {import('tailwindcss').Config} */
export default {
  // Specify content templates for Tailwind JIT class scanning.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  // Enable class-based dark mode so dark mode is the default and toggleable.
  darkMode: "class",

  // Theme extensions for TaskFlow.
  theme: {
    extend: {
      // Custom color tokens for dark glassmorphic aesthetics.
      colors: {
        // Aurora glowing accents.
        aurora: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },

      // Custom keyframe animations for rich tactile UI feedback.
      keyframes: {
        // Shimmer animation for skeleton loaders.
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        // Floating ambient background mesh blobs.
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
      },

      // Reusable animation utility classes.
      animation: {
        shimmer: "shimmer 1.8s infinite",
        float: "float 10s ease-in-out infinite",
      },
    },
  },

  // No extraneous plugins needed; standard Tailwind utilities cover all designs.
  plugins: [],
};
