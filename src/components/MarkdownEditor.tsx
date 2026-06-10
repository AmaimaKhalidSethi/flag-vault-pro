import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import DOMPurify from "dompurify";
import { marked } from "marked";
import hljs from "highlight.js";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDebounced } from "@/hooks/use-debounced";
import {
  Bold, Italic, Code2, Link as LinkIcon, Image as ImageIcon, Minus,
  Heading1, Heading2, Heading3, Eye, Pencil, Columns2,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  extraToolbar?: React.ReactNode;
};

type Layout = "split" | "editor" | "preview";

const VIM_STORAGE_KEY = "editor-vim-mode";
const LAYOUT_STORAGE_KEY = "editor-layout";

// configure marked with hljs for the live preview (async-safe)
marked.setOptions({ gfm: true, breaks: false });
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

export function MarkdownEditor({ value, onChange, extraToolbar }: Props) {
  const [vimMode, setVimMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(VIM_STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [layout, setLayout] = useState<Layout>(() => {
    if (typeof window === "undefined") return "split";
    try {
      const v = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      return v === "editor" || v === "preview" ? v : "split";
    } catch { return "split"; }
  });
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [html, setHtml] = useState("");
  const ref = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    try { window.localStorage.setItem(VIM_STORAGE_KEY, vimMode ? "1" : "0"); } catch { /* ignore */ }
  }, [vimMode]);
  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout); } catch { /* ignore */ }
  }, [layout]);

  const debounced = useDebounced(value, 150);

  // async marked + sanitise; cancellation guard for stale renders
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = (await marked(debounced || "")) as string;
      if (cancelled) return;
      setHtml(DOMPurify.sanitize(raw, { ADD_ATTR: ["data-copy"] }));
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  // wire copy buttons in preview
  useEffect(() => {
    function handler(e: Event) {
      const t = e.target as HTMLElement;
      const btn = t.closest?.("button[data-copy]") as HTMLElement | null;
      if (btn) navigator.clipboard.writeText(btn.getAttribute("data-copy") ?? "");
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  function wrap(before: string, after = before) {
    const view = ref.current?.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const sel = view.state.sliceDoc(from, to);
    const insert = `${before}${sel || "text"}${after}`;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + before.length, head: from + before.length + (sel || "text").length },
    });
    view.focus();
  }

  function lineInsert(prefix: string) {
    const view = ref.current?.view;
    if (!view) return;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: from + prefix.length },
    });
    view.focus();
  }

  function insertAtCursor(text: string) {
    const view = ref.current?.view;
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }

  const extensions = useMemo(() => {
    const exts = [markdown(), EditorView.lineWrapping];
    if (vimMode) exts.unshift(vim());
    return exts;
  }, [vimMode]);

  const editorPane = (
    <div className="h-full min-h-0 overflow-auto bg-background">
      <CodeMirror
        ref={ref}
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={oneDark}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        height="100%"
        style={{ fontSize: "14px", height: "100%" }}
      />
    </div>
  );
  const previewPane = (
    <div className="h-full overflow-auto p-6 prose-cyber bg-background"
         dangerouslySetInnerHTML={{ __html: html }} />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border bg-card px-2 py-1.5 flex flex-wrap items-center gap-1">
        <ToolbarBtn onClick={() => wrap("**")} title="Bold"><Bold className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => wrap("*")} title="Italic"><Italic className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => wrap("\n```\n", "\n```\n")} title="Code block"><Code2 className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => insertAtCursor("[link text](https://)")} title="Link"><LinkIcon className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => insertAtCursor("![alt](https://)")} title="Image"><ImageIcon className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => insertAtCursor("\n\n---\n\n")} title="Horizontal rule"><Minus className="size-3.5" /></ToolbarBtn>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn onClick={() => lineInsert("# ")} title="H1"><Heading1 className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => lineInsert("## ")} title="H2"><Heading2 className="size-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => lineInsert("### ")} title="H3"><Heading3 className="size-3.5" /></ToolbarBtn>
        <span className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setVimMode((v) => !v)}
          className={`text-[10px] mono px-2 py-1 rounded border ${vimMode ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          title="Toggle vim mode"
        >
          vim {vimMode ? "on" : "off"}
        </button>

        <div className="hidden md:flex items-center rounded-md border border-border overflow-hidden ml-1">
          <LayoutBtn active={layout === "editor"} onClick={() => setLayout("editor")} title="Editor only">
            <Pencil className="size-3.5" />
          </LayoutBtn>
          <LayoutBtn active={layout === "split"} onClick={() => setLayout("split")} title="Split view">
            <Columns2 className="size-3.5" />
          </LayoutBtn>
          <LayoutBtn active={layout === "preview"} onClick={() => setLayout("preview")} title="Preview only">
            <Eye className="size-3.5" />
          </LayoutBtn>
        </div>

        <div className="md:hidden ml-auto">
          <button onClick={() => setMobileView(mobileView === "edit" ? "preview" : "edit")}
                  className="text-xs px-2 py-1 rounded border border-border flex items-center gap-1">
            {mobileView === "edit" ? <><Eye className="size-3.5" />Preview</> : <><Pencil className="size-3.5" />Edit</>}
          </button>
        </div>
        {extraToolbar && <div className="flex items-center gap-1 ml-auto md:ml-2">{extraToolbar}</div>}
      </div>

      {/* Mobile: tabbed */}
      <div className="flex-1 min-h-0 md:hidden">
        <div className={mobileView === "edit" ? "h-full" : "hidden"}>{editorPane}</div>
        <div className={mobileView === "preview" ? "h-full" : "hidden"}>{previewPane}</div>
      </div>

      {/* Desktop: resizable split / single panel */}
      <div className="hidden md:block flex-1 min-h-0">
        {layout === "editor" && <div className="h-full">{editorPane}</div>}
        {layout === "preview" && <div className="h-full">{previewPane}</div>}
        {layout === "split" && (
          <PanelGroup direction="horizontal" autoSaveId="writeup-editor-split">
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full border-r border-border" style={{ minWidth: 300 }}>{editorPane}</div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/60 transition" />
            <Panel defaultSize={50} minSize={25}>
              <div className="h-full" style={{ minWidth: 300 }}>{previewPane}</div>
            </Panel>
          </PanelGroup>
        )}
      </div>

      <div className="border-t border-border bg-card px-3 py-1 flex items-center justify-between text-[10px] mono text-muted-foreground">
        <div className="flex items-center gap-2">
          {vimMode && (
            <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-semibold tracking-wider">
              VIM
            </span>
          )}
          <span>markdown · {layout}</span>
        </div>
        <span>{value.length} chars · {value.split(/\s+/).filter(Boolean).length} words</span>
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
      {children}
    </button>
  );
}

function LayoutBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
