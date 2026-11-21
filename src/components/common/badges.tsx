import { AlertTriangle, CheckCircle2, CircleHelp, Clock, ShieldCheck, ShieldAlert, Wrench, XCircle, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LiftStatusValue, ReportPriority, ReportStatus } from "@/lib/db-types";
import { LIFT_STATUS_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";

type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "demo";

const TONES: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/40",
  danger: "bg-destructive/10 text-destructive border-destructive/40",
  warning: "bg-warning/20 text-foreground border-warning/60",
  info: "bg-primary/10 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
  demo: "bg-demo text-demo-foreground border-demo-foreground/30",
};

/** Status pill — always icon + text, never colour alone. */
export function Pill({ tone, icon, children, className }: { tone: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold [&_svg]:size-4 [&_svg]:shrink-0",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function LiftStatusBadge({ status, stale }: { status: LiftStatusValue; stale?: boolean }) {
  if (status === "operational" && stale)
    return <Pill tone="warning" icon={<Clock aria-hidden />}>Operational (not confirmed recently)</Pill>;
  const map: Record<LiftStatusValue, [Tone, ReactNode]> = {
    operational: ["success", <CheckCircle2 aria-hidden key="i" />],
    out_of_service: ["danger", <XCircle aria-hidden key="i" />],
    under_maintenance: ["warning", <Wrench aria-hidden key="i" />],
    unknown: ["neutral", <CircleHelp aria-hidden key="i" />],
  };
  const [tone, icon] = map[status];
  return <Pill tone={tone} icon={icon}>{LIFT_STATUS_LABELS[status]}</Pill>;
}

export function VerificationBadge({
  status,
  stale,
  demo,
}: {
  status: "verified" | "partially_verified" | "unverified";
  stale?: boolean;
  demo?: boolean;
}) {
  if (demo && status === "verified")
    return <Pill tone="demo" icon={<FlaskConical aria-hidden />}>Demo-verified (synthetic)</Pill>;
  if (status === "verified" && stale) return <Pill tone="warning" icon={<Clock aria-hidden />}>Verification out of date</Pill>;
  if (status === "verified") return <Pill tone="success" icon={<ShieldCheck aria-hidden />}>Verified</Pill>;
  if (status === "partially_verified")
    return <Pill tone="warning" icon={<ShieldAlert aria-hidden />}>Partly verified</Pill>;
  return <Pill tone="neutral" icon={<CircleHelp aria-hidden />}>Not verified</Pill>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const tone: Tone =
    status === "resolved" ? "success" : status === "rejected" || status === "duplicate" ? "neutral" : status === "new" ? "info" : "warning";
  const icon = status === "resolved" ? <CheckCircle2 aria-hidden /> : status === "rejected" ? <XCircle aria-hidden /> : <Clock aria-hidden />;
  return <Pill tone={tone} icon={icon}>{STATUS_LABELS[status]}</Pill>;
}

export function PriorityBadge({ priority }: { priority: ReportPriority | null }) {
  if (!priority) return <Pill tone="neutral">Not set</Pill>;
  const tone: Tone = priority === "critical" ? "danger" : priority === "high" ? "warning" : priority === "medium" ? "info" : "neutral";
  return (
    <Pill tone={tone} icon={priority === "critical" ? <AlertTriangle aria-hidden /> : undefined}>
      {PRIORITY_LABELS[priority]}
    </Pill>
  );
}

export function DemoPill() {
  return <Pill tone="demo" icon={<FlaskConical aria-hidden />}>Demo data</Pill>;
}
