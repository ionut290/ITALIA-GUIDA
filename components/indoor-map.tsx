"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

type Point = { id: string; name: string; category: string; level?: string; lat: number; lng: number };
type Position = { lat: number; lng: number; accuracy?: number };

type Props = {
  center: { lat: number; lng: number };
  points: Point[];
  position: Position | null;
  destination: Point | null;
  routePoints?: Array<{ lat: number; lng: number }>;
  onSelect: (point: Point) => void;
};

export function IndoorMap({ center, points, position, destination, routePoints = [], onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const routeRef = useRef<Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !hostRef.current) return;
      if (mapRef.current) mapRef.current.remove();
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 18);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "© OpenStreetMap contributors" }).addTo(map);
      points.forEach((point) => {
        const marker = L.circleMarker([point.lat, point.lng], { radius: 7, weight: 2, fillOpacity: .9 }).addTo(map);
        marker.bindTooltip(`${point.name}${point.level ? ` · Piano ${point.level}` : ""}`);
        marker.on("click", () => onSelect(point));
      });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 100);
    });
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [center.lat, center.lng, points, onSelect]);

  useEffect(() => {
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map || !position) return;
      userMarkerRef.current?.remove();
      userMarkerRef.current = L.marker([position.lat, position.lng]).addTo(map).bindTooltip("Tu sei qui", { permanent: false });
      if (!destination) map.panTo([position.lat, position.lng]);
    });
  }, [position, destination]);

  useEffect(() => {
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      routeRef.current?.remove();
      routeRef.current = null;
      if (!map || !position || !destination) return;
      const line = routePoints.length >= 2 ? routePoints : [position, destination];
      routeRef.current = L.polyline(line.map((point) => [point.lat, point.lng] as [number, number]), { weight: 5, dashArray: "9 7" }).addTo(map);
      map.fitBounds(line.map((point) => [point.lat, point.lng] as [number, number]), { padding: [45, 45], maxZoom: 19 });
    });
  }, [position, destination, routePoints]);

  return <div className="indoor-map" ref={hostRef} aria-label="Mappa interna con posizione, destinazione e percorso" />;
}
