import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";

marked.setOptions({
  gfm: true,
  breaks: false,
});

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language }).value;
      const escaped = text.replace(/"/g, "&quot;");
      return `<div class="relative group"><pre><code class="hljs language-${language}">${highlighted}</code></pre><button data-copy="${escaped}" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-accent">copy</button></div>`;
    },
  },
});

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md || "", { async: false }) as string;
  // DOMPurify requires a DOM; on the server (SSR) skip and return raw markup.
  if (typeof window === "undefined") return raw;
  return DOMPurify.sanitize(raw, { ADD_ATTR: ["data-copy", "target", "rel"] });
}
