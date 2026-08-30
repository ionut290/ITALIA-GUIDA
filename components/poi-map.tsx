"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

export type PoiMapPoint = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  source: "curated" | "wikipedia" | "izi" | "openstreetmap";
};

export type PoiMapViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

type PoiMapProps = {
  points: PoiMapPoint[];
  selectedId?: string;
  userPosition: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  onViewportChange?: (viewport: PoiMapViewport) => void;
};

export function PoiMap({ points, selectedId, userPosition, onSelect, onViewportChange }: PoiMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const poiLayerRef = useRef<LayerGroup | null>(null);
  const positionLayerRef = useRef<LayerGroup | null>(null);
  const initialFitRef = useRef(false);
  const previousSelectionRef = useRef<string | undefined>(undefined);
  const previousUserPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const onSelectRef = useRef(onSelect);
  const onViewportChangeRef = useRef(onViewportChange);
  const viewportTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

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
        const reportViewport = () => {
          if (viewportTimerRef.current !== null) window.clearTimeout(viewportTimerRef.current);
          viewportTimerRef.current = window.setTimeout(() => {
            const currentMap = mapRef.current;
            if (!currentMap || !onViewportChangeRef.current) return;
            const bounds = currentMap.getBounds();
            onViewportChangeRef.current({
              south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(), zoom: currentMap.getZoom(),
            });
          }, 450);
        };
        mapRef.current.on("moveend", reportViewport);
        window.setTimeout(() => {
          mapRef.current?.invalidateSize();
          reportViewport();
        }, 0);
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
          html: `<span class="poi-map-icon ${point.source === "izi" ? "izi" : point.source === "openstreetmap" ? "osm" : ""} ${selected ? "selected" : ""}"><b>${index + 1}</b></span>`,
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
      const previousUser = previousUserPositionRef.current;
      if (userPosition && (!previousUser || previousUser.lat !== userPosition.lat || previousUser.lng !== userPosition.lng)) {
        map.flyTo([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 14), { duration: 0.55 });
      }
      previousSelectionRef.current = selectedId;
      previousUserPositionRef.current = userPosition;
    });

    return () => { active = false; };
  }, [points, selectedId, userPosition]);

  useEffect(() => () => {
    if (viewportTimerRef.current !== null) window.clearTimeout(viewportTimerRef.current);
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} className="poi-leaflet-map" aria-label="Mappa interattiva dei monumenti e punti di interesse" />;
}
