import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";

const UpdateTemplateSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    isStarred: z.boolean().optional(),
  })
  .strict();

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    const template = await client.template.findFirst({
      where: { id: params.id, ownerId: session.user.id },
      include: {
        sections: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = UpdateTemplateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withUserContext(session.user.id, async (client) => {
    const existing = await client.template.findFirst({
      where: { id: params.id, ownerId: session.user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await client.template.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    const existing = await client.template.findFirst({
      where: { id: params.id, ownerId: session.user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await client.template.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  });
}
