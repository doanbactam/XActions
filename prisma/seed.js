import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptSessionSecret } from '../api/utils/sessionCrypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Primary operator (Phase A — single-user SaaS)
  const passwordHash = await bcrypt.hash(
    process.env.OPERATOR_PASSWORD || 'operator-change-me',
    10,
  );

  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      email: process.env.OPERATOR_EMAIL || 'operator@localhost',
      username: 'operator',
      password: passwordHash,
      credits: 1000,
      isAdmin: true,
      subscription: {
        create: {
          tier: 'pro',
          status: 'active',
          startDate: new Date(),
        },
      },
    },
  });
  console.log('✅ Primary operator:', operator.username, operator.email);

  // Optional placeholder XSession (encrypted dummy — replace via POST /api/sessions)
  if (process.env.SEED_DUMMY_X_SESSION === '1') {
    const dummy = 'auth_token=SEED_REPLACE_ME; ct0=SEED_REPLACE_ME';
    await prisma.xSession.upsert({
      where: { id: 'seed-operator-primary' },
      update: {},
      create: {
        id: 'seed-operator-primary',
        userId: operator.id,
        label: 'primary',
        username: process.env.OPERATOR_X_USERNAME || null,
        cookieEnc: encryptSessionSecret(dummy),
        status: 'active',
      },
    });
    console.log('✅ Seeded dummy XSession (replace cookie in production)');
  }

  // Create demo user with free tier
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@xactions.app' },
    update: {},
    create: {
      email: 'demo@xactions.app',
      username: 'demo_user',
      password: '$2a$10$rYZ3V4LqYJ8vLYZ3V4LqYOqYZ3V4LqYJ8vLYZ3V4LqYOqYZ3V4Lq', // hashed 'demo1234'
      credits: 50,
      subscription: {
        create: {
          tier: 'free',
          status: 'active',
          startDate: new Date()
        }
      }
    }
  });

  console.log('✅ Created demo user:', demoUser.email);

  // Create sample operations for demo user
  await prisma.operation.createMany({
    data: [
      {
        userId: demoUser.id,
        type: 'unfollowNonFollowers',
        status: 'completed',
        unfollowedCount: 25,
        creditsUsed: 10,
        startedAt: new Date(Date.now() - 86400000 * 2),
        completedAt: new Date(Date.now() - 86400000 * 2 + 3600000)
      },
      {
        userId: demoUser.id,
        type: 'detectUnfollowers',
        status: 'completed',
        unfollowedCount: 5,
        creditsUsed: 5,
        startedAt: new Date(Date.now() - 86400000),
        completedAt: new Date(Date.now() - 86400000 + 1800000)
      }
    ]
  });

  console.log('✅ Created sample operations');
  console.log('🌟 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
