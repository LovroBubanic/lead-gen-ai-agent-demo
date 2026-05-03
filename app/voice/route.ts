import { redirect } from "next/navigation";

/** Alias: voice UI lives at `/call`. */
export function GET() {
  redirect("/call");
}
