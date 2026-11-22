import { FlaskConical } from "lucide-react";
import { DEMO_LABEL } from "@/lib/labels";

export function DemoBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border-2 border-dashed border-demo-foreground/40 bg-demo px-4 py-3 text-demo-foreground">
      <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-sm font-semibold leading-snug">
        DEMO MODE · {DEMO_LABEL}.
        {!compact && " Places and pathways marked “Demo” are invented to show how SugamPath LPU works. Do not rely on them on campus."}
      </p>
    </div>
  );
}
