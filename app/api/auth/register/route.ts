import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { RegisterSchema } from "@/lib/validators/auth";
import { withServiceRole } from "@/lib/db/rls";
import { consumeRateLimit } from "@/lib/rate-limit";

const REGISTER_LIMIT = {
  windowMs: 60_000,
  limit: 5,
} as const;

function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first?.trim()) return first.trim();
  }
  // @ts-expect-error Request in Next runtime may include ip
  const requestIp = (request as unknown as { ip?: string }).ip;
  if (requestIp) return requestIp;
  return "unknown";
}

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = consumeRateLimit(
    "register",
    identifier,
    REGISTER_LIMIT,
  );
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many registration attempts. Please try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": `${rateLimit.retryAfterSeconds}` }
          : undefined,
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, name } = parsed.data;

  const passwordHash = await hash(password, 12);

  const result = await withServiceRole(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return { conflict: true as const };
    }

    await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        wallet: {
          create: {},
        },
      },
    });

    return { conflict: false as const };
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}
