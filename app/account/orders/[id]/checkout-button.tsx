"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { proceedToCheckout } from "./actions";

export function CheckoutButton({
  orderId,
  existingCheckoutUrl,
}: {
  orderId: string;
  existingCheckoutUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            // If we already have a checkout URL, jump straight to it
            if (existingCheckoutUrl) {
              window.location.href = existingCheckoutUrl;
              return;
            }
            const res = await proceedToCheckout(orderId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            window.location.href = res.checkoutUrl;
          });
        }}
      >
        {isPending
          ? "決済画面を準備中…"
          : existingCheckoutUrl
            ? "決済画面に戻る"
            : "確定して決済に進む"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
