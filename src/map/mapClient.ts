export const STYLE_URL = "https://ioc-canhbao.hue.gov.vn/uploadfiles/map/hue_light_style.json";

// Các host này yêu cầu xác thực; request được viết lại qua proxy cùng origin
// (xem server/index.mjs và vite.config.ts) để token/mật khẩu không lộ ra bundle trình duyệt.
const HUECITY_TILE_BASE_URL = "https://map.huecity.vn:8280";
const DIRECTUS_TILE_BASE_URL = "https://dcu.huecity.vn";

// MapLibre tải tile trong Web Worker; worker đó không dựng được Request từ URL
// tương đối nên phải giữ nguyên origin đầy đủ, chỉ đổi phần host.
export function transformTileRequest(url: string): { url: string } | undefined {
  if (url.startsWith(HUECITY_TILE_BASE_URL)) return { url: url.replace(HUECITY_TILE_BASE_URL, `${window.location.origin}/api/tiles/huecity`) };
  if (url.startsWith(DIRECTUS_TILE_BASE_URL)) return { url: url.replace(DIRECTUS_TILE_BASE_URL, `${window.location.origin}/api/tiles/dcu`) };
  return undefined;
}

export function geometryBounds(geometry: unknown): [[number, number], [number, number]] | null {
  if (!geometry || typeof geometry !== "object" || !("coordinates" in geometry)) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (
      coordinates.length >= 2
      && typeof coordinates[0] === "number"
      && typeof coordinates[1] === "number"
    ) {
      minLng = Math.min(minLng, coordinates[0]);
      minLat = Math.min(minLat, coordinates[1]);
      maxLng = Math.max(maxLng, coordinates[0]);
      maxLat = Math.max(maxLat, coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };

  visit((geometry as { coordinates: unknown }).coordinates);
  return Number.isFinite(minLng)
    ? [[minLng, minLat], [maxLng, maxLat]]
    : null;
}
