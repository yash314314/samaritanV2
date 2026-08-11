import { prisma } from '../prisma';

export interface TagResult {
  projectId: string | null;
  projectName: string | null;
  confidence: number;
}

/**
 * Auto-tag an activity to a project based on matching rules.
 * Returns the best matching projectId and confidence score.
 */
export async function tagActivityToProject(
  userId: string,
  appName: string,
  domain: string | null,
  title: string | null
): Promise<TagResult> {
  // Fetch all active project rules for the user
  const rules = await prisma.projectRule.findMany({
    where: {
      project: {
        userId,
        active: true,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  let bestMatch: { projectId: string; projectName: string; score: number } | null = null;

  for (const rule of rules) {
    let score = 0;

    // App name match (highest weight)
    if (rule.appName && appName.toLowerCase() === rule.appName.toLowerCase()) {
      score += 50;
    }

    // Domain match (medium weight)
    if (rule.domain && domain) {
      if (rule.matchType === 'exact') {
        if (domain.toLowerCase() === rule.domain.toLowerCase()) {
          score += 30;
        }
      } else {
        // contains
        if (domain.toLowerCase().includes(rule.domain.toLowerCase())) {
          score += 30;
        }
      }
    }

    // Title keyword match (lower weight)
    if (rule.titleKeyword && title) {
      if (rule.matchType === 'exact') {
        if (title.toLowerCase() === rule.titleKeyword.toLowerCase()) {
          score += 20;
        }
      } else {
        // contains
        if (title.toLowerCase().includes(rule.titleKeyword.toLowerCase())) {
          score += 20;
        }
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        projectId: rule.projectId,
        projectName: rule.project.name,
        score,
      };
    }
  }

  if (!bestMatch) {
    return { projectId: null, projectName: null, confidence: 0 };
  }

  return {
    projectId: bestMatch.projectId,
    projectName: bestMatch.projectName,
    confidence: Math.min(bestMatch.score / 100, 1),
  };
}

