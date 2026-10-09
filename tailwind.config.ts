import type { Config } from "tailwindcss";

const config: Config = {
  // relative: true → rutas relativas a este archivo (funciona desde cualquier cwd).
  content: { relative: true, files: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#13293D",
          50: "#F2F5F8",
          100: "#E1E8EF",
          200: "#C3D0DD",
          300: "#94A9BE",
          400: "#5F7A94",
          500: "#3D5A76",
          600: "#2A4560",
          700: "#1E364D",
          800: "#13293D",
          900: "#0B1B2A",
        },
        sand: {
          DEFAULT: "#F6F2EA",
          50: "#FBF9F5",
          100: "#F6F2EA",
          200: "#ECE4D4",
          300: "#DDD0B8",
          400: "#C8B694",
        },
        terracotta: {
          DEFAULT: "#B5562F",
          50: "#FBF1EC",
          100: "#F4DCCF",
          400: "#C9714C",
          500: "#B5562F",
          600: "#984524",
          700: "#7A371D",
        },
        pine: {
          DEFAULT: "#4C6B58",
          50: "#EEF3EF",
          100: "#D8E4DB",
          500: "#4C6B58",
          600: "#3D5747",
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Inter Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(19,41,61,0.04), 0 8px 24px -12px rgba(19,41,61,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
