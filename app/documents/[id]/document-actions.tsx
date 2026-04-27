"use client";

import { Button } from "@/components/ui/button";

export function DocumentActions() {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        印刷 / PDF保存
      </Button>
    </div>
  );
}
