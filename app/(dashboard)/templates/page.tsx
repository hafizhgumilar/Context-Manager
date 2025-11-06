import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db/rls";
import { TemplatesDashboard } from "@/components/templates/templates-dashboard";

export const metadata: Metadata = {
  title: "My Templates | AI Context Manager",
  description: "Browse, star, duplicate, and manage your saved context templates.",
};

export default async function TemplatesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/templates");
  }

  const userId = session.user.id;

  const { templates, slotsUsed, slotLimit } = await withUserContext(
    session.user.id,
    async (client) => {
      const [templateRows, templateCount, user] = await Promise.all([
        client.template.findMany({
          where: { ownerId: userId },
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
        client.template.count({ where: { ownerId: userId } }),
        client.user.findUnique({
          where: { id: userId },
          select: { slotLimit: true },
        }),
      ]);

      return {
        templates: templateRows,
        slotsUsed: templateCount,
        slotLimit: user?.slotLimit ?? session.user.slotLimit ?? 10,
      };
    },
  );

  const payload = templates.map((template) => ({
    ...template,
    updatedAt: template.updatedAt.toISOString(),
    createdAt: template.createdAt.toISOString(),
  }));

  return (
    <TemplatesDashboard
      initialTemplates={payload}
      slotsUsed={slotsUsed}
      slotLimit={slotLimit}
    />
  );
}
