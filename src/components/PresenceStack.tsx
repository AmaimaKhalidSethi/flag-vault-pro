import { motion, AnimatePresence } from "framer-motion";

export type PresenceUser = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

export function PresenceStack({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  const visible = users.slice(0, 5);
  const extra = users.length - visible.length;
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full size-2 bg-primary" />
      </span>
      <span className="text-xs mono text-muted-foreground">
        {users.length} live
      </span>
      <div className="flex -space-x-2">
        <AnimatePresence>
          {visible.map((u) => {
            const initials = (u.username ?? "?").slice(0, 2).toUpperCase();
            return (
              <motion.div
                key={u.user_id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                title={u.username ?? "anon"}
                className="relative size-7 rounded-full ring-2 ring-background bg-muted overflow-hidden flex items-center justify-center text-[10px] mono font-semibold"
              >
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatar_url} alt={u.username ?? ""} className="size-full object-cover" />
                ) : (
                  <span className="text-primary">{initials}</span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {extra > 0 && (
          <div className="size-7 rounded-full ring-2 ring-background bg-muted text-[10px] mono flex items-center justify-center">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
