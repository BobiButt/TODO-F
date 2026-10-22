// ============================================================================
// FILE:       frontend/postcss.config.js
// PURPOSE:    PostCSS pipeline configuration for compiling Tailwind CSS.
// HOW IT WORKS: Hooks TailwindCSS and Autoprefixer into Vite's CSS processing.
// USED BY / DEPENDS ON: Vite build pipeline, tailwindcss.
// KEY CONCEPTS: CSS post-processing, vendor prefixing, Tailwind expansion.
// ============================================================================

export default {
  plugins: {
    // Expands @tailwind directives into compiled CSS utility classes.
    tailwindcss: {},
    // Adds vendor prefixes (-webkit-, -moz-) for cross-browser compatibility.
    autoprefixer: {},
  },
};
