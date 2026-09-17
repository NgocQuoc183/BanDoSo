import type { SelectedMvtFeature } from "../map/layerRegistry";

type Props = {
  feature: SelectedMvtFeature;
  onClose: () => void;
  className?: string;
};

export function MvtInfoPanel({ feature, onClose, className }: Props) {
  const title = firstValue(feature.properties, feature.config.titleFields) || feature.config.label;
  const fields = uniqueFields([...feature.config.detailFields, ...feature.config.titleFields]);

  const displayFieldValue = (field: string) => {
    const property = feature.properties[field];
    const objectKey = feature.config.objectValueKey?.[field];
    const resolved = objectKey && property && typeof property === "object" && !Array.isArray(property)
      ? (property as Record<string, unknown>)[objectKey]
      : property;
    const raw = displayValue(resolved);
    return feature.config.valueLabels?.[field]?.[raw] ?? raw;
  };
  const visibleFields = fields.filter((field) => displayFieldValue(field));

  return (
    <section className={`absolute bottom-4 right-4 z-20 max-h-[calc(100%-2rem)] w-[28rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-[#cbd8e8] bg-white/97 shadow-[0_10px_34px_rgba(23,38,60,0.22)] backdrop-blur-sm ${className ?? ""}`}>
      <header className="flex items-start justify-between gap-3 border-b border-[#d5deea] bg-[#f8fafc] px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: feature.config.color }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: feature.config.color }}>
              {feature.config.label}
            </span>
          </div>
          <h2 className="truncate text-sm font-bold leading-5 text-[#17263c]">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="shrink-0 text-[#68778a] hover:text-[#0878bd]">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </header>
      {visibleFields.length > 0 ? (
        <div className="max-h-[55dvh] divide-y divide-[#eef2f6] overflow-y-auto px-4 py-1">
          {visibleFields.map((field) => (
            <div key={field} className="py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6b8092]">{feature.config.fieldLabels?.[field] ?? field}</div>
              <p className="mt-0.5 whitespace-pre-line text-xs leading-5 text-[#213e55]">{displayFieldValue(field)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-xs text-[#68778a]">Không có dữ liệu chi tiết cho đối tượng này.</p>
      )}
    </section>
  );
}

function uniqueFields(fields: string[]): string[] {
  return [...new Set(fields)];
}

function firstValue(properties: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = displayValue(properties[field]);
    if (value) return value;
  }
  return "";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

