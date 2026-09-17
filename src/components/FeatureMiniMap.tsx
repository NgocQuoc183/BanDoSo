import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Geometry } from "geojson";
import { STYLE_URL, geometryBounds, transformTileRequest } from "../map/mapClient";

type Props = { geometry: Geometry; color: string; className?: string };

export function FeatureMiniMap({ geometry, color, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [107.5991, 16.4637],
      zoom: 10,
      interactive: false,
      attributionControl: false,
      transformRequest: transformTileRequest,
    });
    map.on("load", () => {
      map.addSource("preview-feature", { type: "geojson", data: { type: "Feature", geometry, properties: {} } });
      if (geometry.type === "Point") {
        map.addLayer({
          id: "preview-point",
          type: "circle",
          source: "preview-feature",
          paint: { "circle-radius": 7, "circle-color": color, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
        });
      } else {
        map.addLayer({ id: "preview-fill", type: "fill", source: "preview-feature", paint: { "fill-color": color, "fill-opacity": 0.35 } });
        map.addLayer({ id: "preview-line", type: "line", source: "preview-feature", paint: { "line-color": color, "line-width": 2 } });
      }
      const bounds = geometryBounds(geometry);
      if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom: 17, duration: 0 });
    });
    return () => map.remove();
  }, [geometry, color]);

  return <div ref={containerRef} className={className ?? "h-40 w-full overflow-hidden rounded-lg border border-[#e1e8ee] bg-[#eef2f6]"} />;
}
