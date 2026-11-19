"use client";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="main" className="center-state">
    <h1>The page couldn’t load</h1>
    <p>Manga World couldn’t load this page. Try again in a moment.</p>
    <button className="button primary" onClick={retry}>Try again</button>
  </main>;
}
