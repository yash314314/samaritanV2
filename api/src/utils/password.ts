import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;
export const PASSWORD_MIN_LENGTH = 10;
// bcrypt ignores everything after 72 bytes; longer input would silently be truncated.
export const PASSWORD_MAX_BYTES = 72;

// Compared against when the email is unknown, so a miss costs as much as a hit
// and response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("samaritan-timing-equaliser", BCRYPT_COST);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

/** Returns a reason the password is unacceptable, or null when it is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  if (password.trim().length === 0) return "Password cannot be blank";
  return null;
}
