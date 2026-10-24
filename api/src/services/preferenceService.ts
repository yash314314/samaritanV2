import { prisma } from "../prisma";
import { broadcastToUser } from "../websocket/manager";

// The dashboard owns the catalogue of themes, accents, palettes and fonts;
// the API stores a choice per key and only guarantees its shape.
export const APPEARANCE_KEYS = ["theme", "accent", "palette", "font"] as const;
export type Appearance = Partial<Record<(typeof APPEARANCE_KEYS)[number], string>>;

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export class PreferenceValidationError extends Error {
  status = 400;
}

export function sanitizeAppearance(input: unknown): Appearance {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PreferenceValidationError("appearance must be an object");
  }

  const appearance: Appearance = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(APPEARANCE_KEYS as readonly string[]).includes(key)) {
      throw new PreferenceValidationError(`Unknown appearance key "${key}"`);
    }
    if (typeof value !== "string" || !SLUG.test(value)) {
      throw new PreferenceValidationError(`appearance.${key} must be a lowercase id such as "samaritan-dark"`);
    }
    appearance[key as keyof Appearance] = value;
  }
  return appearance;
}

export async function getAppearance(userId: string) {
  const preference = await prisma.userPreference.findUnique({ where: { userId } });
  return {
    appearance: (preference?.appearance as Appearance | undefined) ?? null,
    updatedAt: preference?.updatedAt ?? null,
  };
}

export async function saveAppearance(userId: string, input: unknown) {
  const appearance = sanitizeAppearance(input);
  const preference = await prisma.userPreference.upsert({
    where: { userId },
    update: { appearance },
    create: { userId, appearance },
  });

  // Other open dashboards and the desktop app restyle without a reload.
  broadcastToUser(userId, "appearance:changed", appearance);

  return { appearance, updatedAt: preference.updatedAt };
}
