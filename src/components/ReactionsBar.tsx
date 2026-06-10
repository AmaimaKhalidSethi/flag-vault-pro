import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMOJIS = ["🔥", "🤯", "👀"] as const;
type Emoji = (typeof EMOJIS)[number];

type Row = { emoji: Emoji; user_id: string };

export function ReactionsBar({ writeupId, me }: { writeupId: string; me: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("reactions")
        .select("emoji,user_id")
        .eq("writeup_id", writeupId);
      setRows(((data ?? []) as Row[]).filter(r => (EMOJIS as readonly string[]).includes(r.emoji)));
      setLoaded(true);
    })();
  }, [writeupId]);

  async function toggle(emoji: Emoji) {
    if (!me) return toast.error("Sign in to react");
    const mine = rows.some(r => r.user_id === me && r.emoji === emoji);
    const prev = rows;
    // optimistic
    setRows(mine
      ? rows.filter(r => !(r.user_id === me && r.emoji === emoji))
      : [...rows, { user_id: me, emoji }]);
    const op = mine
      ? supabase.from("reactions").delete().eq("writeup_id", writeupId).eq("user_id", me).eq("emoji", emoji)
      : supabase.from("reactions").insert({ writeup_id: writeupId, user_id: me, emoji });
    const { error } = await op;
    if (error) {
      setRows(prev);
      toast.error(error.message);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-8">
      {EMOJIS.map(e => {
        const count = rows.filter(r => r.emoji === e).length;
        const mine = !!me && rows.some(r => r.emoji === e && r.user_id === me);
        return (
          <button
            key={e}
            onClick={() => toggle(e)}
            disabled={!loaded}
            className={`px-3 py-1.5 rounded-full border text-sm transition flex items-center gap-1.5
              ${mine
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40"}`}
          >
            <span className="text-base leading-none">{e}</span>
            <span className="mono text-xs">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
