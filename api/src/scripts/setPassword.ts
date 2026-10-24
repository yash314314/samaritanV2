// Sets (or resets) a user's password from the terminal and ends their sessions.
//   npm run user:password -- --email you@example.com
// The password is read from SAMARITAN_NEW_PASSWORD or typed at a hidden prompt.
import "dotenv/config";
import readline from "readline";
import { prisma } from "../prisma";
import { hashPassword, passwordProblem } from "../utils/password";
import { revokeAllSessions } from "../services/authService";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] ?? null : null;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const mutable = rl as unknown as { _writeToOutput: (text: string) => void };
    process.stdout.write(question);
    mutable._writeToOutput = () => undefined;
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = argument("email")?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run user:password -- --email you@example.com");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);

  const password = process.env.SAMARITAN_NEW_PASSWORD ?? (await askHidden(`New password for ${email}: `));
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  if (!process.env.SAMARITAN_NEW_PASSWORD && (await askHidden("Repeat it: ")) !== password) throw new Error("Passwords do not match");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessions(user.id, "password");
  console.log(`Password updated for ${email}. Every existing session was signed out.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
