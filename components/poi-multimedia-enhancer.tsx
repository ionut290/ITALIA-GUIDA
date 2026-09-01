"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, CalendarClock, ExternalLink, Images, LoaderCircle, Mail, Newspaper, Phone, Share2, Ticket, Video, X, ZoomIn } from "lucide-react";

type ImageItem = { url: string; originalUrl?: string; title?: string; author?: string; license?: string; sourceUrl?: string; taggedVargaTour?: boolean };
type VideoItem = { id: string; title: string; channel?: string; taggedVargaTour?: boolean };
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
  taggedVargaTour?: boolean;
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
  operational?: {
    openingHours?: string;
    openingHoursSource?: string;
    bookingUrl?: string;
    bookingMode?: string;
    reservationRequired?: boolean;
    phone?: string;
    email?: string;
    priceInfo?: string;
    wheelchair?: string;
    operator?: string;
    sourceUrl?: string;
  };
  officialMedia?: {
    managerName?: string;
    sourceUrl?: string;
    images?: Array<{ url: string; sourceUrl?: string; title?: string }>;
    videos?: Array<{ url: string; title: string; embedType?: string; embedId?: string }>;
    socialMedia?: SocialItem[];
  };
  sources?: SourceItem[];
  socialMedia?: SocialItem[];
};

type ActivePoi = { title: string; lat?: number; lng?: number; host: HTMLElement };
type PreviewPhoto = { src: string; alt: string };

const OSM_DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

function openingState(raw?: string) {
  const value = String(raw || "").trim();
  if (!value) return { tone: "unknown", label: "Orari non pubblicati", detail: "Controlla sempre il sito ufficiale prima della visita." };
  if (value === "24/7") return { tone: "open", label: "Aperto 24 ore su 24", detail: "Orario dichiarato: 24/7" };
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let understood = false;
  let appliesToday = false;
  let openNow = false;
  for (const rule of value.split(";")) {
    const match = rule.trim().match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
    if (!match) continue;
    const days = new Set<number>();
    for (const token of match[1].split(",")) {
      const [from, to] = token.split("-");
      const start = OSM_DAYS[from];
      const end = OSM_DAYS[to || from];
      if (start === undefined || end === undefined) continue;
      for (let index = start; ; index = (index + 1) % 7) { days.add(index); if (index === end) break; }
    }
    understood = true;
    if (!days.has(currentDay)) continue;
    appliesToday = true;
    if (/\boff\b/i.test(match[2])) continue;
    for (const interval of match[2].split(",")) {
      const hours = interval.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
      if (!hours) continue;
      const start = Number(hours[1]) * 60 + Number(hours[2]);
      const end = Number(hours[3]) * 60 + Number(hours[4]);
      if ((end >= start && currentMinutes >= start && currentMinutes < end) || (end < start && (currentMinutes >= start || currentMinutes < end))) openNow = true;
    }
  }
  if (!understood) return { tone: "unknown", label: "Orari disponibili", detail: value };
  if (openNow) return { tone: "open", label: "Probabilmente aperto ora", detail: value };
  if (appliesToday) return { tone: "closed", label: "Probabilmente chiuso ora", detail: value };
  return { tone: "closed", label: "Chiuso oggi secondo gli orari", detail: value };
}

export function PoiMultimediaEnhancer() {
  const [active, setActive] = useState<ActivePoi | null>(null);
  const [details, setDetails] = useState<PoiDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ photos: PreviewPhoto[]; index: number } | null>(null);
  const [videoLimit, setVideoLimit] = useState(6);
  const [socialLimit, setSocialLimit] = useState(4);

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
  const embeddedSocials = useMemo(() => socialMedia.filter((item) => item.embedType && item.embedId), [socialMedia]);
  const visibleEmbeddedSocials = useMemo(() => embeddedSocials.slice(0, socialLimit), [embeddedSocials, socialLimit]);
  const visitStatus = useMemo(() => openingState(details?.operational?.openingHours), [details?.operational?.openingHours]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setPreview(null); setVideoLimit(6); setSocialLimit(4); });
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
    if (!visibleEmbeddedSocials.length) return;
    const needsTikTok = visibleEmbeddedSocials.some((item) => item.embedType === "tiktok-profile");
    const needsInstagram = visibleEmbeddedSocials.some((item) => item.embedType === "instagram-post");
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
  }, [visibleEmbeddedSocials]);

  if (!active) return null;

  return <>
    {createPortal(
      <section className="multisource-panel" aria-label="Foto, video e approfondimenti">
        {!loading && <section className="visit-planner" aria-label="Orari e prenotazione">
          <div className="visit-planner-heading">
            <CalendarClock size={22} />
            <div><strong>Organizza la visita</strong><span>Orari, ingresso e prenotazione dalla fonte più affidabile disponibile</span></div>
            <span className={`open-state ${visitStatus.tone}`}>{visitStatus.label}</span>
          </div>
          <div className="visit-data-grid">
            <div><small>Orari dichiarati</small><strong>{visitStatus.detail}</strong>{details?.operational?.openingHoursSource && <a href={details.operational.openingHoursSource} target="_blank" rel="noreferrer">Verifica fonte <ExternalLink size={12} /></a>}</div>
            <div><small>Ingresso</small><strong>{details?.operational?.priceInfo || "Prezzi non pubblicati"}</strong></div>
            <div><small>Prenotazione</small><strong>{details?.operational?.bookingMode || "Verifica con il gestore"}</strong>{details?.operational?.reservationRequired && <span className="required-booking">Prenotazione richiesta</span>}</div>
            <div><small>Gestore</small><strong>{details?.operational?.operator || details?.officialMedia?.managerName || "Informazione non disponibile"}</strong></div>
          </div>
          <div className="visit-actions">
            {details?.operational?.bookingUrl && <a className="booking-action" href={details.operational.bookingUrl} target="_blank" rel="noreferrer"><Ticket size={17} /> Prenota sul sito ufficiale <ExternalLink size={14} /></a>}
            {details?.operational?.phone && <a href={`tel:${details.operational.phone.replace(/[^+\d]/g, "")}`}><Phone size={16} /> Chiama</a>}
            {details?.operational?.email && <a href={`mailto:${details.operational.email}`}><Mail size={16} /> Scrivi</a>}
            {details?.officialWebsite && <a href={details.officialWebsite} target="_blank" rel="noreferrer">Sito ufficiale <ExternalLink size={14} /></a>}
          </div>
          <p className="hours-disclaimer">Gli orari possono cambiare per festività, eventi o lavori. Prima di partire controlla sempre la fonte ufficiale.</p>
        </section>}

        {!loading && details?.officialMedia && ((details.officialMedia.images?.length || 0) > 0 || (details.officialMedia.videos?.length || 0) > 0 || (details.officialMedia.socialMedia?.length || 0) > 0) && <section className="official-manager-panel">
          <div className="official-manager-heading"><BadgeCheck size={22} /><div><strong>Pubblicato dal gestore</strong><span>Contenuti provenienti dal sito o dai canali ufficiali di {details.officialMedia.managerName || active.title}</span></div></div>
          {details.officialMedia.images && details.officialMedia.images.length > 0 && <div className="official-manager-gallery">{details.officialMedia.images.map((item, index) => <a key={`${item.url}-${index}`} href={item.sourceUrl || item.url} target="_blank" rel="noreferrer"><span className="official-content-badge"><BadgeCheck size={12} /> Fonte ufficiale</span><span className="photo-open-hint" data-open-photo><ZoomIn size={14} /> Apri</span><img data-full-image={item.url} src={item.url} alt={item.title || `Foto ufficiale di ${active.title}`} loading="lazy" referrerPolicy="no-referrer" /></a>)}</div>}
          {details.officialMedia.videos && details.officialMedia.videos.length > 0 && <div className="official-video-grid">{details.officialMedia.videos.map((item, index) => <div key={`${item.url}-${index}`} className="official-video-card">
            {item.embedType === "youtube" && item.embedId ? <iframe src={`https://www.youtube-nocookie.com/embed/${item.embedId}?playsinline=1`} title={item.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : item.embedType === "tiktok-video" && item.embedId ? <iframe src={`https://www.tiktok.com/player/v1/${item.embedId}`} title={item.title} loading="lazy" allow="fullscreen; autoplay" allowFullScreen /> : <a href={item.url} target="_blank" rel="noreferrer"><Video size={20} /> Guarda il video ufficiale <ExternalLink size={14} /></a>}
          </div>)}</div>}
          {details.officialMedia.socialMedia && details.officialMedia.socialMedia.length > 0 && <div className="official-social-links">{details.officialMedia.socialMedia.map((item) => <a key={`${item.platform}-${item.url}`} href={item.url} target="_blank" rel="noreferrer"><BadgeCheck size={14} /> {item.platform} ufficiale <ExternalLink size={12} /></a>)}</div>}
        </section>}

        {!loading && <details className="manager-contribute"><summary><BadgeCheck size={17} /> Sei il gestore di questo luogo?</summary><div><strong>Pubblica informazioni e contenuti ufficiali</strong><p>Invia orari, link di prenotazione, sito, foto e video. Prima della pubblicazione Varga Tour verifica che la richiesta provenga dal gestore.</p><form name="manager-content" method="POST" data-netlify="true" data-netlify-honeypot="website-check" action="/?gestore=inviato"><input type="hidden" name="form-name" value="manager-content" /><input type="hidden" name="luogo" value={active.title} /><input type="hidden" name="coordinate" value={`${active.lat || ""},${active.lng || ""}`} /><input className="hidden-honeypot" name="website-check" tabIndex={-1} autoComplete="off" /><label>Email ufficiale<input required type="email" name="email" placeholder="nome@sito-ufficiale.it" /></label><label>Sito o pagina ufficiale<input required type="url" name="sito-ufficiale" placeholder="https://…" /></label><label>Link prenotazione<input type="url" name="prenotazione" placeholder="https://…" /></label><label>Orari di apertura<input name="orari" placeholder="Es. lun–ven 09:00–18:00" /></label><label>Foto o video pubblicati dal gestore<textarea name="media-ufficiali" rows={3} placeholder="Incolla uno o più link ufficiali" /></label><button type="submit"><BadgeCheck size={16} /> Invia per la verifica</button></form></div></details>}

        <div className="multisource-heading">
          <Images size={20} aria-hidden="true" />
          <div><strong>Foto e video del luogo</strong><span>Contenuti incorporati in Varga Tour e fonti sempre riconoscibili</span></div>
        </div>

        {loading && <div className="multisource-loading"><LoaderCircle className="spin" size={18} /> Carico foto e video…</div>}

        {details?.images && details.images.length > 0 && <div>
          <div className="media-section-title"><Images size={18} /><strong>Galleria fotografica</strong><small> · {details.images.length} foto · tocca per ingrandire</small></div>
          <div className="source-gallery">
            {details.images.map((image, index) => <a key={`${image.url}-${index}`} href={image.sourceUrl || image.originalUrl || image.url} target="_blank" rel="noreferrer" className={index === 0 ? "featured" : ""}>
              {image.taggedVargaTour && <span className="varga-priority-badge">★ Varga Tour</span>}
              <span className="photo-open-hint" data-open-photo><ZoomIn size={14} /> Apri</span>
              <img data-full-image={image.originalUrl || image.url} src={image.url} alt={image.title || `Foto di ${active.title}`} loading="lazy" referrerPolicy="no-referrer" />
              <small>{image.author || "Wikimedia Commons"}{image.license ? ` · ${image.license}` : ""}</small>
            </a>)}
          </div>
        </div>}

        <div>
          <div className="media-section-title"><Video size={18} /><strong>Video incorporati</strong>{details?.videos?.length ? <small> · {details.videos.length} risultati</small> : null}</div>
          {details?.videos && details.videos.length > 0 ? <div className="embedded-video-grid">
            {details.videos.slice(0, videoLimit).map((video) => <div key={video.id} className="embedded-video-card">{video.taggedVargaTour && <span className="varga-video-badge">★ Priorità Varga Tour</span>}<div className="embedded-video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1`} title={video.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><small>{video.title}{video.channel ? ` · ${video.channel}` : ""}</small></div>)}
            {details.videos.length > videoLimit && <button type="button" className="load-more-media" onClick={() => setVideoLimit((limit) => Math.min(limit + 6, details.videos?.length || limit))}>Mostra altri video</button>}
          </div> : !loading && <a href={socialFallback[0]?.url} target="_blank" rel="noreferrer" className="external-media-search">Cerca video su YouTube <ExternalLink size={15} /></a>}
        </div>

        {embeddedSocials.length > 0 && <div>
          <div className="media-section-title"><Share2 size={18} /><strong>Contenuti dai social</strong><small> · incorporati dalla fonte originale</small></div>
          <div className="social-embed-grid">
            {visibleEmbeddedSocials.map((item) => <div className="social-embed-card" key={`${item.embedType}-${item.embedId}`}>
              {item.taggedVargaTour && <span className="varga-video-badge">★ Priorità Varga Tour</span>}
              {item.embedType === "youtube" && <iframe className="social-video-landscape" src={`https://www.youtube-nocookie.com/embed/${item.embedId}?playsinline=1`} title={item.title} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
              {item.embedType === "tiktok-video" && <iframe className="social-video-portrait" src={`https://www.tiktok.com/player/v1/${item.embedId}`} title={item.title} loading="lazy" allow="fullscreen; autoplay" allowFullScreen />}
              {item.embedType === "tiktok-profile" && <blockquote className="tiktok-embed" cite={item.url} data-unique-id={item.embedId} data-embed-type="creator"><section><a href={item.url} target="_blank" rel="noreferrer">{item.handle || `@${item.embedId}`}</a></section></blockquote>}
              {item.embedType === "instagram-post" && <blockquote className="instagram-media" data-instgrm-permalink={item.url} data-instgrm-version="14"><a href={item.url} target="_blank" rel="noreferrer">Guarda il contenuto su Instagram</a></blockquote>}
              <a className="social-embed-source" href={item.url} target="_blank" rel="noreferrer">{item.platform} · fonte originale <ExternalLink size={13} /></a>
            </div>)}
            {embeddedSocials.length > socialLimit && <button type="button" className="load-more-media" onClick={() => setSocialLimit((limit) => Math.min(limit + 4, embeddedSocials.length))}>Mostra altri contenuti social</button>}
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
