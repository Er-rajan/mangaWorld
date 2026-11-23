"use client";

import { Check, ChevronDown, Globe2, LoaderCircle, MessageCircle, MessageSquareText, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { commentLimits, type ChapterComment, type CommentPage } from "@/lib/comments";
import { fullDate } from "@/lib/format";

export function ChapterComments({ path }: { path: string }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState<CommentPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [posted, setPosted] = useState(false);
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/comments?chapter=${encodeURIComponent(path)}`;
  const before = page?.next;

  const loadComments = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setLoadError(false);
    const url = before == null ? endpoint : `${endpoint}&before=${before}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const result: CommentPage = await response.json();
      setPage((current) => ({ comments: [...(current?.comments ?? []), ...result.comments], next: result.next }));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [before, endpoint, loading]);

  const attachDetails = useCallback((details: HTMLDetailsElement | null) => {
    if (details?.open) setExpanded(true);
  }, []);

  useEffect(() => {
    if (expanded && !page && !loadError) void loadComments();
  }, [expanded, loadComments, loadError, page]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting || !page) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name") ?? "").trim();
    const body = String(fields.get("comment") ?? "").trim();
    setPosted(false);
    if (!name || !body) {
      setPostError("Enter your name and a comment.");
      return;
    }
    setPosting(true);
    setPostError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, name, body }),
      });
      if (!response.ok) {
        setPostError(response.status === 429 ? "Too many comments. Try again in a minute."
          : response.status === 400 ? "Check your name and comment and try again."
          : "Couldn’t post your comment. Try again.");
        return;
      }
      const comment: ChapterComment = await response.json();
      setPage((current) => ({
        comments: [comment, ...(current?.comments ?? []).filter((item) => item.id !== comment.id)],
        next: current?.next ?? null,
      }));
      form.reset();
      requestId.current = null;
      setPosted(true);
    } catch {
      setPostError("Couldn’t post your comment. Try again online.");
    } finally {
      setPosting(false);
    }
  }

  return <details className="chapter-comments" ref={attachDetails} suppressHydrationWarning
    onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>
      <span className="chapter-comments-mark"><MessageSquareText aria-hidden="true" size={22} /></span>
      <span>Chapter comments</span>
      <ChevronDown className="chapter-comments-toggle" aria-hidden="true" size={19} />
    </summary>
    <div className={page ? "chapter-comments-content is-loaded" : "chapter-comments-content"}>
      {page && <form className="chapter-comment-form" onSubmit={submit} onChange={() => {
        requestId.current = null;
        setPosted(false);
        setPostError("");
      }}>
        <h2>Leave a comment</h2>
        <label>Name<input name="name" autoComplete="nickname" required maxLength={commentLimits.name} readOnly={posting} /></label>
        <label>Comment<textarea name="comment" rows={4} required maxLength={commentLimits.body} readOnly={posting} /></label>
        <p className="chapter-comment-privacy"><Globe2 aria-hidden="true" size={15} /> Your name and comment will be public.</p>
        <button className="button primary" type="submit" disabled={posting}>
          {posting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
          {posting ? "Posting…" : "Post comment"}
        </button>
        {postError && <p className="form-error" role="alert">{postError}</p>}
        <p className="chapter-comment-status" role="status">{posted && <><Check aria-hidden="true" size={16} /> Comment posted.</>}</p>
      </form>}
      <div className="chapter-comment-thread">
        {page && <>
          <h2>Recent comments</h2>
          {page.comments.length ? <ul className="chapter-comment-list" role="list" aria-label="Posted comments">
            {page.comments.map((comment) => <li key={comment.id}>
              <span className="chapter-comment-initial" aria-hidden="true">{Array.from(comment.name)[0]?.toUpperCase()}</span>
              <div className="chapter-comment-entry">
                <div><strong>{comment.name}</strong><time dateTime={comment.created_at}>{fullDate(comment.created_at)}</time></div>
                <p>{comment.body}</p>
              </div>
            </li>)}
          </ul> : <p className="chapter-comment-empty"><MessageCircle aria-hidden="true" size={24} /> No comments yet.</p>}
        </>}
        {(loading || (!page && !loadError)) && <p className="chapter-comment-status" role="status">
          <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" size={16} /> Loading comments…
        </p>}
        {loadError && <p className="form-error" role="alert">Couldn’t load comments.</p>}
        {(loadError || page?.next != null) && <button className="button secondary" type="button" disabled={loading} onClick={loadComments}>
          {loadError ? "Try again" : "Load older comments"}
        </button>}
      </div>
    </div>
  </details>;
}
