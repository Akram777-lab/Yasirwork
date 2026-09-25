import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ user });
  } catch (error) {
    return fail(error);
  }
}
