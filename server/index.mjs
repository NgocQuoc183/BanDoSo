import { createServer } from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT ?? 8787);
const DIRECTUS_BASE_URL = (process.env.DIRECTUS_BASE_URL ?? process.env.VITE_DIRECTUS_BASE_URL ?? "https://dcu.huecity.vn").replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_TOKEN ?? process.env.VITE_DIRECTUS_TOKEN ?? "").trim();
const HUECITY_TILE_BASE_URL = (process.env.HUECITY_TILE_BASE_URL ?? "https://map.huecity.vn:8280").replace(/\/$/, "");
const HUECITY_TILE_AUTH_BASE64 = (process.env.HUECITY_TILE_AUTH_BASE64 ?? "").trim();

const directusAuth = DIRECTUS_TOKEN ? `Bearer ${DIRECTUS_TOKEN}` : undefined;
const huecityTileAuth = HUECITY_TILE_AUTH_BASE64 ? `Basic ${HUECITY_TILE_AUTH_BASE64}` : undefined;

if (!directusAuth) console.warn("[proxy] DIRECTUS_TOKEN chưa được cấu hình; request tới Directus sẽ không có xác thực.");
if (!huecityTileAuth) console.warn("[proxy] HUECITY_TILE_AUTH_BASE64 chưa được cấu hình; request tới map.huecity.vn có thể bị từ chối.");

// BFF proxy: giữ mọi credential (token Directus, Basic auth tile nền) phía server.
// Frontend chỉ gọi các path tương đối này, không bao giờ nhìn thấy secret thật.
const ROUTES = [
  { prefix: "/api/directus", target: DIRECTUS_BASE_URL, authorization: directusAuth },
  { prefix: "/api/tiles/dcu", target: DIRECTUS_BASE_URL, authorization: directusAuth },
  { prefix: "/api/tiles/huecity", target: HUECITY_TILE_BASE_URL, authorization: huecityTileAuth },
];

// Proxy này công khai (không xác thực phía client) nhưng gắn kèm token admin
// thật ở mọi request forward đi — nếu cho qua POST/PATCH/DELETE, bất kỳ ai
// cũng có thể ghi/xóa dữ liệu Directus thật qua đường này. App chỉ cần đọc dữ
// liệu nên chỉ cho phép GET/HEAD, chặn cứng mọi method khác tại đây thay vì
// dựa vào quyền hạn cấu hình phía Directus.
const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400).end();
    return;
  }
  if (!ALLOWED_METHODS.has(req.method)) {
    res.writeHead(405, { "content-type": "text/plain", "allow": "GET, HEAD" }).end("Method Not Allowed");
    return;
  }
  const route = ROUTES.find((item) => req.url.startsWith(item.prefix));
  if (!route) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  const upstreamUrl = route.target + req.url.slice(route.prefix.length);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: route.authorization ? { Authorization: route.authorization } : undefined,
    });
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": upstream.headers.get("cache-control") ?? "no-store",
    });
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain" }).end(`Bad gateway: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.listen(PORT, () => {
  console.log(`[proxy] Directus/tile BFF đang chạy tại http://127.0.0.1:${PORT}`);
});
