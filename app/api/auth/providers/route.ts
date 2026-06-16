import { json } from "@/lib/api/api-response";
import { oauthProviders } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/providers — which OAuth providers are configured (public; for the login UI)
export async function GET() {
  return json({ providers: oauthProviders() });
}
