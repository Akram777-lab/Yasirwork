import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  // Open-access mode: go straight into the workspace, no sign-in required.
  redirect("/dashboard");
}
