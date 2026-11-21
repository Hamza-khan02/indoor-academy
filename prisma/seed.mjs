// Creates the first admin user, the academy's branches and coach, and contact details.
// Safe to run more than once: it only creates what is missing.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// The academy's real locations (a third branch is upcoming; add it from Branches when it opens).
const BRANCHES = [
  {
    name: 'Sultanpur City',
    address: 'Pausahal Road, near Pausahal Masjid (go straight 100 m), Sultanpur, Uttar Pradesh 228001',
    mapsUrl: 'https://maps.app.goo.gl/pb1kQgwvHe7mrKiG8',
  },
  {
    name: 'Aliganj Bazar',
    address: 'Nirman Public School, Aliganj Bazar, Sultanpur, Uttar Pradesh 227805',
    mapsUrl: 'https://maps.app.goo.gl/1JMVVk6pKKB7Qhdv6',
  },
];
const COACHES = [{ name: 'Aftab Khan', phone: '7897241176' }]; // coaches at all branches
const SETTINGS = {
  academyPhone: '7897241176',
  academyAddress: 'Pausahal Road, near Pausahal Masjid, Sultanpur, Uttar Pradesh 228001',
};

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
    for (const b of BRANCHES) await prisma.branch.create({ data: b });
    console.log(`Branches created: ${BRANCHES.map((b) => b.name).join(', ')}`);
  }

  if ((await prisma.coach.count()) === 0) {
    for (const c of COACHES) await prisma.coach.create({ data: c });
    console.log(`Coaches created: ${COACHES.map((c) => c.name).join(', ')}`);
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    if (!(await prisma.setting.findUnique({ where: { key } }))) await prisma.setting.create({ data: { key, value } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
