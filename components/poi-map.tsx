"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type PoiMapPoint = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  source: "curated" | "wikipedia" | "izi";
};

type PoiMapProps = {
  points: PoiMapPoint[];
  selectedId?: string;
  userPosition: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
};

export function PoiMap({ points, selectedId, userPosition, onSelect }: PoiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const poiLayerRef = useRef<LayerGroup | null>(null);
  const positionLayerRef = useRef<LayerGroup | null>(null);
  const initialFitRef = useRef(false);
  const previousSelectionRef = useRef<string | undefined>(undefined);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let active = true;

    void import("leaflet").then((L) => {
      if (!active || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([44.494, 11.344], 15);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
        poiLayerRef.current = L.layerGroup().addTo(mapRef.current);
        positionLayerRef.current = L.layerGroup().addTo(mapRef.current);
        window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
      }

      const map = mapRef.current;
      const poiLayer = poiLayerRef.current;
      const positionLayer = positionLayerRef.current;
      if (!map || !poiLayer || !positionLayer) return;

      poiLayer.clearLayers();
      positionLayer.clearLayers();

      points.forEach((point, index) => {
        const selected = point.id === selectedId;
        const markerIcon = L.divIcon({
          className: "poi-map-icon-shell",
          html: `<span class="poi-map-icon ${point.source === "izi" ? "izi" : ""} ${selected ? "selected" : ""}"><b>${index + 1}</b></span>`,
          iconSize: [38, 44],
          iconAnchor: [19, 42],
        });
        const marker = L.marker([point.lat, point.lng], { icon: markerIcon, keyboard: true }).addTo(poiLayer);
        const tooltip = document.createElement("div");
        const category = document.createElement("small");
        category.textContent = point.source === "izi" ? `🎧 ${point.category}` : point.category;
        const title = document.createElement("strong");
        title.textContent = point.name;
        tooltip.className = "poi-map-tooltip";
        tooltip.append(category, title);
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -34], opacity: 1 });
        marker.on("click", () => onSelectRef.current(point.id));
      });

      if (userPosition) {
        const userIcon = L.divIcon({
          className: "user-map-icon-shell",
          html: '<span class="user-map-icon"><i></i></span>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([userPosition.lat, userPosition.lng], { icon: userIcon, zIndexOffset: 1000 })
          .bindTooltip("La tua posizione", { direction: "top" })
          .addTo(positionLayer);
      }

      const selectedPoint = points.find((point) => point.id === selectedId);
      if (!initialFitRef.current && points.length > 0) {
        const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
        if (userPosition) bounds.extend([userPosition.lat, userPosition.lng]);
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
        initialFitRef.current = true;
      } else if (selectedPoint && previousSelectionRef.current !== selectedId) {
        map.flyTo([selectedPoint.lat, selectedPoint.lng], Math.max(map.getZoom(), 16), { duration: 0.45 });
      }
      previousSelectionRef.current = selectedId;
    });

    return () => { active = false; };
  }, [points, selectedId, userPosition]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} className="poi-leaflet-map" aria-label="Mappa interattiva dei monumenti e punti di interesse" />;
}
