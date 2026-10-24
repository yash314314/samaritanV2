// Shared client: follows DATABASE_TARGET like the API does.
import { prisma } from "../prisma";


const USER_ID =
  process.env.USER_ID || "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

async function main() {
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      name: "Local Samaritan User",
    },
  });

  console.log(`Local user ready: ${user.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
