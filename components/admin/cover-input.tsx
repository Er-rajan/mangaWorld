"use client";

import { ImagePlus, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Art } from "@/components/art";
import { adminRequest, coverFrame, decodeImage, defaultCrop, drawCover, prepareCover, uploadArtwork } from "@/lib/upload";
import { artworkSpecs, undersized, type Artwork, type ArtworkKind } from "@/lib/artwork";
import { artUrl } from "@/lib/format";

export function CoverInput({ value, onChange, onBusy, disabled, label = "Cover image", kind = "cover" }: {
  value: string | null; onChange: (value: string | null) => void; onBusy: (busy: boolean) => void; disabled: boolean;
  label?: string; kind?: ArtworkKind;
}) {
  const [image, setImage] = useState<ImageBitmap>();
  const [name, setName] = useState("");
  const [crop, setCrop] = useState(defaultCrop);
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reused, setReused] = useState<string>();
  const [details, setDetails] = useState<Artwork | null>();
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const target = artworkSpecs[kind];
  const noun = kind === "hero" ? "hero banner" : "cover";
  const frame = image && coverFrame(image, crop, kind);
  const small = frame && undersized(kind, Math.floor(frame.width), Math.floor(frame.height));
  const uploadSource = value && !value.startsWith("/") ? value : undefined;

  useEffect(() => {
    if (image && preview.current) drawCover(preview.current, image, crop, kind);
  }, [image, crop, kind]);
  useEffect(() => () => image?.close(), [image]);
  useEffect(() => {
    let active = true;
    setDetails(undefined);
    if (uploadSource) void adminRequest<{ artwork: Artwork | null }>({ action: "artwork-info", id: uploadSource })
      .then((result) => { if (active) setDetails(result.artwork); }).catch(() => {});
    return () => { active = false; };
  }, [uploadSource]);

  function close() {
    dialog.current?.close();
    setImage(undefined);
    setProgress(undefined);
  }

  async function fromMaster(adjust: boolean) {
    if (!uploadSource) return;
    onBusy(true);
    setError("");
    setMessage("");
    let bitmap: ImageBitmap | undefined;
    try {
      const response = await fetch(artUrl(uploadSource, "master", true));
      if (!response.ok) throw new Error("Couldn’t open the saved source. Choose a new image.");
      bitmap = await createImageBitmap(await response.blob());
      const savedDetails = details === undefined
        ? (await adminRequest<{ artwork: Artwork | null }>({ action: "artwork-info", id: uploadSource })).artwork : details;
      const savedCrop = savedDetails?.crop ?? defaultCrop;
      if (adjust) {
        setCrop(savedCrop);
        setName("saved-artwork.webp");
        setReused(uploadSource);
        setImage(bitmap);
        bitmap = undefined;
        dialog.current?.showModal();
      } else {
        setProgress(0);
        const prepared = await prepareCover(bitmap, savedCrop, "saved-artwork.webp", kind, uploadSource);
        if (savedDetails && prepared.width < savedDetails.width) {
          throw new Error("The saved master cannot reproduce the current crop at its full resolution. Adjust the focal point or choose a larger source.");
        }
        const result = await uploadArtwork(prepared, setProgress);
        onChange(result.asset_id);
        setMessage(undersized(kind, prepared.width, prepared.height)
          ? `Versions regenerated at ${prepared.width} × ${prepared.height}. Choose a higher-resolution source for the recommended size.`
          : "Versions regenerated. Save this form to publish the new artwork.");
      }
    } catch (failure) { setError((failure as Error).message); }
    finally { bitmap?.close(); setProgress(undefined); onBusy(false); }
  }

  async function save() {
    if (!image) return;
    onBusy(true);
    setProgress(0);
    setError("");
    try {
      const uploaded = await uploadArtwork(await prepareCover(image, crop, name, kind, reused), setProgress);
      onChange(uploaded.asset_id);
      setMessage("Artwork prepared. Save this form to publish it.");
      close();
    } catch (failure) { setError((failure as Error).message); setProgress(undefined); }
    finally { onBusy(false); }
  }

  return <div className={`cover-field ${kind === "hero" ? "banner-field" : ""}`}>
    <span className="form-label">{label} <small>Optional · Recommended {target.width} × {target.height}</small></span>
    <div className="cover-field-content">
      <Art id={value} preview alt={value ? "Current cover" : "Cover placeholder"} />
      <div>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => file.current?.click()}>
          {value ? <Pencil size={17} /> : <ImagePlus size={17} />}{value ? `Replace ${noun}` : `Choose ${noun}`}
        </button>
        {uploadSource && <>
          <button type="button" className="button secondary" disabled={disabled} onClick={() => void fromMaster(false)}><RefreshCw size={16} /> Re-process images</button>
          <button type="button" className="button secondary" disabled={disabled} onClick={() => void fromMaster(true)}>Adjust focal point</button>
        </>}
        {value && <button type="button" className="button text-danger" disabled={disabled} onClick={() => onChange(null)}>
          <Trash2 size={16} /> Remove {noun}</button>}
        <input ref={file} type="file" hidden aria-label={kind === "hero" ? "Hero banner file" : "Cover file"} accept=".png,.jpg,.jpeg,.webp" disabled={disabled}
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (!selected) return;
            setMessage("");
            setError("");
            onBusy(true);
            try {
              setImage(await decodeImage(selected));
              setName(selected.name);
              setReused(undefined);
              setCrop(defaultCrop);
              dialog.current?.showModal();
            } catch (failure) { setError((failure as Error).message); }
            finally { onBusy(false); }
          }} />
        {details && <p className="muted">Saved rendition {details.width} × {details.height} · {(details.bytes / 1_000_000).toFixed(2)} MB for this upload</p>}
        {details === null && <p className="artwork-warning">Legacy rendition. A higher-resolution re-upload is recommended.</p>}
        {details && undersized(kind, details.width, details.height) && <p className="artwork-warning">This rendition is below the recommended size. Choose a larger source or a wider crop.</p>}
        {progress !== undefined && !image && <progress max={1} value={progress} aria-label="Re-processing progress" />}
        {message && <p role="status" className="muted">{message}</p>}
        {error && !image && <p role="alert" className="form-error">{error}</p>}
      </div>
    </div>
    <dialog ref={dialog} className="small-dialog crop-dialog" aria-label={`Crop ${noun}`} onCancel={(event) => {
      event.preventDefault();
      if (progress === undefined) close();
    }}>
      <div className="split-heading"><h2>Crop {noun}</h2><button className="icon-button" type="button" aria-label="Close cover crop"
        disabled={progress !== undefined} onClick={close}><X size={20} /></button></div>
      <div className="crop-layout">
        <canvas ref={preview} width={kind === "hero" ? 320 : 200} height={kind === "hero" ? 180 : 300}
          aria-label={`Cropped ${noun} preview`} role="img" />
        <fieldset disabled={progress !== undefined}>
          <label>Zoom<input type="range" min="1" max="3" step=".01" value={crop.zoom}
            onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} /></label>
          <label>Horizontal position<input type="range" min="0" max="100" value={crop.x}
            onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) })} /></label>
          <label>Vertical position<input type="range" min="0" max="100" value={crop.y}
            onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) })} /></label>
          <button className="button primary" type="button" onClick={save}>Upload {noun}</button>
        </fieldset>
      </div>
      {progress !== undefined && <progress className="upload-progress" max="1" value={progress} aria-label="Cover upload progress" />}
      {small && <p className="artwork-warning">This crop supplies {Math.floor(frame.width)} × {Math.floor(frame.height)} pixels. Recommended {target.width} × {target.height}.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </dialog>
  </div>;
}
