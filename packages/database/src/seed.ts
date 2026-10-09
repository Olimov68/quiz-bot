import { getPrismaClient, UserRole, QuizStatus } from './index.js';

async function seed() {
  const prisma = getPrismaClient();
  console.log('🌱 Seeding database...');

  // 1. Create Super Admin
  const admin = await prisma.user.upsert({
    where: { telegramId: BigInt(123456789) },
    update: {},
    create: {
      telegramId: BigInt(123456789),
      username: 'smartquiz_admin',
      firstName: 'Admin',
      lastName: 'Platform',
      role: UserRole.SUPER_ADMIN,
    },
  });

  // 2. Create Sample Teacher
  const teacher = await prisma.user.upsert({
    where: { telegramId: BigInt(987654321) },
    update: {},
    create: {
      telegramId: BigInt(987654321),
      username: 'kimyo_muallim',
      firstName: 'Rustam',
      lastName: 'Karimov',
      role: UserRole.TEACHER,
      teacherProfile: {
        create: {
          bio: 'Kimyo fani o‘qituvchisi, oliy toifa',
          school: '1-sonli ixtisoslashtirilgan maktab',
          subject: 'Kimyo',
        },
      },
    },
  });

  // 3. Create Sample Quiz with Math & Chemistry questions
  const quiz = await prisma.quiz.create({
    data: {
      title: 'Organik kimyo — Alkenlar va Gomologik qator',
      description: 'Alkenlarning tuzilishi, nomlanishi va kimyoviy xossalari bo‘yicha test',
      creatorId: teacher.id,
      status: QuizStatus.PUBLISHED,
      subject: 'Kimyo',
      currentVersion: 1,
      settings: {
        timeLimitPerQuestionSeconds: 30,
        shuffleQuestions: true,
        shuffleOptions: true,
        showExplanation: true,
        allowRetake: false,
        maxAttempts: 1,
      },
      versions: {
        create: {
          versionNumber: 1,
          title: 'Organik kimyo — Alkenlar va Gomologik qator',
          description: 'Alkenlarning tuzilishi, nomlanishi va kimyoviy xossalari bo‘yicha test',
          questions: {
            create: [
              {
                questionIndex: 1,
                text: 'Eten (etilen) molekulasidagi uglerod atomlari qaysi gibridlanish holatida bo‘ladi?',
                hasMath: false,
                hasChemistry: true,
                explanation: 'Alkenlarda qo‘shbog‘ hosil qilgan uglerod atomlari sp² gibridlangan bo‘ladi.',
                points: 1,
                options: {
                  create: [
                    { optionIndex: 0, text: 'sp³', isCorrect: false },
                    { optionIndex: 1, text: 'sp²', isCorrect: true },
                    { optionIndex: 2, text: 'sp', isCorrect: false },
                    { optionIndex: 3, text: 'sp³d', isCorrect: false },
                  ],
                },
              },
              {
                questionIndex: 2,
                text: 'Etenga bromli suv ta’sir ettirilganda qanday modda hosil bo‘ladi? CH₂=CH₂ + Br₂ → ?',
                hasMath: false,
                hasChemistry: true,
                explanation: 'Birikish reaksiyasi natijasida 1,2-dibrometan hosil bo‘ladi va bromli suv rangsizlanadi.',
                points: 1,
                options: {
                  create: [
                    { optionIndex: 0, text: '1,1-dibrometan', isCorrect: false },
                    { optionIndex: 1, text: '1,2-dibrometan (CH₂Br–CH₂Br)', isCorrect: true },
                    { optionIndex: 2, text: 'Brometan', isCorrect: false },
                    { optionIndex: 3, text: 'Bromoform', isCorrect: false },
                  ],
                },
              },
              {
                questionIndex: 3,
                text: 'Quyidagi tenglamaning ildizlari yig‘indisini toping: x² - 7x + 12 = 0',
                hasMath: true,
                hasChemistry: false,
                explanation: 'Viyet teoremasiga ko‘ra, x₁ + x₂ = -(-7) / 1 = 7.',
                points: 1,
                options: {
                  create: [
                    { optionIndex: 0, text: '5', isCorrect: false },
                    { optionIndex: 1, text: '7', isCorrect: true },
                    { optionIndex: 2, text: '12', isCorrect: false },
                    { optionIndex: 3, text: '-7', isCorrect: false },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });

  console.log(`✅ Seed completed! Created admin (${admin.username}), teacher (${teacher.username}), quiz (${quiz.id})`);
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });
