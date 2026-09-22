# CLAUDE.md

File này cung cấp hướng dẫn cho Claude Code (claude.ai/code) khi làm việc với mã nguồn trong repo này.

Để xem chi tiết đầy đủ hơn về từng luồng dữ liệu (bằng tiếng Việt), xem `PROJECT_FLOW.md` — tài liệu này được đội ngũ cập nhật thường xuyên và nên được xem là nguồn thông tin chính thức cùng với file này.

## Đây là gì

Một ứng dụng SPA React + Vite + TypeScript hiển thị bản đồ số tương tác của thành phố Huế (địa giới hành chính, dự án đầu tư, và các lớp dữ liệu MVT động như thửa đất, trạm BTS, trạm quan trắc thời tiết/nước, khu công nghiệp) sử dụng MapLibre GL, kết hợp với Directus CMS cho metadata dạng bảng và thống kê. Không có backend/database truyền thống của riêng nó — đây là client bản đồ + dashboard đứng trước các dịch vụ bên ngoài (Directus, một host GeoJSON công khai, và một tile server MVT riêng).

## Các lệnh

```bash
npm run dev              # Vite dev server (proxy /api/directus, /api/tiles/* — xem bên dưới)
npm run build             # tsc -b && vite build
npm run lint               # eslint .
npm run preview            # preview bản build production
npm run server              # khởi động BFF proxy production (server/index.mjs)
npm run test:directus       # node tools/test_directus_records.mjs (kiểm tra token/collection Directus)
npm run docs:directus-fields # node tools/generate_directus_fields_doc.mjs
```

Không có bộ test/framework kiểm thử tự động nào được cấu hình — `test:directus` là script kiểm tra kết nối thủ công cần `VITE_DIRECTUS_TOKEN`, không phải test runner tự động. Lưu ý: thư mục `tools/` hiện đang rỗng trong checkout này, nên 2 script `tools/*.mjs` ở trên sẽ báo lỗi cho tới khi các file đó tồn tại.

Một điểm khởi đầu duy nhất, cây route đơn giản dựa trên `window.location.pathname` trong `src/App.tsx` (`/`, `/overview`, `/monitoring`, `/statics` hoặc `/dashboard`) — không dùng thư viện router nào.

## Kiến trúc

**Xử lý token/secret là ràng buộc quan trọng nhất trong codebase này.** Token API của Directus và credential Basic-auth của tile server không bao giờ được phép lọt vào bundle trình duyệt:
- Không có mã nào trong `src/` được phép đọc trực tiếp `import.meta.env.VITE_DIRECTUS_TOKEN` (hay bất kỳ biến env auth tile nào). Mọi lời gọi Directus/tile từ client đều đi qua các path tương đối cùng origin: `/api/directus/...`, `/api/tiles/dcu/...`, `/api/tiles/huecity/...`.
- Ở dev, `vite.config.ts` đọc `.env.local` và tiêm header `Authorization` ngay trong proxy của Vite dev server (chạy phía Node, không bao giờ gửi xuống trình duyệt).
- Ở production, `server/index.mjs` (`npm run server`) là một BFF/reverse-proxy tối giản, dùng đứng sau Nginx (xem `server/nginx.example.conf`), forward 3 path prefix nói trên tới host Directus/tile thật kèm header xác thực gắn ở phía server. Nó đọc `DIRECTUS_TOKEN`, `DIRECTUS_BASE_URL`, `HUECITY_TILE_BASE_URL`, `HUECITY_TILE_AUTH_BASE64` từ biến môi trường của process.
- `transformRequest` của MapLibre (`src/map/mapClient.ts`) viết lại các URL tile tuyệt đối về đúng các path proxy này, để vector tile cũng không bao giờ gọi thẳng host thật từ trình duyệt.

**Hệ thống lớp bản đồ (`src/map/`)** là phần lõi của ứng dụng:
- `layerRegistry.ts` định nghĩa `DynamicMapLayerConfig` — mô tả khai báo (declarative) cho mọi lớp dữ liệu MVT/Directus (kiểu hình học, URL tile, collection Directus + field ID, các field tìm kiếm/danh sách/chi tiết, ghi đè nhãn field/giá trị, khoảng zoom, style). `LOCAL_MAP_REGISTRY` là fallback hardcode dùng trong dev; ở các mode khác `loadMapRegistry()` sẽ fetch và validate (`validateMapRegistry`) file `registry.json` từ xa tại `/api/map-registry/v1/registry.json` (hoặc `VITE_MAP_REGISTRY_URL`). Thêm một lớp dữ liệu mới chỉ cần thêm entry ở đây (và vào menu nếu cần hiển thị) — không cần tạo component mới.
- `useAdministrativeMap.ts` là một hook lớn duy nhất sở hữu toàn bộ state MapLibre: tạo instance bản đồ, tải GeoJSON phường/xã và thành phố từ host ngoài, thêm source/layer cho phường xã, ranh giới thành phố, dự án đầu tư, và mọi lớp MVT theo registry, gắn các handler click/hover, và expose state chọn/hiển thị + setter cho `App.tsx` sử dụng. Việc hiển thị/ẩn lớp được điều khiển qua thuộc tính layout `visibility: "none"|"visible"` được bật/tắt từ React state thông qua ref (để tránh stale closure trong handler sự kiện của MapLibre) — hãy theo đúng pattern đồng bộ qua ref này khi thêm lớp tương tác mới.
- `projectLayers.ts` là một registry tĩnh riêng, đơn giản hơn, cho 4 nhóm GeoJSON dự án đầu tư (không dựa trên Directus/MVT).
- Việc chọn feature dùng `feature-state` (`selected: true`) của MapLibre thay vì chỉ dựa vào component state, nên khi click lại/bỏ chọn phải gọi tường minh `removeFeatureState`.

**Lớp dữ liệu Directus (`src/data/`)**:
- `directusClient.ts` là nơi duy nhất giao tiếp với Directus. Đây là tập hợp các hàm fetch (đếm bản ghi, phân trang, export CSV, tổng hợp nhóm/time-series cho dữ liệu cảm biến trạm) đều xây trên REST filter/aggregate query-string API của Directus. Không dùng SDK.
- `directusCollections.ts` liệt kê tập collection cố định dùng cho số đếm ở popup "Tổng quan".
- `dashboardConfigs.ts` cấu hình `CollectionDashboard` (UI bảng/tìm kiếm/lọc/chi tiết dùng chung) cho từng domain dữ liệu (đất đai, quy hoạch, môi trường, quan trắc, khoa học, viễn thông). Mỗi cấu hình ánh xạ tên field thô của Directus sang nhãn tiếng Việt và renderer tuỳ biến (các field Directus không đồng nhất giữa các collection — JSON object vs chuỗi vs mảng cho cùng một khái niệm — nên phần lớn file này là logic chuẩn hoá riêng cho từng collection kèm comment giải thích sự khác biệt).

**Routing/trang**: `App.tsx` không dùng thư viện routing nào; chỉ là một switch thuần trên pathname để render `OverviewDashboard`, `MonitoringDashboard`, `CollectionDashboard` (các trang thống kê), hoặc `MapApp` (trang chính). `MapApp` kết hợp `AdministrativeMenu` (bật/tắt lớp), `AppHeader`/`AppFooter` của `Layout`, và các panel thông tin (`WardInfoPanel`, `ProjectInfoPanel`, `MvtInfoPanel`, `DataOverviewPanel`) từ `InfoPanels.tsx`/`MvtInfoPanel.tsx`, tất cả đều được điều khiển bởi giá trị trả về của hook `useAdministrativeMap`.

**i18n**: `src/i18n/index.ts` cấu hình `i18next`/`react-i18next` cho 6 ngôn ngữ (`vi` mặc định, `en`, `fr`, `ja`, `ko`, `zh`), lưu vào `localStorage` dưới khoá `bandoso-language`. Chuỗi UI tĩnh nằm ở `src/i18n/locales/*.json`. *Giá trị* dữ liệu đến từ GeoJSON/Directus (tên địa danh...) được bản địa hoá riêng qua `getLocalizedDataValue` trong `src/i18n/localizedData.ts`, hàm này tìm các property có hậu tố `<field>_<lang>` và fallback về tiếng Việt — đây là cơ chế khác biệt với `t()` và chỉ áp dụng cho dữ liệu feature, không áp dụng cho nội dung UI.

**Styling**: Tailwind CSS v4 qua `@tailwindcss/postcss` (không có `tailwind.config.js` — v4 là CSS-first, xem `src/index.css`). Phần lớn component dùng màu hex inline (`#0878bd` v.v.) thay vì token theme của Tailwind, khớp với bảng màu thương hiệu thành phố Huế cũng được dùng xuyên suốt trong style bản đồ.

**Build**: `vite.config.ts` tách thủ công chunk `vendor-react` và `vendor-maplibre`, đồng thời nâng giới hạn cảnh báo kích thước chunk, vì MapLibre GL khá lớn. Cùng một cấu hình proxy được tái sử dụng cho cả mode `server` (dev) và `preview`.
