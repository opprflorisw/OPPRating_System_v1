import { createContext, useContext, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// ── Record navigation: deal:/meddic:/library: links inside AI output open
// the corresponding records so the reader can retrace every claim. ─────────
export interface RecordNav {
  openDeal: (slug: string) => void;
  openMeddic: (slug: string) => void;
  openLibrary: () => void;
}

export const NavContext = createContext<RecordNav>({
  openDeal: () => {},
  openMeddic: () => {},
  openLibrary: () => {},
});

// Allow our custom record-link schemes through DOMPurify.
const URI_RE = /^(?:(?:https?|mailto|deal|meddic|library):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

marked.setOptions({ breaks: true, gfm: true });

export function Md({ text, className }: { text: string; className?: string }) {
  const nav = useContext(NavContext);
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(raw, { ALLOWED_URI_REGEXP: URI_RE });
  }, [text]);

  return (
    <div
      className={"md " + (className ?? "")}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        const href = a.getAttribute("href") ?? "";
        if (href.startsWith("deal:")) {
          e.preventDefault();
          nav.openDeal(href.slice(5));
        } else if (href.startsWith("meddic:")) {
          e.preventDefault();
          nav.openMeddic(href.slice(7));
        } else if (href.startsWith("library:")) {
          e.preventDefault();
          nav.openLibrary();
        } else if (href.startsWith("http")) {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noreferrer");
        }
      }}
    />
  );
}

// ── Copy the raw markdown (pastes with formatting into docs/Slack) ────────
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn quiet tiny"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          // Rich copy: HTML + plain markdown, so targets keep the formatting.
          const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "✓ Copied" : label ?? "⧉ Copy"}
    </button>
  );
}

// ── Print / save as PDF ───────────────────────────────────────────────────
export function PrintButton({ text, title }: { text: string; title: string }) {
  return (
    <button
      className="btn quiet tiny"
      onClick={() => {
        const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
        const w = window.open("", "_blank", "width=840,height=900");
        if (!w) return;
        w.document.write(
          `<!doctype html><html><head><title>${title}</title><style>
            body{font-family:'Instrument Sans',-apple-system,sans-serif;color:#18181a;max-width:760px;margin:40px auto;padding:0 24px;font-size:13.5px;line-height:1.6}
            h1,h2,h3{letter-spacing:-0.01em} h3{margin:22px 0 8px;font-size:15px}
            table{border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0}
            th,td{border:1px solid #d4d4d2;padding:6px 9px;text-align:left}
            th{background:#f4f4f3} strong{font-weight:600}
            ul{padding-left:20px} li{margin:3px 0}
            a{color:#2563eb;text-decoration:none}
            .foot{margin-top:30px;font-size:10px;color:#a3a3aa;border-top:1px solid #e6e6e4;padding-top:8px}
          </style></head><body>${html}
          <div class="foot">OPPRating System · generated ${new Date().toLocaleString()} · Oppr B.V.</div>
          </body></html>`
        );
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }}
    >
      ⎙ Print / PDF
    </button>
  );
}
