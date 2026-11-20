"use client";

import { getImageProps } from "next/image";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import { bundledArtwork, type Artwork } from "@/lib/artwork";
import { artUrl } from "@/lib/format";

export function ResponsiveArt({ asset, artwork, alt, sizes, className, eager, priority, onReady, purpose = "cover" }: {
  asset: string; artwork?: Artwork; alt: string; sizes: string; className?: string; eager?: boolean;
  priority?: boolean; onReady?: (element: HTMLImageElement) => void; purpose?: "cover" | "hero";
}) {
  const bundled = bundledArtwork[asset];
  const blur = artwork?.blur ?? bundled?.blur;
  const local = asset.startsWith("/");
  const { width, height } = artwork ?? bundled ?? (purpose === "hero" && local ? { width: 547, height: 306 } : { width: 1000, height: 1500 });
  const src = local ? asset : artUrl(asset, "full");
  let srcSet: string | undefined;
  if (bundled?.cardWidths) {
    srcSet = [...bundled.cardWidths.map((w) => `${src.replace(/\.webp$/, `-card-${w}.webp`)} ${w}w`), `${src} ${width}w`].join(", ");
  } else if (local && bundled) {
    const { props } = getImageProps({ src, width, height, sizes, alt, quality: 92 });
    const validSizes = props.srcSet?.split(", ").filter((candidate) => Number(candidate.match(/ (\d+)w$/)?.[1]) < width) ?? [];
    srcSet = [...validSizes, `${src} ${width}w`].join(", ");
  } else if (!local) {
    const thumb = artwork?.thumb ?? 400;
    srcSet = [
      ...(thumb < width ? [`${artUrl(asset, "thumb")} ${thumb}w`] : []),
      ...(artwork?.card ? [`${artUrl(asset, "card")} ${artwork.card}w`] : []),
      `${src} ${width}w`,
    ].join(", ");
  }
  if (priority) preload(src, { as: "image", imageSrcSet: srcSet, imageSizes: srcSet ? sizes : undefined, fetchPriority: "high" });

  function markLoaded(element: HTMLImageElement | null) {
    if (!element?.complete || !element.naturalWidth) return;
    element.dataset.loaded = "true";
    onReady?.(element);
  }

  return <img className={`${className ?? ""} responsive-art`} alt={alt} width={width} height={height}
    style={{ "--art-width": `${width}px`, "--art-height": `${height}px`,
      "--art-focus": artwork ? `${artwork.crop.x}% ${artwork.crop.y}%` : undefined,
      "--art-placeholder": blur ? `url("${blur}")` : undefined } as CSSProperties}
    data-blur={!eager && !priority && Boolean(blur)} data-native-limit={purpose === "hero" ? width < 1200 : width < 500}
    data-accent-src={onReady && !local ? artUrl(asset, "thumb") : undefined}
    sizes={srcSet ? sizes : undefined} srcSet={srcSet} src={src}
    loading={eager || priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async"
    ref={markLoaded} onLoad={(event) => markLoaded(event.currentTarget)} onError={(event) => {
      const image = event.currentTarget;
      if (bundled && image.currentSrc.includes("/_next/image?")) {
        image.removeAttribute("srcset");
        image.src = src;
      }
    }} />;
}
