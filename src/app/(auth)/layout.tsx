import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AUTH_DISABLED } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // In open-access mode there is no sign-in step — skip straight to the app.
  if (AUTH_DISABLED) redirect("/dashboard");
  return <>{children}</>;
}
