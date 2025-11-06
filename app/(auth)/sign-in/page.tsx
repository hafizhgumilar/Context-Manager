import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in | AI Context Manager",
  description: "Access your AI context templates and wallet.",
};

type SignInPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const callbackUrlParam = searchParams?.callbackUrl;
  const callbackUrl =
    typeof callbackUrlParam === "string" ? callbackUrlParam : undefined;

  if (session?.user) {
    redirect(callbackUrl ?? "/builder");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md border border-border/80 bg-background/90 shadow-lg backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to manage templates, wallet, and saved contexts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignInForm callbackUrl={callbackUrl} />
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

