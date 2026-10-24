import { prisma } from "../prisma";

/**
 * Throws "Project not found" unless `projectId` is empty or names a project of
 * `userId`. Guards every write that links a record to a project, so a client
 * cannot attach someone else's project (and read its name back) by id.
 */
export async function assertOwnedProject(userId: string, projectId: unknown): Promise<void> {
  if (projectId === undefined || projectId === null || projectId === "") return;
  if (typeof projectId !== "string") throw new Error("Project not found");
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  if (!project) throw new Error("Project not found");
}
