import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

// Usage: node scripts/seedAdmin.js <username> <password>
// Creates the first ADMIN account (no public signup page, spec §11).
async function main() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    console.error('Usage: node scripts/seedAdmin.js <username> <password>');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: 'ADMIN', displayName: username },
  });

  console.log(`Created ADMIN user "${user.username}" (id=${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
