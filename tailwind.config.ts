import type { Config } from "tailwindcss";

const config: Config = {
  // relative: true → rutas relativas a este archivo (funciona desde cualquier cwd).
  content: { relative: true, files: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      // Identidad FINCALIA360. Se conservan los nombres internos de las escalas
      // (ink, sand, terracotta, pine) para no tocar las clases existentes.
      colors: {
        // Azul marino de marca (#142B45)
        ink: {
          DEFAULT: "#142B45",
          50: "#F3F5F8",
          100: "#E3E8EE",
          200: "#C5D0DB",
          300: "#95A6B8",
          400: "#627891",
          500: "#445B74",
          600: "#30475F",
          700: "#213851",
          800: "#142B45",
          900: "#0C1D31",
        },
        // Neutros: blanco roto (#F7F8F5) y grises claros para fondos y separadores
        sand: {
          DEFAULT: "#EFF1EC",
          50: "#F7F8F5",
          100: "#EFF1EC",
          200: "#E3E6E1",
          300: "#CDD2CB",
          400: "#A9B0A8",
        },
        // Verde petróleo de marca (#238477): acento y llamadas a la acción
        terracotta: {
          DEFAULT: "#238477",
          50: "#EAF5F3",
          100: "#CBE7E2",
          400: "#3A9A8C",
          500: "#238477",
          600: "#1C6E63",
          700: "#165950",
        },
        // Positivo / confirmaciones (misma familia verde)
        pine: {
          DEFAULT: "#238477",
          50: "#EAF5F3",
          100: "#CBE7E2",
          500: "#238477",
          600: "#1C6E63",
        },
      },
      fontFamily: {
        // Tipografía única de marca: Inter (autoalojada). «serif» se mantiene como alias.
        serif: ['"Inter Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        sans: ['"Inter Variable"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,43,69,0.04), 0 8px 24px -12px rgba(20,43,69,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
