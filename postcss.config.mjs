import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Rutas absolutas: funciona aunque Next se arranque desde otro directorio.
const config = {
  plugins: {
    tailwindcss: { config: path.join(dir, "tailwind.config.ts") },
    autoprefixer: {},
  },
};

export default config;
