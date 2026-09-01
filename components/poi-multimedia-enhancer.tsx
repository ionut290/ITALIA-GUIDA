"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Images, LoaderCircle, Newspaper, Share2, Video, X, ZoomIn } from "lucide-react";

type ImageItem = { url: string; originalUrl?: string; title?: string; author?: string; license?: string; sourceUrl?: string };
type VideoItem = { id: string; title: string; channel?: string };
type SourceItem = { title: string; url: string; kind?: string };
type FactItem = { label: string; value: string };
type SocialItem = {
  platform: "YouTube" | "Instagram" | "TikTok" | "Facebook" | "X" | "Flickr";
  title: string;
  url: string;
  handle?: string;
  kind?: "official" | "linked" | "search";
  embedType?: "youtube" | "tiktok-video" | "tiktok-profile" | "instagram-post";
  embedId?: string;
};
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
  socialMedia?: SocialItem[];
};

type ActivePoi = { title: string; lat?: number; lng?: number; host: HTMLElement };
type PreviewPhoto = { src: string; alt: string };

export function PoiMultimediaEnhancer() {
  const [active, setActive] = useState<ActivePoi | null>(null);
  const [details, setDetails] = useState<PoiDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ photos: PreviewPhoto[]; index: number } | null>(null);

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

  const socialFallback = useMemo<SocialItem[]>(() => active ? [
    { platform: "YouTube", title: "Cerca video del luogo", url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${active.title} guida turistica storia`)}`, kind: "search" },
    { platform: "TikTok", title: "Cerca video del luogo", url: `https://www.tiktok.com/search?q=${encodeURIComponent(`${active.title} Italia`)}`, kind: "search" },
    { platform: "Instagram", title: "Cerca foto e Reel", url: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(active.title)}`, kind: "search" },
  ] : [], [active]);
  const socialMedia = details?.socialMedia?.length ? details.socialMedia : socialFallback;
  const embeddedSocials = useMemo(() => socialMedia.filter((item) => item.embedType && item.embedId).slice(0, 3), [socialMedia]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPreview(null));
    return () => cancelAnimationFrame(frame);
  }, [active?.title]);

  useEffect(() => {
    const openPhoto = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const hintedPhoto = target?.closest<HTMLElement>("[data-open-photo]");
      const hintedContainer = hintedPhoto?.closest<HTMLElement>(".guide-gallery, .source-gallery a");
      const image = hintedContainer?.querySelector<HTMLImageElement>("img")
        ?? target?.closest<HTMLImageElement>(".place-sheet .guide-gallery img, .place-sheet .source-gallery img");
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      const sheet = image.closest<HTMLElement>(".place-sheet");
      const clickedSrc = image.dataset.fullImage || image.currentSrc || image.src;
      const seen = new Set<string>();
      const photos = Array.from(sheet?.querySelectorAll<HTMLImageElement>(".guide-gallery img, .source-gallery img") || [])
        .map((item) => ({ src: item.dataset.fullImage || item.currentSrc || item.src, alt: item.alt || "Fotografia del luogo" }))
        .filter((item) => item.src && !seen.has(item.src) && seen.add(item.src));
      const index = Math.max(0, photos.findIndex((item) => item.src === clickedSrc));
      setPreview({ photos: photos.length ? photos : [{ src: clickedSrc, alt: image.alt || "Fotografia del luogo" }], index });
    };
    document.addEventListener("click", openPhoto, true);
    return () => document.removeEventListener("click", openPhoto, true);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", closeOnEscape);
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-lightbox-index="${preview.index}"]`)?.scrollIntoView({ block: "start" });
    });
    return () => { document.removeEventListener("keydown", closeOnEscape); cancelAnimationFrame(frame); };
  }, [preview]);

  useEffect(() => {
    if (!embeddedSocials.length) return;
    const needsTikTok = embeddedSocials.some((item) => item.embedType === "tiktok-profile");
    const needsInstagram = embeddedSocials.some((item) => item.embedType === "instagram-post");
    const timers: number[] = [];
    if (needsTikTok) {
      timers.push(window.setTimeout(() => {
        document.querySelector("script[data-varga-tiktok-embed]")?.remove();
        const script = document.createElement("script");
        script.src = "https://www.tiktok.com/embed.js";
        script.async = true;
        script.dataset.vargaTiktokEmbed = "true";
        document.body.appendChild(script);
      }, 0));
    }
    if (needsInstagram) {
      timers.push(window.setTimeout(() => {
        const instagram = (window as Window & { instgrm?: { Embeds?: { process: () => void } } }).instgrm;
        if (instagram?.Embeds?.process) { instagram.Embeds.process(); return; }
        if (document.querySelector("script[data-varga-instagram-embed]")) return;
        const script = document.createElement("script");
        script.src = "https://www.instagram.com/embed.js";
        script.async = true;
        script.dataset.vargaInstagramEmbed = "true";
        document.body.appendChild(script);
      }, 0));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [embeddedSocials]);

  if (!active) return null;

  return <>
    {createPortal(
      <section className="multisource-panel" aria-label="Foto, video e approfondimenti">
        <div className="multisource-heading">
          <Images size={20} aria-hidden="true" />
          <div><strong>Foto e video del luogo</strong><span>Contenuti incorporati in Varga Tour e fonti sempre riconoscibili</span></div>
        </div>

        {loading && <div className="multisource-loading"><LoaderCircle className="spin" size={18} /> Carico foto e video…</div>}

        {details?.images && details.images.length > 0 && <div>
          <div className="media-section-title"><Images size={18} /><strong>Galleria fotografica</strong><small> · tocca una foto per ingrandirla</small></div>
          <div className="source-gallery">
            {details.images.slice(0, 8).map((image, index) => <a key={`${image.url}-${index}`} href={image.sourceUrl || image.originalUrl || image.url} target="_blank" rel="noreferrer" className={index === 0 ? "featured" : ""}>
              <span className="photo-open-hint" data-open-photo><ZoomIn size={14} /> Apri</span>
              <img data-full-image={image.originalUrl || image.url} src={image.url} alt={image.title || `Foto di ${active.title}`} loading="lazy" referrerPolicy="no-referrer" />
              <small>{image.author || "Wikimedia Commons"}{image.license ? ` · ${image.license}` : ""}</small>
            </a>)}
          </div>
        </div>}

        <div>
          <div className="media-section-title"><Video size={18} /><strong>Video incorporati</strong></div>
          {details?.videos && details.videos.length > 0 ? <div className="embedded-video-grid">
            {details.videos.slice(0, 3).map((video) => <div key={video.id} className="embedded-video-card"><div className="embedded-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1`} title={video.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><small>{video.title}{video.channel ? ` · ${video.channel}` : ""}</small></div>)}
          </div> : !loading && <a href={socialFallback[0]?.url} target="_blank" rel="noreferrer" className="external-media-search">Cerca video su YouTube <ExternalLink size={15} /></a>}
        </div>

        {embeddedSocials.length > 0 && <div>
          <div className="media-section-title"><Share2 size={18} /><strong>Contenuti dai social</strong><small> · incorporati dalla fonte originale</small></div>
          <div className="social-embed-grid">
            {embeddedSocials.map((item) => <div className="social-embed-card" key={`${item.embedType}-${item.embedId}`}>
              {item.embedType === "youtube" && <iframe className="social-video-landscape" src={`https://www.youtube-nocookie.com/embed/${item.embedId}?playsinline=1`} title={item.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
              {item.embedType === "tiktok-video" && <iframe className="social-video-portrait" src={`https://www.tiktok.com/player/v1/${item.embedId}`} title={item.title} loading="lazy" allow="fullscreen; autoplay" allowFullScreen />}
              {item.embedType === "tiktok-profile" && <blockquote className="tiktok-embed" cite={item.url} data-unique-id={item.embedId} data-embed-type="creator"><section><a href={item.url} target="_blank" rel="noreferrer">{item.handle || `@${item.embedId}`}</a></section></blockquote>}
              {item.embedType === "instagram-post" && <blockquote className="instagram-media" data-instgrm-permalink={item.url} data-instgrm-version="14"><a href={item.url} target="_blank" rel="noreferrer">Guarda il contenuto su Instagram</a></blockquote>}
              <a className="social-embed-source" href={item.url} target="_blank" rel="noreferrer">{item.platform} · fonte originale <ExternalLink size={13} /></a>
            </div>)}
          </div>
        </div>}

        <div className="multisource-heading story-heading">
          <Newspaper size={20} aria-hidden="true" />
          <div><strong>Storia e informazioni</strong><span>Wikipedia, Wikidata, OpenStreetMap e fonti ufficiali</span></div>
        </div>
        {details?.description && <p className="source-description">{details.description}</p>}
        {details?.summary && <details className="source-story" open><summary>Storia e contesto</summary><p>{details.summary}</p></details>}
        {details?.facts && details.facts.length > 0 && <div><strong className="subsection-title">Dati incrociati</strong><div className="source-facts">{details.facts.map((fact) => <div key={`${fact.label}-${fact.value}`}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</div></div>}

        {!loading && socialMedia.length > 0 && <div>
          <div className="media-section-title"><Share2 size={18} /><strong>Altri contenuti social</strong></div>
          <p className="social-source-note">Gli account ufficiali vengono mostrati per primi. Le ricerche esterne servono quando la piattaforma non consente l’incorporamento automatico.</p>
          <div className="social-source-grid">
            {socialMedia.map((item) => <a key={`${item.platform}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" data-platform={item.platform.toLowerCase()}>
              <span className="social-source-mark" aria-hidden="true">{item.platform.slice(0, 1)}</span>
              <span className="social-source-copy"><strong>{item.title}</strong><small>{item.platform}{item.handle ? ` · ${item.handle}` : item.kind === "official" ? " · account ufficiale" : item.kind === "linked" ? " · fonte collegata" : " · ricerca esterna"}</small></span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>)}
          </div>
        </div>}

        {details?.sources && details.sources.length > 0 && <div>
          <strong className="subsection-title">Fonti consultate</strong>
          <div className="consulted-source-grid">{details.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong>{source.kind && <small>{source.kind}</small>}</span><ExternalLink size={15} /></a>)}</div>
        </div>}

        {details?.officialWebsite && <a href={details.officialWebsite} target="_blank" rel="noreferrer" className="external-media-search">Sito ufficiale <ExternalLink size={15} /></a>}
      </section>,
      active.host,
    )}
    {preview && createPortal(
      <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Galleria fotografica a schermo intero">
        <div className="photo-lightbox-toolbar">
          <strong>{preview.photos.length} {preview.photos.length === 1 ? "foto" : "foto"}</strong>
          <button
            type="button"
            className="photo-lightbox-close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); setPreview(null); }}
          ><X size={20} /> Chiudi</button>
        </div>
        <div className="photo-lightbox-scroll">
          {preview.photos.map((photo, index) => <figure key={`${photo.src}-${index}`} data-lightbox-index={index}>
            <img src={photo.src} alt={photo.alt} loading={index === preview.index ? "eager" : "lazy"} referrerPolicy="no-referrer" />
            <figcaption>{index + 1} / {preview.photos.length} · {photo.alt}</figcaption>
          </figure>)}
        </div>
      </div>,
      active.host.closest(".place-sheet") || active.host,
    )}
  </>;
}
