import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState, LoadingBlock } from "./PageHeader";

/**
 * UI-only gate for staff pages. Real enforcement is in database row-level
 * security — this only avoids showing empty screens to the wrong role.
 */
export function RoleGate({ need, children }: { need: "staff" | "admin" | "lifts"; children: ReactNode }) {
  const { loading, isStaff, isAdmin, canManageLifts } = useAuth();
  if (loading) return <div className="mx-auto max-w-7xl px-4 py-10"><LoadingBlock label="Checking your access…" /></div>;
  const ok = need === "admin" ? isAdmin : need === "staff" ? isStaff : canManageLifts;
  if (!ok)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={<ShieldAlert aria-hidden />} title="You don't have access to this page">
          This area is for {need === "admin" ? "Administrators" : need === "staff" ? "Estate Staff and Administrators" : "lift operators and estate staff"}.
          Ask an Administrator to give your account the right role.
        </EmptyState>
      </div>
    );
  return <>{children}</>;
}
