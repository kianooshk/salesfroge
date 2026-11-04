import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seed } from './seed';

const prisma = new PrismaClient();

seed(prisma)
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
