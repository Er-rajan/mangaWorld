import "./reels.css";

export default function LoadingReels() {
  return <main id="main" className="site-width reels-page reel-header" aria-busy="true">
    <h1>Reels</h1>
    <p className="sr-only" role="status">Loading reels…</p>
    <div className="skeleton reel-loading" aria-hidden="true" />
  </main>;
}
