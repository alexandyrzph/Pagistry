import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/forgot");
  return <AuthScreen mode="reset" token={token} />;
}
