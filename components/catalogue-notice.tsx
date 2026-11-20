"use client";

import { Info, X } from "lucide-react";
import { setLocal, useLocal } from "@/lib/local";

export function CatalogueNotice() {
  const dismissed = useLocal("catalogueNoticeDismissed");
  if (dismissed) return null;
  return <aside className="catalogue-notice site-width">
    <p role="status"><Info size={16} aria-hidden="true" /> The library is having trouble loading. You can still read the available chapters.</p>
    <button className="icon-button" aria-label="Dismiss library notice" onClick={() => setLocal("catalogueNoticeDismissed", true)}><X size={17} /></button>
  </aside>;
}
