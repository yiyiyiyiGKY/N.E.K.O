import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const trimTrailingSlash = (url?: string): string => (url ? url.replace(/\/+$/, "") : "");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = trimTrailingSlash(env.VITE_API_BASE_URL) || "http://localhost:48911";
  const staticBase = trimTrailingSlash(env.VITE_STATIC_SERVER_URL) || apiBase;

  return {
    plugins: [react()],
    root: path.resolve(__dirname, "src/web"),
    publicDir: path.resolve(__dirname, "../static"),

    resolve: {
      alias: [
        { find: "@project_neko/audio-service/web", replacement: path.resolve(__dirname, "packages/audio-service/index.web.ts") },
        { find: "@project_neko/audio-service", replacement: path.resolve(__dirname, "packages/audio-service/index.ts") },
        { find: "@project_neko/live2d-service/web", replacement: path.resolve(__dirname, "packages/live2d-service/index.web.ts") },
        { find: "@project_neko/live2d-service", replacement: path.resolve(__dirname, "packages/live2d-service/index.ts") },
        { find: "@project_neko/components", replacement: path.resolve(__dirname, "packages/components/index.ts") },
        { find: "@project_neko/common", replacement: path.resolve(__dirname, "packages/common/index.ts") },
        { find: "@project_neko/request", replacement: path.resolve(__dirname, "packages/request/index.ts") },
        { find: "@project_neko/realtime", replacement: path.resolve(__dirname, "packages/realtime/index.ts") },
      ],
    },

    server: {
      port: 5173,
      host: true, // 允许外部访问
      fs: {
        allow: [path.resolve(__dirname, "..")]
      },
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
        },
        "/static": {
          target: staticBase,
          changeOrigin: true
        },
        "/icons": {
          target: staticBase,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/icons/, "/static/icons")
        }
      }
    },

    build: {
      outDir: path.resolve(__dirname, "dist/dev"),
      emptyOutDir: true,
      sourcemap: true,
    }
  };
});
