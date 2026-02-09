import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDirectClient: PrismaClient | undefined;
};

// Accelerate client — used for request-scoped operations (API routes, SSR)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL!,
  });

// Direct client — used for background jobs that outlive the HTTP request
function createDirectClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL! });
  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

export const prismaDirectClient =
  globalForPrisma.prismaDirectClient ?? createDirectClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDirectClient = prismaDirectClient;
}
