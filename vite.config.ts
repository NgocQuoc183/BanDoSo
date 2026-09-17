import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Tiêm header Authorization ở tầng proxy dev (chạy trong Node của Vite), không
// bao giờ gửi token xuống trình duyệt. Production dùng cùng các path /api/* qua
// server/index.mjs đứng sau Nginx — xem PROJECT_FLOW.md mục "Directus & bảo mật token".
function authProxy(prefix: string, target: string, authorization?: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.slice(prefix.length),
    configure: (proxy) => {
      if (!authorization) return;
      proxy.on("proxyReq", (proxyReq) => proxyReq.setHeader("Authorization", authorization));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const directusBaseUrl = (env.VITE_DIRECTUS_BASE_URL ?? "https://dcu.huecity.vn").replace(/\/$/, "");
  const directusToken = env.VITE_DIRECTUS_TOKEN?.trim();
  const huecityTileBaseUrl = env.HUECITY_TILE_BASE_URL ?? "https://map.huecity.vn:8280";
  const huecityTileAuthBase64 = env.HUECITY_TILE_AUTH_BASE64?.trim();

  const apiProxy = {
    "/data/bandoduan": { target: "https://bandoso.hue.gov.vn", changeOrigin: true },
    "/api/directus": authProxy("/api/directus", directusBaseUrl, directusToken ? `Bearer ${directusToken}` : undefined),
    "/api/tiles/dcu": authProxy("/api/tiles/dcu", directusBaseUrl, directusToken ? `Bearer ${directusToken}` : undefined),
    "/api/tiles/huecity": authProxy("/api/tiles/huecity", huecityTileBaseUrl, huecityTileAuthBase64 ? `Basic ${huecityTileAuthBase64}` : undefined),
  };

  return {
    plugins: [react()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
    build: {
      // MapLibre chứa WebGL renderer và worker nên lớn hơn ứng dụng thông thường.
      // Tách vendor giúp trình duyệt cache độc lập khi mã nghiệp vụ thay đổi.
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-maplibre": ["maplibre-gl"],
          },
        },
      },
    },
  };
});
