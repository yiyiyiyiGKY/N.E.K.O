import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/web"),
  publicDir: path.resolve(__dirname, ".."),

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
    // 开发模式下暂时禁用代理，因为我们使用 mock 数据
    // 如果需要连接后端 API，取消注释以下配置：
    // proxy: {
    //   "/api": {
    //     target: "http://localhost:48911",
    //     changeOrigin: true,
    //   },
    //   "/static": {
    //     target: "http://localhost:48911",
    //     changeOrigin: true
    //   }
    // }
  },

  build: {
    outDir: path.resolve(__dirname, "dist/dev"),
    emptyOutDir: true,
    sourcemap: true,
  }
});
