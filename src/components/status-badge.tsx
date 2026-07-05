import type { QuoteStatus } from "@/lib/types";
import { badgeBase, STATUS_BADGE, STATUS_DOT } from "@/lib/ui";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`${badgeBase} ${STATUS_BADGE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}
