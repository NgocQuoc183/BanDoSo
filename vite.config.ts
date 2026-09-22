import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Tiêm header Authorization ở tầng proxy dev (chạy trong Node của Vite), không
// bao giờ gửi token xuống trình duyệt. Production dùng cùng các path /api/* qua
// server/index.mjs đứng sau Nginx — xem PROJECT_FLOW.md mục "Directus & bảo mật token".
// Proxy /api/* gắn kèm token Directus/tile thật vào request forward đi; nếu để
// lọt POST/PATCH/DELETE, bất kỳ ai gọi dev/preview server cũng có thể ghi/xóa
// dữ liệu thật qua đường này. App chỉ cần đọc dữ liệu nên chặn cứng mọi method
// khác GET/HEAD tại đây — chạy trước middleware proxy nội bộ của Vite vì hook
// không trả về function (xem tài liệu configureServer/configurePreviewServer).
function restrictApiMethods(): Plugin {
  const middleware: import("vite").Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.startsWith("/api/") && req.method && !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { "content-type": "text/plain", allow: "GET, HEAD" }).end("Method Not Allowed");
      return;
    }
    next();
  };
  return {
    name: "restrict-api-methods",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

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
    plugins: [react(), restrictApiMethods()],
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
