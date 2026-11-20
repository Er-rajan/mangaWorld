"use client";

import { ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Art } from "@/components/art";
import { decodeImage, defaultCrop, drawCover, prepareCover, uploadArtwork } from "@/lib/upload";

export function CoverInput({ value, onChange, onBusy, disabled, label = "Cover image" }: {
  value: string | null; onChange: (value: string | null) => void; onBusy: (busy: boolean) => void; disabled: boolean; label?: string;
}) {
  const [image, setImage] = useState<ImageBitmap>();
  const [name, setName] = useState("");
  const [crop, setCrop] = useState(defaultCrop);
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image && preview.current) drawCover(preview.current, image, crop);
  }, [image, crop]);
  useEffect(() => () => image?.close(), [image]);

  function close() {
    dialog.current?.close();
    setImage(undefined);
    setProgress(undefined);
  }

  async function save() {
    if (!image) return;
    onBusy(true);
    setProgress(0);
    setMessage("");
    try {
      const uploaded = await uploadArtwork(await prepareCover(image, crop, name), setProgress);
      onChange(uploaded.asset_id);
      close();
    } catch (error) { setMessage((error as Error).message); setProgress(undefined); }
    finally { onBusy(false); }
  }

  return <div className="cover-field">
    <span className="form-label">{label} <small>Optional · 2:3</small></span>
    <div className="cover-field-content">
      <Art id={value} preview alt={value ? "Current cover" : "Cover placeholder"} />
      <div>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => file.current?.click()}>
          {value ? <Pencil size={17} /> : <ImagePlus size={17} />}{value ? "Replace cover" : "Choose cover"}
        </button>
        {value && <button type="button" className="button text-danger" disabled={disabled} onClick={() => onChange(null)}>
          <Trash2 size={16} /> Remove cover</button>}
        <input ref={file} type="file" hidden aria-label="Cover file" accept=".png,.jpg,.jpeg,.webp" disabled={disabled}
          onChange={async (event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (!selected) return;
            setMessage("");
            onBusy(true);
            try {
              setImage(await decodeImage(selected));
              setName(selected.name);
              setCrop(defaultCrop);
              dialog.current?.showModal();
            } catch (error) { setMessage((error as Error).message); }
            finally { onBusy(false); }
          }} />
        {message && <p role="alert" className="form-error">{message}</p>}
      </div>
    </div>
    <dialog ref={dialog} className="small-dialog crop-dialog" aria-label="Crop cover" onCancel={(event) => {
      event.preventDefault();
      if (progress === undefined) close();
    }}>
      <div className="split-heading"><h2>Crop cover</h2><button className="icon-button" type="button" aria-label="Close cover crop"
        disabled={progress !== undefined} onClick={close}><X size={20} /></button></div>
      <div className="crop-layout">
        <canvas ref={preview} width={200} height={300} aria-label="Cropped cover preview" role="img" />
        <fieldset disabled={progress !== undefined}>
          <label>Zoom<input type="range" min="1" max="3" step=".01" value={crop.zoom}
            onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} /></label>
          <label>Horizontal position<input type="range" min="0" max="100" value={crop.x}
            onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) })} /></label>
          <label>Vertical position<input type="range" min="0" max="100" value={crop.y}
            onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) })} /></label>
          <button className="button primary" type="button" onClick={save}>Upload cover</button>
        </fieldset>
      </div>
      {progress !== undefined && <progress className="upload-progress" max="1" value={progress} aria-label="Cover upload progress" />}
      {message && <p role="alert" className="form-error">{message}</p>}
    </dialog>
  </div>;
}
