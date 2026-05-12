import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import { renderMarkdown } from "@/lib/markdown";
import { useDebounced } from "@/hooks/use-debounced";
import {
  Bold, Italic, Code2, Link as LinkIcon, Image as ImageIcon, Minus,
  Heading1, Heading2, Heading3, Eye, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (v: string) => void;
  extraToolbar?: React.ReactNode;
};

export function MarkdownEditor({ value, onChange, extraToolbar }: Props) {
  const [vimMode, setVimMode] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const ref = useRef<ReactCodeMirrorRef>(null);

  const debounced = useDebounced(value, 150);
  const html = useMemo(() => renderMarkdown(debounced), [debounced]);

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
        <div className="md:hidden ml-auto">
          <Button size="sm" variant="outline" onClick={() => setMobileView(mobileView === "edit" ? "preview" : "edit")}>
            {mobileView === "edit" ? <><Eye className="size-3.5 mr-1" />Preview</> : <><Pencil className="size-3.5 mr-1" />Edit</>}
          </Button>
        </div>
        {extraToolbar && <div className="flex items-center gap-1 ml-auto md:ml-2">{extraToolbar}</div>}
      </div>

      <div className="flex-1 grid md:grid-cols-2 min-h-0">
        <div className={`border-r border-border min-h-0 overflow-auto ${mobileView === "preview" ? "hidden md:block" : ""}`}>
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
        <div className={`overflow-auto p-6 prose-cyber ${mobileView === "edit" ? "hidden md:block" : ""}`}
             dangerouslySetInnerHTML={{ __html: html }} />
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
