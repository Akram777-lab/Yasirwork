import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid input", issues: error.issues },
      { status: 422 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  // eslint-disable-next-line no-console
  console.error("[api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
