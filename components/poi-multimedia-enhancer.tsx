"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Images, LoaderCircle, Newspaper, Video } from "lucide-react";

type ImageItem = { url: string; originalUrl?: string; title?: string; author?: string; license?: string; sourceUrl?: string };
type VideoItem = { id: string; title: string; channel?: string };
type SourceItem = { title: string; url: string; kind?: string };
type FactItem = { label: string; value: string };
type PoiDetails = {
  title: string;
  summary?: string;
  description?: string;
  images?: ImageItem[];
  videos?: VideoItem[];
  youtubeConfigured?: boolean;
  facts?: FactItem[];
  officialWebsite?: string;
  sources?: SourceItem[];
};

type ActivePoi = { title: string; lat?: number; lng?: number; host: HTMLElement };

export function PoiMultimediaEnhancer() {
  const [active, setActive] = useState<ActivePoi | null>(null);
  const [details, setDetails] = useState<PoiDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let frame = 0;
    const detect = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sheets = Array.from(document.querySelectorAll<HTMLElement>(".place-sheet"));
        const sheet = sheets.find((candidate) => candidate.dataset.state === "open")
          ?? sheets.find((candidate) => candidate.getClientRects().length > 0);
        if (!sheet) {
          setActive(null);
          return;
        }
        const title = sheet.dataset.poiTitle?.trim()
          || sheet.querySelector<HTMLElement>("[data-slot='sheet-title'], h2")?.textContent?.trim();
        const host = sheet.querySelector<HTMLElement>("[data-poi-multimedia-host]");
        if (!title || !host) return;

        const nav = sheet.querySelector<HTMLAnchorElement>('a[href*="destination="]');
        let lat = Number(sheet.dataset.poiLat);
        let lng = Number(sheet.dataset.poiLng);
        if (!Number.isFinite(lat)) lat = NaN;
        if (!Number.isFinite(lng)) lng = NaN;
        if (nav) {
          try {
            const destination = new URL(nav.href).searchParams.get("destination")?.split(",");
            if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && destination?.length === 2) {
              const a = Number(destination[0]);
              const b = Number(destination[1]);
              if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
            }
          } catch {}
        }

        setActive((current) => current?.title === title && current.host === host
          ? current
          : { title, lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined, host });
      });
    };

    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ title: active.title });
    if (Number.isFinite(active.lat)) params.set("lat", String(active.lat));
    if (Number.isFinite(active.lng)) params.set("lng", String(active.lng));

    Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      setLoading(true);
      setDetails(null);
      return fetch(`/.netlify/functions/poi-details?${params}`, { signal: controller.signal });
    })
      .then((response) => response ? (response.ok ? response.json() : Promise.reject(new Error("details"))) : null)
      .then((data) => { if (data) setDetails(data); })
      .catch((error) => { if (error?.name !== "AbortError") setDetails(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active]);

  const youtubeSearch = useMemo(() => active ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${active.title} guida turistica storia`)}` : "", [active]);
  if (!active) return null;

  return createPortal(
    <section className="multisource-panel" aria-label="Approfondimenti multimediali">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Newspaper size={20} aria-hidden="true" />
        <div><strong style={{ display: "block", fontSize: 17 }}>Racconto da più fonti</strong><span style={{ opacity: .72, fontSize: 13 }}>Wikipedia, Wikidata, Wikimedia Commons, OpenStreetMap e sito ufficiale quando disponibile</span></div>
      </div>

      {loading && <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: .75 }}><LoaderCircle className="spin" size={18} /> Cerco contenuti affidabili…</div>}

      {details?.description && <p className="source-description">{details.description}</p>}
      {details?.summary && <details className="source-story" open><summary>Storia e contesto</summary><p>{details.summary}</p></details>}
      {details?.facts && details.facts.length > 0 && <div><strong className="subsection-title">Dati incrociati</strong><div className="source-facts">{details.facts.map((fact) => <div key={`${fact.label}-${fact.value}`}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</div></div>}

      {details?.images && details.images.length > 0 && <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 9 }}><Images size={18} /><strong>Fotografie documentarie</strong><small style={{ opacity: .65 }}> · Wikimedia Commons</small></div>
        <div className="source-gallery">
          {details.images.slice(0, 8).map((image, index) => <a key={`${image.url}-${index}`} href={image.sourceUrl || image.originalUrl || image.url} target="_blank" rel="noreferrer" className={index === 0 ? "featured" : ""}>
            <img src={image.url} alt={image.title || `Foto di ${active.title}`} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", aspectRatio: index === 0 ? "16 / 10" : "4 / 3", objectFit: "cover", borderRadius: 12, display: "block" }} />
            <small style={{ display: "block", marginTop: 4, opacity: .65, lineHeight: 1.25 }}>{image.author || "Wikimedia Commons"}{image.license ? ` · ${image.license}` : ""}</small>
          </a>)}
        </div>
      </div>}

      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 9 }}><Video size={18} /><strong>Video YouTube</strong></div>
        {details?.videos && details.videos.length > 0 ? <div style={{ display: "grid", gap: 12 }}>
          {details.videos.slice(0, 3).map((video) => <div key={video.id}><div style={{ position: "relative", paddingTop: "56.25%", overflow: "hidden", borderRadius: 12, background: "#000" }}><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}`} title={video.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div><small style={{ display: "block", marginTop: 5, opacity: .7 }}>{video.title}{video.channel ? ` · ${video.channel}` : ""}</small></div>)}
        </div> : !loading && <a href={youtubeSearch} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>Cerca video su YouTube <ExternalLink size={15} /></a>}
      </div>

      {details?.sources && details.sources.length > 0 && <div>
        <strong style={{ display: "block", marginBottom: 7 }}>Fonti consultate</strong>
        <div style={{ display: "grid", gap: 7 }}>{details.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", color: "inherit", textDecoration: "none", padding: "10px 12px", borderRadius: 11, background: "rgba(120,120,120,.08)" }}><span><strong style={{ display: "block" }}>{source.title}</strong>{source.kind && <small style={{ opacity: .62 }}>{source.kind}</small>}</span><ExternalLink size={15} /></a>)}</div>
      </div>}

      {details?.officialWebsite && <a href={details.officialWebsite} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>Sito ufficiale <ExternalLink size={15} /></a>}
    </section>,
    active.host,
  );
}
