"use client";

import { Bookmark, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "./brand";
import { ThemePicker } from "./theme";

type Result = { url: string; title: string; subtitle: string; detail: string };

export function SiteHeader({ search }: { search: Result[] }) {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = terms.length ? search.filter(({ title, subtitle, detail }) =>
    terms.every((term) => `${title} ${subtitle} ${detail}`.toLowerCase().includes(term))).slice(0, 25) : [];

  function openSearch() {
    dialog.current?.showModal();
    input.current?.focus();
  }

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!dialog.current?.open) openSearch();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return <header className="site-header">
    <div className="site-width header-inner">
      <Brand />
      <nav className="site-nav" aria-label="Main">
        <Link href="/" aria-current={path === "/" ? "page" : undefined}>Manga</Link>
        <Link href="/about" aria-current={path === "/about" ? "page" : undefined}>About</Link>
      </nav>
      <div className="header-actions">
        <button className="search-trigger" type="button" onClick={openSearch} aria-label="Search manga">
          <Search size={17} /><span>Search manga</span><kbd>Ctrl K</kbd>
        </button>
        <a className="icon-button" href="/shelf" title="My shelf" aria-label="My shelf"><Bookmark size={19} /></a>
        <ThemePicker compact />
      </div>
    </div>
    <dialog className="search-dialog" ref={dialog} aria-label="Search manga" onClose={() => setQuery("")}
      onClick={(event) => { if (event.currentTarget === event.target) dialog.current?.close(); }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); dialog.current?.close(); }
      }}>
      <div className="search-box">
        <div className="search-field">
          <Search size={21} /><input ref={input} type="search" placeholder="Search series or chapters" aria-label="Search series or chapters" value={query}
            onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && matches.length === 1) document.getElementById("first-search-match")?.click();
            }} />
          <button type="button" className="icon-button" onClick={() => dialog.current?.close()} aria-label="Close search"><X size={19} /></button>
        </div>
        <div className="search-results" aria-live="polite">
          {!terms.length && <p>Search by title, chapter, or genre.</p>}
          {terms.length > 0 && !matches.length && <p>No results for “{query}”.</p>}
          {matches.map((result, index) => <Link id={index === 0 ? "first-search-match" : undefined} key={result.url} href={result.url} prefetch={false}
            onClick={() => dialog.current?.close()}><strong>{result.title}</strong><span>{result.subtitle}</span></Link>)}
        </div>
      </div>
    </dialog>
  </header>;
}
