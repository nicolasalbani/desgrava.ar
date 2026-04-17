import { LoginForm } from "./login-form";
import { initialFromParams } from "./initial-from-params";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string; reset?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm initial={initialFromParams(params)} />;
}
