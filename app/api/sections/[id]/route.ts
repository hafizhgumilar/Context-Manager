import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";

const UpdateSectionSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    filename: z.string().optional().nullable(),
  })
  .strict();

type RouteParams = {
  params: { id: string };
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = UpdateSectionSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withUserContext(session.user.id, async (client) => {
    const section = await client.section.findFirst({
      where: {
        id: params.id,
        template: { ownerId: session.user.id },
      },
      select: { id: true, templateId: true },
    });

    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await client.section.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await client.template.update({
      where: { id: section.templateId },
      data: { updatedAt: new Date() },
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
    const section = await client.section.findFirst({
      where: {
        id: params.id,
        template: { ownerId: session.user.id },
      },
      select: { id: true, templateId: true },
    });

    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await client.section.delete({
      where: { id: params.id },
    });

    await client.template.update({
      where: { id: section.templateId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  });
}
