import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { resolveDatabaseConfig } from "./config/database";

export const databaseConfig = resolveDatabaseConfig();

export const prisma = new PrismaClient({ datasourceUrl: databaseConfig.url });
