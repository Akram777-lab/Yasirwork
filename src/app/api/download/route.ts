import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const zipPath = join(process.cwd(), "worktrack-source.zip");

  try {
    // Create a fresh zip of just the source code
    execSync(
      `zip -r worktrack-source.zip ` +
        `package.json package-lock.json tsconfig.json next.config.ts ` +
        `postcss.config.mjs eslint.config.mjs drizzle.config.json vercel.json ` +
        `README.md .env.example .gitignore src/ ` +
        `-x 'node_modules/*' -x '.next/*' -x 'drizzle/*'`,
      { cwd: process.cwd() },
    );
  } catch {
    return new Response("Failed to create archive", { status: 500 });
  }

  if (!existsSync(zipPath)) {
    return new Response("Archive not found", { status: 500 });
  }

  const fileBuffer = readFileSync(zipPath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="worktrack-source.zip"',
      "Content-Length": String(fileBuffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}