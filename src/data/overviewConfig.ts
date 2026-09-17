import type { DirectusCollection } from "./directusCollections";

export type OverviewCollectionConfig = {
  collection: DirectusCollection;
  label: string;
  // Chỉ 4/14 collection có field date_updated trong schema thật (đã kiểm tra
  // trực tiếp qua /fields/<collection>) — các collection gisportal_* và
  // rain_water_stations không có field này nên không thống kê đã/chưa cập nhật
  // được cho chúng.
  hasUpdateTracking: boolean;
};

export const OVERVIEW_COLLECTIONS: OverviewCollectionConfig[] = [
  { collection: "thua_dat", label: "Thửa đất", hasUpdateTracking: true },
  { collection: "gisportal_HienTrangKhuCongNghiep_P", label: "Hiện trạng Khu công nghiệp", hasUpdateTracking: false },
  { collection: "gisportal_DinhHuongPhatTrienKhuCongNghiep_P", label: "Định hướng phát triển Khu công nghiệp", hasUpdateTracking: false },
  { collection: "gisportal_HienTrangKhuXuLyChatThai_P", label: "Hiện trạng Khu xử lý chất thải", hasUpdateTracking: false },
  { collection: "gisportal_DinhHuongKhuXuLyChatThai_P", label: "Định hướng Khu xử lý chất thải", hasUpdateTracking: false },
  { collection: "gisportal_HienTrangNghiaTrang_P", label: "Hiện trạng Nghĩa trang", hasUpdateTracking: false },
  { collection: "gisportal_DinhHuongNghiaTrang_P", label: "Định hướng Nghĩa trang", hasUpdateTracking: false },
  { collection: "gisportal_DinhHuongKhuCongNgheCao_P", label: "Định hướng Khu công nghệ cao", hasUpdateTracking: false },
  { collection: "gisportal_DinhHuongCoSoKHCN_P", label: "Định hướng Cơ sở KH&CN", hasUpdateTracking: false },
  { collection: "gisportal_HienTrangCoSoKHCN_P", label: "Hiện trạng Cơ sở KH&CN", hasUpdateTracking: false },
  { collection: "bts", label: "Trạm BTS", hasUpdateTracking: true },
  { collection: "rain_water_stations", label: "Trạm đo mưa", hasUpdateTracking: false },
  { collection: "water_level_station", label: "Trạm đo mực nước", hasUpdateTracking: true },
  { collection: "iot_wind_station", label: "Trạm đo gió IoT", hasUpdateTracking: true },
];

export const UPDATE_DATE_FIELD = "date_updated";
export const TREND_DAYS = 14;
export const WARD_CHART_COLLECTION = "thua_dat";
export const WARD_CHART_FIELD = "ten_xa";
