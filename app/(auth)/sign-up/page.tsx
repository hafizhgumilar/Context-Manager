import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account | AI Context Manager",
  description: "Register to unlock cloud templates, wallet, and coins.",
};

type SignUpPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
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
            Create your account
          </CardTitle>
          <CardDescription>
            Sign up to save templates, earn coins, and sync across devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignUpForm callbackUrl={callbackUrl} />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

