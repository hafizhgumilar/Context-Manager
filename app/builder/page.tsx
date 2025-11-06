import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuilderShell } from "@/components/builder/builder-shell";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";

export const metadata: Metadata = {
  title: "Builder | AI Context Manager",
  description:
    "Construct structured AI prompt contexts with reusable sections, attachments, and formatted output.",
};

type BuilderPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function BuilderPage({ searchParams }: BuilderPageProps) {
  const session = await auth();
  const templateIdParam = searchParams?.templateId;
  const templateId =
    typeof templateIdParam === "string" ? templateIdParam : undefined;

  if (templateId && !session?.user?.id) {
    const callback = encodeURIComponent(`/builder?templateId=${templateId}`);
    redirect(`/sign-in?callbackUrl=${callback}`);
  }

  let initialTemplate = null;

  if (templateId && session?.user?.id) {
    initialTemplate = await withUserContext(session.user.id, async (client) => {
      const template = await client.template.findFirst({
        where: {
          id: templateId,
          ownerId: session.user.id,
        },
        include: {
          sections: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        name: template.name,
        category: template.category,
        sections: template.sections.map((section) => ({
          id: section.id,
          type: section.type,
          title: section.title,
          orderIndex: section.orderIndex,
          filename: section.filename,
          content: section.content,
        })),
      };
    });
  }

  return <BuilderShell initialTemplate={initialTemplate} />;
}
