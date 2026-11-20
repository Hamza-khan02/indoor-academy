// Creates the first admin user and the academy branches.
// Safe to run more than once: it only creates what is missing.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BRANCHES = ['Sultanpur · Main', 'Sultanpur · North', 'Sultanpur · South'];

async function main() {
  const users = await prisma.user.count();
  if (users === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.');
    await prisma.user.create({
      data: {
        name: process.env.ADMIN_NAME || 'Academy Admin',
        email: email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });
    console.log(`Admin user created: ${email}`);
  } else {
    console.log('Users already exist, admin not re-created.');
  }

  if ((await prisma.branch.count()) === 0) {
    for (const name of BRANCHES) await prisma.branch.create({ data: { name } });
    console.log(`Branches created: ${BRANCHES.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
