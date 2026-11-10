/** Tailwind v3 config used by tests. */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0f6e77", 500: "#14919b", 600: "#0f6e77" },
        surface: "rgb(243 244 246)",
        primary: ({ theme }) => theme("colors.brand.600"),
      },
      spacing: { card: "1rem", 18: "4.5rem" },
      borderRadius: { md: "0.5rem" },
      fontSize: { sm: ["0.875rem", { lineHeight: "1.25rem" }], hero: "3rem" },
    },
  },
};
