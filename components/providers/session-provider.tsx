"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

type SessionWrapperProps = {
  children: ReactNode;
  session: Session | null;
};

export function SessionWrapper({ children, session }: SessionWrapperProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

