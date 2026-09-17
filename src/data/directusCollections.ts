export const DIRECTUS_COLLECTIONS = [
  "thua_dat",
  "gisportal_HienTrangKhuCongNghiep_P",
  "gisportal_DinhHuongPhatTrienKhuCongNghiep_P",
  "gisportal_HienTrangKhuXuLyChatThai_P",
  "gisportal_DinhHuongKhuXuLyChatThai_P",
  "gisportal_HienTrangNghiaTrang_P",
  "gisportal_DinhHuongNghiaTrang_P",
  "gisportal_DinhHuongKhuCongNgheCao_P",
  "gisportal_DinhHuongCoSoKHCN_P",
  "gisportal_HienTrangCoSoKHCN_P",
  "bts",
  "rain_water_stations",
  "water_level_station",
  "iot_wind_station",
] as const;

export type DirectusCollection = (typeof DIRECTUS_COLLECTIONS)[number];
