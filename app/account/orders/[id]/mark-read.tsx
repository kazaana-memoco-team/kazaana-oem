"use client";

import { useEffect } from "react";
import { markOrderRead } from "./actions";

/** Fire-and-forget: mark the order chat as read when the detail page mounts. */
export function MarkRead({ orderId }: { orderId: string }) {
  useEffect(() => {
    void markOrderRead(orderId);
  }, [orderId]);
  return null;
}
