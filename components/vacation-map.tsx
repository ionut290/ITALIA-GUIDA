"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type VacationMapPoint = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  kind: "hotel" | "stop";
  day?: number;
};

export function VacationMap({ points }: { points: VacationMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !containerRef.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([42.5, 12.5], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();
      points.forEach((point) => {
        const icon = L.divIcon({
          className: "vacation-map-icon-shell",
          html: point.kind === "hotel"
            ? '<span class="vacation-map-icon hotel"><b>H</b></span>'
            : `<span class="vacation-map-icon stop"><b>${point.day ?? "•"}</b></span>`,
          iconSize: [38, 42],
          iconAnchor: [19, 40],
        });
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(layer);
        const popup = document.createElement("div");
        const category = document.createElement("small");
        category.textContent = point.kind === "hotel" ? "Alloggio" : `Giorno ${point.day} · ${point.category}`;
        const title = document.createElement("strong");
        title.textContent = point.name;
        const link = document.createElement("a");
        link.href = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Apri indicazioni";
        popup.className = "vacation-map-popup";
        popup.append(category, title, link);
        marker.bindPopup(popup);
      });
      if (points.length) {
        const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      }
      window.setTimeout(() => map.invalidateSize(), 50);
    });
    return () => { active = false; };
  }, [points]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} className="vacation-leaflet-map" aria-label="Mappa degli alberghi e delle tappe della vacanza" />;
}
