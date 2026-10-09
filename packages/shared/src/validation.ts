import { z } from 'zod';
import { QuizStatus, UserRole, QuizSessionMode } from './enums.js';

export const QuizSettingsSchema = z.object({
  timeLimitPerQuestionSeconds: z.number().int().min(0).max(600).default(30),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showExplanation: z.boolean().default(true),
  allowRetake: z.boolean().default(false),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  isAnonymousPoll: z.boolean().default(false),
  passingScorePercentage: z.number().min(0).max(100).default(60),
});

export const QuestionOptionSchema = z.object({
  text: z.string().min(1, "Variant matni bo'sh bo'lishi mumkin emas").max(200),
  isCorrect: z.boolean().default(false),
});

export const QuestionSchema = z.object({
  text: z.string().min(1, "Savol matni bo'sh bo'lishi mumkin emas").max(2000),
  explanation: z.string().max(1000).optional(),
  options: z.array(QuestionOptionSchema).min(2, "Kamida 2 ta variant bo'lishi kerak").max(10, "Ko'pi bilan 10 ta variant bo'lishi mumkin"),
  timeLimitSeconds: z.number().int().min(0).max(600).optional(),
  points: z.number().int().min(1).default(1),
});

export const CreateQuizSchema = z.object({
  title: z.string().min(2, "Test sarlavhasi kamida 2 ta belgidan iborat bo'lishi kerak").max(255),
  description: z.string().max(2000).optional(),
  settings: QuizSettingsSchema.optional(),
  questions: z.array(QuestionSchema).min(1, "Kamida 1 ta savol bo'lishi kerak"),
});

export const UpdateQuizSchema = CreateQuizSchema.partial().extend({
  status: z.nativeEnum(QuizStatus).optional(),
});

export const StartSessionSchema = z.object({
  quizId: z.string().uuid(),
  mode: z.nativeEnum(QuizSessionMode).default(QuizSessionMode.LIVE_GROUP),
  groupId: z.string().optional(),
  customSettings: QuizSettingsSchema.partial().optional(),
});
