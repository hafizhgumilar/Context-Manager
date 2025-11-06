"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type SignInValues = z.infer<typeof SignInSchema>;

type SignInFormProps = {
  callbackUrl?: string;
};

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: SignInValues) => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: callbackUrl ?? "/builder",
      });

      if (response?.error) {
        setErrorMessage("Invalid email or password");
        toast({
          title: "Sign in failed",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome back",
        description: "You are now signed in.",
      });
      router.push(response?.url ?? callbackUrl ?? "/builder");
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}

