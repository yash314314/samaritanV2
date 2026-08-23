import { prisma } from "../prisma";
import { hashPassword } from "../utils/password";

const FIXED_USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

async function main() {
  console.log("Bootstrapping default admin user...");

  const email = "admin@samaritan.local";
  const password = "SamaritanSecure2026!";
  const name = "System Administrator";

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { id: FIXED_USER_ID },
    update: {
      email,
      passwordHash,
      name,
      role: "admin",
    },
    create: {
      id: FIXED_USER_ID,
      email,
      passwordHash,
      name,
      role: "admin",
    },
  });

  console.log("Admin user bootstrapped successfully!");
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
