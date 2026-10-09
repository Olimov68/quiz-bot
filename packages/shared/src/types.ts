import {
  UserRole,
  QuizStatus,
  QuizSessionMode,
  SessionStatus,
  QuestionType,
  IssueSeverity,
  IssueType,
  AssetType,
} from './enums.js';

export interface ExtractedMedia {
  id: string;
  originalName: string;
  mimeType: string;
  dataBase64?: string;
  buffer?: Buffer;
  hash: string;
  width?: number;
  height?: number;
}

export interface ParsedOption {
  index: number;
  letter: string;
  text: string;
  isCorrect: boolean;
  images?: ExtractedMedia[];
}

export interface ParsedIssue {
  questionIndex?: number;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  rawSnippet?: string;
}

export interface ParsedQuestion {
  index: number;
  text: string;
  textRaw?: string;
  explanation?: string;
  options: ParsedOption[];
  hasMath: boolean;
  hasChemistry: boolean;
  formulas: string[];
  images: ExtractedMedia[];
  issues: ParsedIssue[];
  timeLimitSeconds?: number;
  points?: number;
}

export interface DocxParseResult {
  success: boolean;
  titleSuggestion?: string;
  questions: ParsedQuestion[];
  totalQuestions: number;
  validQuestions: number;
  invalidQuestions: number;
  imagesCount: number;
  formulasCount: number;
  globalIssues: ParsedIssue[];
}

export interface QuizSettings {
  timeLimitPerQuestionSeconds: number; // 0 = untimed, or 10, 15, 20, 30, 45, 60, etc.
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanation: boolean;
  allowRetake: boolean;
  maxAttempts: number;
  isAnonymousPoll: boolean;
  passingScorePercentage?: number;
}

export interface QuizListItem {
  id: string;
  title: string;
  description?: string | null;
  status: QuizStatus;
  creatorId: string;
  creatorName?: string;
  currentVersion: number;
  questionsCount: number;
  sessionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  telegramId: string;
  displayName: string;
  username?: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  totalTimeMs: number;
  averageTimePerQuestionMs: number;
}

export interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramInitDataPayload {
  query_id?: string;
  user: TelegramInitDataUser;
  auth_date: number;
  hash: string;
}

export interface AuthUser {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  role: UserRole;
  isActive: boolean;
}
