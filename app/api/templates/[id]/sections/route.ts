import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import {
  SectionSchema,
  TemplateSchema,
  type SectionInput,
} from "@/lib/validators/template";
import {
  BUILDER_SAVE_COST,
  MAX_ATTACHMENT_CHARS,
  MAX_SECTION_CHARS,
} from "@/lib/economy";
import { adjustWalletWithClient } from "@/lib/wallet";

const ReplaceSectionsSchema = z.object({
  sections: TemplateSchema.shape.sections,
});

const SINGLE_SECTION_SCHEMA = SectionSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

type RouteParams = {
  params: {
    id: string;
  };
};

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

function normalizeSections(sections: SectionInput[]) {
  return sections
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section, index) => {
      validateSize(section);
      return {
        type: section.type,
        title: section.title,
        orderIndex: index,
        filename: section.filename ?? null,
        content: section.content ?? "",
      };
    });
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = ReplaceSectionsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withUserContext(session.user.id, async (client) => {
    const template = await client.template.findFirst({
      where: { id: params.id, ownerId: session.user.id },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let sectionsData;
    try {
      sectionsData = normalizeSections(parsed.data.sections as SectionInput[]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid section size";
      return NextResponse.json({ error: message }, { status: 413 });
    }

    try {
      await client.section.deleteMany({
        where: { templateId: params.id },
      });

      await client.section.createMany({
        data: sectionsData.map((section) => ({
          ...section,
          templateId: params.id,
        })),
      });

      const updated = await client.template.update({
        where: { id: params.id },
        data: { updatedAt: new Date() },
        include: {
          sections: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      let balance: number | undefined;
      if (BUILDER_SAVE_COST > 0) {
        const debit = await adjustWalletWithClient(
          client,
          session.user.id,
          -Math.abs(BUILDER_SAVE_COST),
          "builder_save",
          {
            templateId: updated.id,
            mode: "update",
          },
        );
        balance = debit.wallet.balance;
      }

      return NextResponse.json({
        ...updated,
        walletBalance: balance,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Insufficient balance") {
        return NextResponse.json(
          {
            error: "Not enough coins to save template.",
          },
          { status: 402 },
        );
      }

      throw error;
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = SINGLE_SECTION_SCHEMA.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withUserContext(session.user.id, async (client) => {
    const template = await client.template.findFirst({
      where: { id: params.id, ownerId: session.user.id },
      include: { sections: { orderBy: { orderIndex: "asc" } } },
    });

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const section = {
      type: parsed.data.type,
      title: parsed.data.title,
      orderIndex: parsed.data.orderIndex ?? template.sections.length,
      filename: parsed.data.filename ?? null,
      content: parsed.data.content ?? "",
    };

    try {
      validateSize(section as SectionInput);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid section size";
      return NextResponse.json({ error: message }, { status: 413 });
    }

    const created = await client.section.create({
      data: {
        ...section,
        templateId: params.id,
      },
    });

    await client.template.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(created, { status: 201 });
  });
}


