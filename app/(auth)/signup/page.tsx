import { AuthScreen } from "@/components/auth/AuthScreen";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
