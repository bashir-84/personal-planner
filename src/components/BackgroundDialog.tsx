"use client";

import { ChangeEvent, useState } from "react";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export type BackgroundSettings = { src: string; blur: number; darkness: number };

export function BackgroundDialog({ initial, onApply, onClose, onClear }: {
  initial: BackgroundSettings | null;
  onApply: (settings: BackgroundSettings) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const [source, setSource] = useState(initial?.src ?? "");
  const [link, setLink] = useState(initial?.src && !initial.src.startsWith("data:") ? initial.src : "");
  const [blur, setBlur] = useState(initial?.blur ?? 5);
  const [darkness, setDarkness] = useState(initial?.darkness ?? 28);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Choose an image file."); return; }
    if (file.size > 15 * 1024 * 1024) { setMessage("Image must be smaller than 15 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const optimized = await optimizeImage(file);
      if (optimized.length > 2_800_000) throw new Error("This image is too large after compression. Choose a smaller image.");
      setSource(optimized); setLink("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this image.");
    } finally { setBusy(false); event.target.value = ""; }
  }

  function updateLink(value: string) {
    setLink(value); setMessage("");
    if (!value.trim()) { setSource(""); return; }
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      if (url.hostname === "unsplash.com" && url.pathname.startsWith("/photos/")) {
        const photoId = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
        if (photoId) {
          setSource(`https://unsplash.com/photos/${photoId}/download?force=true&w=1920`);
          return;
        }
      }
      setSource(url.href);
    } catch { setSource(""); }
  }

  return <Modal label="Background settings" onClose={onClose}>
    <section className="draft backgroundDialog">
      <div className="draftHead"><div><span className="eyebrow">Personalize</span><h2>Background</h2></div>
        <button className="iconButton" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="backgroundInputs">
        <label className="backgroundUpload"><span>Upload background</span><input type="file" accept="image/*" onChange={upload} />{busy && <small>Optimizing…</small>}</label>
        <label className="backgroundLink"><span>Background link</span><input type="url" dir="ltr" inputMode="url" placeholder="https://…" value={link} onChange={event => updateLink(event.target.value)} /></label>
      </div>
      {message && <p className="backgroundMessage" role="alert">{message}</p>}
      <div className="backgroundSliders">
        <label><span>Blur <b>{blur}px</b></span><input type="range" min="0" max="20" step="1" value={blur} onChange={event => setBlur(Number(event.target.value))} /></label>
        <label><span>Darkness <b>{darkness}%</b></span><input type="range" min="0" max="80" step="1" value={darkness} onChange={event => setDarkness(Number(event.target.value))} /></label>
      </div>
      <div className="backgroundPreviewWrap"><span className="backgroundPreviewLabel">Preview</span>
        <div className="backgroundPreview" style={{ "--preview-blur": `${blur}px`, "--preview-darkness": `${darkness / 100}` } as React.CSSProperties}>
      {source ? <img className="backgroundPreviewImage" src={source} alt="" onError={() => setMessage("This link did not load an image. Try a direct image link.")} /> : <div className="backgroundPreviewPlaceholder">Choose an image to preview</div>}
          <div className="backgroundPreviewShade" />
          <div className="backgroundPreviewSample"><strong>Personal Planner</strong><span>Background preview</span></div>
        </div>
      </div>
      <div className="backgroundActions">
        {initial && <button type="button" className="backgroundClear" onClick={onClear}>Remove background</button>}
        <button type="button" className="primary" disabled={!source || busy} onClick={() => {
          try { onApply({ src: source, blur, darkness }); onClose(); }
          catch { setMessage("Could not save this background. Try a smaller image."); }
        }}>Confirm</button>
      </div>
    </section>
  </Modal>;
}

async function optimizeImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / image.width, 1280 / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/webp", 0.8);
}
