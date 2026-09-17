import type { ProjectCategory, ProjectCategoryId } from "./types";

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    id: "calling",
    alias: "Dự án đang kêu gọi đầu tư",
    color: "#dc2626",
    sourceUrl: "/data/bandoduan/DA_DangKeuGoiDauTu.geojson",
    iconUrl: "/images/project-markers/project-red.svg",
  },
  {
    id: "selecting-investor",
    alias: "Dự án đã chấp thuận chủ trương đầu tư, đang triển khai lựa chọn nhà đầu tư",
    color: "#8b5cf6",
    sourceUrl: "/data/bandoduan/DA_DangTrienKhai_LuaChon_NhaDauTu.geojson",
    iconUrl: "/images/project-markers/project-purple.svg",
  },
  {
    id: "constructing",
    alias: "Dự án đã chấp thuận nhà đầu tư, đang triển khai xây dựng",
    color: "#f97316",
    sourceUrl: "/data/bandoduan/DA_DangTrienKhai_XayDung.geojson",
    iconUrl: "/images/project-markers/project-orange.svg",
  },
  {
    id: "operating",
    alias: "Dự án đã đi vào hoạt động",
    color: "#16a34a",
    sourceUrl: "/data/bandoduan/DA_hoatdong.geojson",
    iconUrl: "/images/project-markers/project-green.svg",
  },
];

export const INITIAL_PROJECT_CATEGORY_VISIBILITY = Object.fromEntries(
  PROJECT_CATEGORIES.map((category) => [category.id, true]),
) as Record<ProjectCategoryId, boolean>;

export const projectSourceId = (id: ProjectCategoryId) => `projects-${id}-source`;
export const projectFillLayerId = (id: ProjectCategoryId) => `projects-${id}-fill`;
export const projectBorderLayerId = (id: ProjectCategoryId) => `projects-${id}-border`;
export const projectSymbolLayerId = (id: ProjectCategoryId) => `projects-${id}-symbol`;
export const projectIconId = (id: ProjectCategoryId) => `projects-${id}-icon`;
