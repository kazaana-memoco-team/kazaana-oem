import Link from "next/link";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
  type IssuedDocument,
} from "@/lib/documents/types";

export function DocumentsList({
  documents,
}: {
  documents: IssuedDocument[];
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        まだ書類は発行されていません。
      </p>
    );
  }

  return (
    <ul className="divide-y rounded border">
      {documents.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-3 p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {DOCUMENT_TYPE_LABEL[d.type as DocumentType]}
              <span className="ml-2 text-xs text-muted-foreground">
                {d.document_number}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(d.created_at).toLocaleString("ja-JP", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <Link
              href={`/documents/${d.id}`}
              className="underline underline-offset-4"
            >
              開く・印刷
            </Link>
            {(() => {
              const meta = d.metadata as
                | { drive_view_url?: string | null }
                | undefined;
              return meta?.drive_view_url ? (
                <a
                  href={meta.drive_view_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 text-muted-foreground"
                >
                  Drive
                </a>
              ) : null;
            })()}
          </div>
        </li>
      ))}
    </ul>
  );
}
