import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import {
  TemplateSchema,
  type TemplateInput,
  type SectionInput,
} from "@/lib/validators/template";
import {
  BUILDER_SAVE_COST,
  MAX_ATTACHMENT_CHARS,
  MAX_SECTION_CHARS,
} from "@/lib/economy";
import { adjustWalletWithClient } from "@/lib/wallet";

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

function normalizeSections(sections: TemplateInput["sections"]) {
  return sections
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section, index) => {
      validateSize(section as SectionInput);
      return {
        type: section.type,
        title: section.title,
        orderIndex: index,
        filename: section.filename ?? null,
        content: section.content ?? "",
      };
    });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withUserContext(session.user.id, async (client) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const favorited = url.searchParams.get("favorited") === "1";

    const filters: Record<string, unknown> = {
      ownerId: session.user.id,
    };

    if (query) {
      filters["name"] = {
        contains: query,
        mode: "insensitive",
      };
    }

    if (favorited) {
      filters["isStarred"] = true;
    }

    const [templates, slotsUsed, user] = await Promise.all([
      client.template.findMany({
        where: filters,
        select: {
          id: true,
          name: true,
          category: true,
          isStarred: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: [
          { isStarred: "desc" },
          { updatedAt: "desc" },
        ],
      }),
      client.template.count({ where: { ownerId: session.user.id } }),
      client.user.findUnique({
        where: { id: session.user.id },
        select: { slotLimit: true },
      }),
    ]);

    return NextResponse.json({
      templates,
      slotsUsed,
      slotLimit: user?.slotLimit ?? session.user.slotLimit ?? 10,
    });
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = TemplateSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, category, sections, isStarred } = parsed.data;

  return withUserContext(session.user.id, async (client) => {
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

    let sectionsData;
    try {
      sectionsData = normalizeSections(sections);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid section size";
      return NextResponse.json({ error: message }, { status: 413 });
    }

    try {
      const created = await client.template.create({
        data: {
          ownerId: session.user.id,
          name,
          category,
          isStarred: Boolean(isStarred),
          sections: {
            create: sectionsData,
          },
        },
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
            templateId: created.id,
            mode: "create",
          },
        );
        balance = debit.wallet.balance;
      }

      return NextResponse.json(
        {
          ...created,
          walletBalance: balance,
        },
        { status: 201 },
      );
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
