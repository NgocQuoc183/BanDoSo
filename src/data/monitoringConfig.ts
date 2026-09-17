import type { DirectusCollection } from "./directusCollections";

export type MonitoringStationType = {
  key: string;
  label: string;
  icon: string;
  color: string;
  stationCollection: DirectusCollection;
  // Field ở station khớp với field trạm trong bảng time-series bên dưới.
  stationIdField: "code" | "id";
  seriesCollection: string;
  seriesStationField: string;
  primaryField: string;
  primaryLabel: string;
  primaryUnit: string;
  // true = cộng dồn trong khoảng thời gian có ý nghĩa thật (mưa); false = lấy
  // giá trị lớn nhất trong khoảng (mực nước, gió — cộng dồn vô nghĩa).
  accumulate: boolean;
  // Ngưỡng cảnh báo đơn giản, chỉ đặt khi có quy ước chung hợp lý (không bịa
  // ngưỡng riêng theo địa hình từng trạm, vd mực nước — nên để trống).
  warningThreshold?: number;
};

export const MONITORING_STATION_TYPES: MonitoringStationType[] = [
  {
    key: "rain", label: "Trạm đo mưa", icon: "rainy", color: "#1479c9",
    stationCollection: "rain_water_stations", stationIdField: "code",
    seriesCollection: "rain_water_depth", seriesStationField: "station_id",
    primaryField: "depth", primaryLabel: "Lượng mưa", primaryUnit: "mm",
    accumulate: true,
    // Quy ước khí tượng phổ biến: >50mm/24h = mưa to.
    warningThreshold: 50,
  },
  {
    key: "water_level", label: "Trạm đo mực nước", icon: "water", color: "#0f9b8e",
    stationCollection: "water_level_station", stationIdField: "code",
    seriesCollection: "water_level_depth", seriesStationField: "station_id",
    primaryField: "depth", primaryLabel: "Mực nước", primaryUnit: "cm",
    accumulate: false,
    // Không đặt ngưỡng: mực nước báo động phụ thuộc cao độ nền từng trạm,
    // không có quy ước chung — cần dữ liệu ngưỡng riêng theo trạm mới làm được.
  },
  {
    key: "wind", label: "Trạm đo gió", icon: "air", color: "#805ad5",
    stationCollection: "iot_wind_station", stationIdField: "id",
    seriesCollection: "iot_wind_speed", seriesStationField: "sid",
    primaryField: "ws", primaryLabel: "Tốc độ gió", primaryUnit: "m/s",
    accumulate: false,
    // ~cấp 8 Beaufort (gió mạnh) — quy ước cảnh báo gió phổ biến.
    warningThreshold: 20,
  },
];

export const MONITORING_TREND_HOURS = 24;
export const MONITORING_RECENT_LIMIT = 12;
