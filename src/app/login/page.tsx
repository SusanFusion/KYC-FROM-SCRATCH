import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <LoginForm nextPath={searchParams?.next ?? "/"} />
    </div>
  );
}
