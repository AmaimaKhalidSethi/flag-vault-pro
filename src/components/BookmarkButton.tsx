import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function BookmarkButton({ writeupId, me }: { writeupId: string; me: string | null }) {
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!me) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", me)
        .eq("writeup_id", writeupId)
        .maybeSingle();
      setSaved(!!data);
      setLoaded(true);
    })();
  }, [me, writeupId]);

  async function toggle() {
    if (!me) return toast.error("Sign in to bookmark");
    const prev = saved;
    setSaved(!prev);
    const op = prev
      ? supabase.from("bookmarks").delete().eq("user_id", me).eq("writeup_id", writeupId)
      : supabase.from("bookmarks").insert({ user_id: me, writeup_id: writeupId });
    const { error } = await op;
    if (error) {
      setSaved(prev);
      toast.error(error.message);
    } else {
      toast.success(prev ? "Bookmark removed" : "Saved");
    }
  }

  return (
    <Button size="sm" variant={saved ? "default" : "outline"} onClick={toggle} disabled={!loaded} title={saved ? "Remove bookmark" : "Save"}>
      {saved ? <BookmarkCheck className="size-3.5 mr-1" /> : <Bookmark className="size-3.5 mr-1" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
