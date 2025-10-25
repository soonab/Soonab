'use client';

import * as React from 'react';

type Props = {
  path: string;         // e.g. "/c/board-slug" or "/c/board-slug#e-<entryId>"
  title?: string;       // optional share title
  compact?: boolean;    // icon-only button
  label?: string;       // button text (default "Share")
  className?: string;   // positioning
};

export default function ShareMenu({ path, title, compact, label = 'Share', className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const popRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const url = React.useMemo(() => {
    if (typeof window === 'undefined') return path;
    try { return new URL(path, window.location.origin).toString(); }
    catch { return window.location.origin + path; }
  }, [path]);

  async function doNativeShare() {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: title || document.title, text: title, url });
        return true;
      }
    } catch {}
    return false;
  }

  async function onClick() {
    const ok = await doNativeShare();
    if (!ok) setOpen((v) => !v);
  }

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className={`relative inline-block ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        onClick={onClick}
        className={
          compact
            ? 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 ring-1 ring-black/10 hover:bg-white transition'
            : 'pill flex items-center gap-2'
        }
        title="Share"
      >
        <ShareIcon />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div ref={popRef} role="menu" className="absolute right-0 z-[70] mt-2 w-44 rounded-lg bg-white shadow-lg ring-1 ring-black/10 p-1">
          <button className="w-full text-left rounded-md px-3 py-2 text-[13px] hover:bg-[color:var(--ink-50)]" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a className="block rounded-md px-3 py-2 text-[13px] hover:bg-[color:var(--ink-50)]" href={url} target="_blank" rel="noopener noreferrer">
            Open link
          </a>
        </div>
      )}
    </div>
  );
}

function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M15 8a3 3 0 1 0-2.83-4H12a3 3 0 0 0 0 6c.52 0 1-.13 1.43-.36l3.4 1.94a3 3 0 1 0 0 4.85l-3.4 1.94A3 3 0 1 0 12 20c0-.25.03-.49.08-.73l3.4-1.94A3 3 0 0 0 18 15a3 3 0 0 0-2.52-2.96l-3.4-1.94c-.05-.24-.08-.48-.08-.73Z"
      />
    </svg>
  );
}
