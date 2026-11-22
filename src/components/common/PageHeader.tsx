import type { ReactNode } from "react";

/** Navy screen title bar: bold title + short subtitle, like the app prototype. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-navy px-5 py-5 text-navy-foreground shadow-md md:flex-row md:items-center md:justify-between md:px-7">
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-base text-navy-foreground/80">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3 [&_a]:border-navy-foreground/60 [&_button]:border-navy-foreground/60">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-muted-foreground [&_svg]:size-10">{icon}</div>}
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="max-w-md text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="surface-card flex items-center justify-center gap-3 px-6 py-12 text-muted-foreground">
      <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border-2 border-destructive/50 bg-destructive/10 px-4 py-3 font-semibold text-destructive">
      {message}
    </div>
  );
}
