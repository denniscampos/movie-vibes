import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["@prisma/client", "~/lib/generated/prisma", /^@prisma\/client\/.*/],
    },
  },
  server: {
    port: 3000,
  },
  plugins: [reactRouter(), tsconfigPaths()],
});
