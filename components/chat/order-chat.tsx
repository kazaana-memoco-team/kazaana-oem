"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMessage, sendMessage } from "@/app/account/orders/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatMessage = {
  id: string;
  order_id: string;
  sender_id: string;
  body: string;
  /** Set on insert by Server Action; older rows default to 'customer' */
  sender_context?: "customer" | "admin";
  created_at: string;
};

export type ChatParticipant = {
  id: string;
  display_name: string | null;
  role: "customer" | "craftsman" | "admin";
};

/**
 * Layout strategy:
 * - "customer" viewer: customer (right) ↔ BECOS (left)
 * - "admin"    viewer: BECOS    (right) ↔ customer (left)
 *
 * Mobile (<md): chat is collapsed into a fixed bottom banner that expands
 *               into a fullscreen sheet on tap.
 * Desktop (md+): chat fills its parent container inline.
 */
export type ChatViewer = "customer" | "admin";

export function OrderChat({
  orderId,
  currentUserId: _currentUserId,
  initialMessages,
  participants,
  viewer = "customer",
}: {
  orderId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  participants: ChatParticipant[];
  viewer?: ChatViewer;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Subscribe to Realtime inserts (single subscription, regardless of layout)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`order:${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const next = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === next.id) ? prev : [...prev, next],
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const removedId = (payload.old as { id: string }).id;
            setMessages((prev) => prev.filter((m) => m.id !== removedId));
          },
        )
        .subscribe((status, err) => {
          // eslint-disable-next-line no-console
          console.log(
            `[chat] order:${orderId} realtime status=${status}`,
            err ?? "",
          );
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop inline panel */}
      <div className="hidden h-full md:block">
        <ChatPanel
          orderId={orderId}
          messages={messages}
          participants={participants}
          viewer={viewer}
          currentUserId={_currentUserId}
        />
      </div>

      {/* Mobile footer banner */}
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="メッセージを開く"
      >
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden>💬</span>
          メッセージ
          <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs">
            {messages.length}
          </span>
        </span>
        <span className="text-xs opacity-80">タップで開く</span>
      </button>

      {/* Mobile fullscreen sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">メッセージ</h2>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              閉じる
            </button>
          </header>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              orderId={orderId}
              messages={messages}
              participants={participants}
              viewer={viewer}
              currentUserId={_currentUserId}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChatPanel({
  orderId,
  messages,
  participants,
  viewer,
  currentUserId,
}: {
  orderId: string;
  messages: ChatMessage[];
  participants: ChatParticipant[];
  viewer: ChatViewer;
  currentUserId: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const participantsById = new Map(participants.map((p) => [p.id, p]));

  return (
    <div className="flex h-full flex-col">
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            まだメッセージはありません。最初のメッセージを送ってみましょう。
          </p>
        ) : (
          messages.map((m) => {
            const sender = participantsById.get(m.sender_id);
            const ctx: "customer" | "admin" =
              m.sender_context ??
              (sender?.role === "admin" ? "admin" : "customer");

            const isOwnSide =
              viewer === "admin" ? ctx === "admin" : ctx === "customer";

            const senderLabel =
              ctx === "admin" ? "BECOS" : (sender?.display_name ?? "顧客");

            // Show the X (delete) button only when:
            //  - the row was created by the current user (security), AND
            //  - it sits on the viewer's own side of the chat
            //    (i.e. you're looking at "your" messages, not the counter-party's).
            const canDelete = m.sender_id === currentUserId && isOwnSide;

            return (
              <div
                key={m.id}
                className={`group/msg flex ${isOwnSide ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isOwnSide
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (deletingId) return;
                        if (
                          !window.confirm("このメッセージを取り消しますか？")
                        ) {
                          return;
                        }
                        setDeletingId(m.id);
                        startTransition(async () => {
                          const res = await deleteMessage(m.id);
                          setDeletingId(null);
                          if (!res.ok) {
                            setError(res.error);
                          }
                        });
                      }}
                      disabled={deletingId === m.id}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-xs leading-none text-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted focus:opacity-100 group-hover/msg:opacity-100 disabled:cursor-wait"
                      aria-label="メッセージを取り消す"
                      title="メッセージを取り消す"
                    >
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  <p
                    className={`mb-1 text-xs font-medium ${isOwnSide ? "opacity-80" : "text-muted-foreground"}`}
                  >
                    {senderLabel}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${isOwnSide ? "opacity-70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex gap-2 border-t p-3"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const trimmed = (formData.get("body") as string)?.trim() ?? "";
            if (!trimmed) return;
            const res = await sendMessage(orderId, formData, viewer);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setBody("");
          });
        }}
      >
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="メッセージを入力（Cmd/Ctrl+Enterで送信）"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              const form = (e.target as HTMLTextAreaElement).form;
              form?.requestSubmit();
            }
          }}
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending || !body.trim()}>
          {isPending ? "送信中" : "送信"}
        </Button>
      </form>
      {error ? (
        <p className="border-t px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
