import NextAuth, {
  getServerSession,
  type NextAuthConfig,
  type RequestInternal,
} from "next-auth";
import type { Session } from "next-auth";
import type { Provider } from "next-auth/providers";
import type { Adapter } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import nodemailer from "nodemailer";
import { compare } from "bcrypt";
import { z } from "zod";
import { withServiceRole } from "@/lib/db/rls";
import { consumeRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LOGIN_LIMIT = {
  windowMs: 60_000,
  limit: 10,
} as const;

function createEmailProvider() {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;
  if (!server || !from) {
    throw new Error(
      "EMAIL_SERVER and EMAIL_FROM must be set to use the email provider.",
    );
  }

  return EmailProvider({
    server,
    from,
    sendVerificationRequest: async ({ identifier, url, provider }) => {
      const transport = nodemailer.createTransport(provider.server);
      await transport.sendMail({
        to: identifier,
        from: provider.from,
        subject: "Your sign-in link",
        text: `Sign in to AI Context Manager\n${url}`,
        html: `<p>Sign in to AI Context Manager</p><p><a href="${url}">Click here to confirm your email address</a></p>`,
      });
    },
  });
}

function extractIp(value?: string | string[] | null) {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const [first] = raw.split(",");
  return first?.trim();
}

function resolveLoginIdentifier(
  req: RequestInternal | undefined,
  email: string,
) {
  const headerIp = extractIp(req?.headers?.["x-forwarded-for"]);
  const requestIp =
    headerIp ||
    (typeof (req as unknown as { ip?: string })?.ip === "string"
      ? (req as unknown as { ip?: string }).ip
      : undefined) ||
    "unknown";

  return `${requestIp}:${email.toLowerCase()}`;
}

const credentialsProvider = Credentials({
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "text" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials, req) => {
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) {
      return null;
    }

    const { email, password } = parsed.data;
    const identifier = resolveLoginIdentifier(req, email);
    const rateLimit = consumeRateLimit("login", identifier, LOGIN_LIMIT);
    if (!rateLimit.success) {
      throw new Error("Too many login attempts. Please try again later.");
    }

    const user = await withServiceRole((tx) =>
      tx.user.findUnique({
        where: { email },
      }),
    );

    if (!user?.passwordHash) {
      return null;
    }

    const passwordValid = await compare(password, user.passwordHash);
    if (!passwordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      slotLimit: user.slotLimit,
    };
  },
});

function withServiceAdapter<T>(
  fn: (adapter: ReturnType<typeof PrismaAdapter>) => Promise<T>,
) {
  return withServiceRole(async (tx) => {
    const adapter = PrismaAdapter(tx as unknown as PrismaClient);
    return fn(adapter);
  });
}

function createRlsAdapter(): Adapter {
  return {
    createUser: (data) =>
      withServiceAdapter((adapter) => adapter.createUser(data)),
    getUser: (id) => withServiceAdapter((adapter) => adapter.getUser(id)),
    getUserByEmail: (email) =>
      withServiceAdapter((adapter) => adapter.getUserByEmail(email)),
    getUserByAccount: (provider_providerAccountId) =>
      withServiceAdapter((adapter) =>
        adapter.getUserByAccount(provider_providerAccountId),
      ),
    updateUser: (data) =>
      withServiceAdapter((adapter) => adapter.updateUser(data)),
    deleteUser: (id) =>
      withServiceAdapter((adapter) => adapter.deleteUser(id)),
    linkAccount: (data) =>
      withServiceAdapter((adapter) => adapter.linkAccount(data)),
    unlinkAccount: (provider_providerAccountId) =>
      withServiceAdapter((adapter) =>
        adapter.unlinkAccount(provider_providerAccountId),
      ),
    createSession: (data) =>
      withServiceAdapter((adapter) => adapter.createSession(data)),
    getSessionAndUser: (sessionToken) =>
      withServiceAdapter((adapter) =>
        adapter.getSessionAndUser(sessionToken),
      ),
    updateSession: (data) =>
      withServiceAdapter((adapter) => adapter.updateSession(data)),
    deleteSession: (sessionToken) =>
      withServiceAdapter((adapter) => adapter.deleteSession(sessionToken)),
    createVerificationToken: (data) =>
      withServiceAdapter((adapter) => adapter.createVerificationToken(data)),
    useVerificationToken: (identifier_token) =>
      withServiceAdapter((adapter) =>
        adapter.useVerificationToken(identifier_token),
      ),
  };
}

const providers: Provider[] = [credentialsProvider];

if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(createEmailProvider());
}

export const authOptions: NextAuthConfig = {
  adapter: createRlsAdapter(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error slotLimit is custom
        token.slotLimit = user.slotLimit ?? 10;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.slotLimit = Number(token.slotLimit ?? 10);
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export const auth: () => Promise<Session | null> = () =>
  getServerSession(authOptions);

export { handler as GET, handler as POST };
