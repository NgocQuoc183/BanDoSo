# Luong du an ban do so

## 1. Muc tieu

Day la ung dung React + Vite + TypeScript hien thi ban do so thanh pho Hue. Ung dung ket hop:

- Ban do MapLibre GL.
- Du lieu dia gioi hanh chinh tu GeoJSON.
- Du lieu du an tu cac file GeoJSON trong `public/data` neu duoc cung cap.
- Lop du lieu MVT tu dich vu ban do.
- Metadata va thong ke collection tu Directus.
- Da ngon ngu qua i18next.

## 2. Diem khoi dong

`index.html` nap `src/main.tsx`.

`src/main.tsx` nap stylesheet va render component goc `App` vao DOM.

`src/App.tsx` la bo dieu phoi giao dien chinh:

1. Nap ngon ngu hien tai.
2. Tao ref cho vung ban do.
3. Goi `useAdministrativeMap` de nap du lieu va quan ly trang thai ban do.
4. Nap count cac Directus collection cho popup tong quan.
5. Render header, menu lop, ban do, cac panel thong tin va footer.

## 3. Luong khoi tao ban do

1. `useAdministrativeMap` goi `loadMapRegistry` trong `src/map/layerRegistry.ts`.
2. Registry mo ta cac lop MVT, collection Directus, truong ID, truong geometry, lop tim kiem va kha nang thong ke.
3. Hook tai GeoJSON thanh pho va phuong xa.
4. Hook tai cac file GeoJSON du an tu `PROJECT_CATEGORIES` trong `src/map/projectLayers.ts`.
5. Khi MapLibre phat su kien `style.load`, hook tao source va layer cho dia gioi, du an va MVT.
6. `AdministrativeMenu` dieu khien an/hien dia gioi, du an va cac lop MVT.

## 4. Du lieu va API

### Dia gioi hanh chinh

- URL du lieu duoc khai bao trong `src/map/useAdministrativeMap.ts`.
- Du lieu duoc chuan hoa thanh kieu `Ward` trong `src/map/types.ts`.
- `WardInfoPanel` hien thi thong tin phuong xa dang chon.

### Du an

- Danh sach nhom nam trong `src/map/projectLayers.ts`.
- Moi nhom tro toi mot file GeoJSON trong public.
- Du lieu duoc chuan hoa thanh `SelectedProject`/`ProjectSearchItem`.
- `ProjectInfoPanel` hien thi chi tiet du an.

### MVT

- Cau hinh lop nam trong `src/map/layerRegistry.ts`.
- URL tile mac dinh la endpoint MVT cua `dcu.huecity.vn`.
- Thuoc tinh feature duoc doc khi nguoi dung click vao lop.
- `MvtInfoPanel` hien thi feature dang chon.
- Dieu khien MVT hien nam trong menu ben trai `AdministrativeMenu`.

### Directus & bao mat token

- Danh sach collection nam trong `src/data/directusCollections.ts`.
- `src/data/directusClient.ts` kiem tra quyen doc va dem ban ghi. Client goi qua path tuong doi `/api/directus/...`, khong bao gio chua token.
- Ham `countCollection` thu aggregate count truoc, sau do fallback sang `meta=total_count` neu role khong duoc aggregate.
- Ban do dung MapLibre `transformRequest` (`src/map/useAdministrativeMap.ts`) de viet lai URL tile ve `/api/tiles/dcu/...` va `/api/tiles/huecity/...` thay vi goi thang host that.
- Token Directus va Basic-auth cua tile nen **chi ton tai phia server**:
  - Dev: `vite.config.ts` doc `.env.local` (`VITE_DIRECTUS_TOKEN`, `VITE_DIRECTUS_BASE_URL`, `HUECITY_TILE_BASE_URL`, `HUECITY_TILE_AUTH_BASE64`) va tiem header `Authorization` ngay trong proxy cua Vite dev server (chay trong Node, khong lo ra trinh duyet).
  - Production: chay `server/index.mjs` (`npm run server`, doc bien moi truong `DIRECTUS_TOKEN`/`DIRECTUS_BASE_URL`/`HUECITY_TILE_BASE_URL`/`HUECITY_TILE_AUTH_BASE64`) dang sau Nginx, forward `/api/directus`, `/api/tiles/dcu`, `/api/tiles/huecity` toi dung host that kem header xac thuc.
  - Khong co ma nao trong `src/` duoc doc `import.meta.env.VITE_DIRECTUS_TOKEN` — neu them lai se lam token bi nhung vao bundle trinh duyet.

## 5. Popup tong quan

`DataOverviewPanel` trong `src/components/InfoPanels.tsx` hien thi:

- Tong so doi tuong tu cac collection dem duoc.
- So collection doc duoc tren tong so collection.
- Tong so thua dat.
- So khu cong nghiep.
- So khu xu ly chat thai.
- So nghia trang.
- So tram quan trac.

Popup duoc mo tu nut Tong quan tren ban do. So lieu duoc tai song song khi `App` khoi tao; gia tri `...` cho biet dang tai va `-` cho biet khong doc duoc.

Nut `Xem chi tiet thong ke` mo trang thong ke hop nhat tai `/statics`.

`CollectionDashboard` trong `src/components/CollectionDashboard.tsx` la component dong dung chung cho tat ca nhom du lieu. `dashboardConfigs.ts` chi chua cau hinh collection, cot, field tim kiem va field loc; them collection moi khong can tao component moi.

## 6. Tim kiem va tuong tac

- Tim kiem trong `App.tsx` loc phuong xa va du an da nap vao client.
- Chon ket qua tim kiem se chon feature va zoom ban do vao doi tuong.
- Click feature MVT mo `MvtInfoPanel`.
- Cac panel thong tin co the dong bang nut close.

## 7. Da ngon ngu

- Cau hinh i18next nam trong `src/i18n/index.ts`.
- Ban dich nam trong `src/i18n/locales/`.
- Du lieu co the co gia tri theo ngon ngu; `src/i18n/localizedData.ts` chon gia tri phu hop va fallback ve tieng Viet.

## 8. Lenh phat trien va kiem tra

```text
npm run dev
npm run build
npm run lint
npm run test:directus
npm run preview
npm run server
```

`npm run test:directus` can `VITE_DIRECTUS_TOKEN` trong `.env.local` hoac bien moi truong. Khong dua file `.env.local` vao kho ma.

`npm run server` khoi dong BFF proxy (`server/index.mjs`) dung cho production, dat sau Nginx. Xem muc "Directus & bao mat token" o tren de biet cac bien moi truong can cau hinh tren server that (khong dung file `.env.local`).

## 9. Quy uoc don gian

- Them lop ban do: cap nhat registry, sau do noi vao menu neu can.
- Them collection Directus: cap nhat `directusCollections.ts` va registry neu collection co lop tren ban do.
- Them panel: dat trong `src/components/` va chi import tu noi su dung.
- Them collection vao thong ke: them mot cau hinh vao `src/data/dashboardConfigs.ts` va them vao danh sach `configs` cua route `/statics` neu can.
- Sua style chung: uu tien `src/index.css` va class Tailwind dang dung.
- Khong sua file trong `dist/`; day la output sinh tu build.
