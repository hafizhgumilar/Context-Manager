import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import type { SectionInput } from "@/lib/validators/template";
import {
  MAX_ATTACHMENT_CHARS,
  MAX_SECTION_CHARS,
} from "@/lib/economy";

function validateSize(section: SectionInput) {
  const length = section.content?.length ?? 0;
  if (section.type === "attachment") {
    if (length > MAX_ATTACHMENT_CHARS) {
      throw new Error("Attachment exceeds maximum size");
    }
  } else if (length > MAX_SECTION_CHARS) {
    throw new Error("Section exceeds maximum size");
  }
}

type RouteParams = {
  params: { id: string };
};

export async function POST(
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

    const [slotsUsed, user] = await Promise.all([
      client.template.count({ where: { ownerId: session.user.id } }),
      client.user.findUnique({
        where: { id: session.user.id },
        select: { slotLimit: true },
      }),
    ]);

    const slotLimit = user?.slotLimit ?? session.user.slotLimit ?? 10;

    if (slotsUsed >= slotLimit) {
      return NextResponse.json(
        { error: "Slot limit reached" },
        { status: 403 },
      );
    }

    const sectionsData = template.sections.map((section) => {
      const record: SectionInput = {
        id: section.id,
        type: section.type as SectionInput["type"],
        title: section.title,
        orderIndex: section.orderIndex,
        filename: section.filename ?? undefined,
        content: section.content,
      };
      validateSize(record);
      return {
        type: section.type,
        title: section.title,
        orderIndex: section.orderIndex,
        filename: section.filename,
        content: section.content,
      };
    });

    const created = await client.template.create({
      data: {
        ownerId: session.user.id,
        name: `${template.name} (Copy)`,
        category: template.category,
        sections: {
          create: sectionsData.map((section) => ({
            ...section,
            filename: section.filename ?? null,
          })),
        },
      },
      include: {
        sections: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  });
}
