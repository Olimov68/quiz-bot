import { describe, it, expect } from 'vitest';
import {
  buildTelegramQuizPoll,
  calculateLeaderboard,
  formatUzbekLeaderboardMessage,
  generateQuizExcelReport,
  ParticipantScoreInput,
} from '../src/index.js';
import ExcelJS from 'exceljs';

describe('Telegram Poll Builder', () => {
  it('builds valid native quiz poll parameters within Bot API limits', () => {
    const question = {
      index: 1,
      text: 'Qaysi element inert gaz hisoblanadi?',
      options: [
        { index: 0, letter: 'A', text: 'Kislorod', isCorrect: false },
        { index: 1, letter: 'B', text: 'Argon', isCorrect: true },
        { index: 2, letter: 'C', text: 'Vodorod', isCorrect: false },
      ],
      hasMath: false,
      hasChemistry: true,
      formulas: [],
      images: [],
      issues: [],
    };

    const poll = buildTelegramQuizPoll(question, 30, false);
    expect(poll.type).toBe('quiz');
    expect(poll.is_anonymous).toBe(false);
    expect(poll.correct_option_id).toBe(1); // Argon
    expect(poll.open_period).toBe(30);
    expect(poll.options).toHaveLength(3);
    expect(poll.options[1]).toBe('B) Argon');
  });

  it('splits long question text into companion message if exceeding 300 chars', () => {
    const longText = 'A'.repeat(350);
    const question = {
      index: 5,
      text: longText,
      options: [
        { index: 0, letter: 'A', text: 'Variant 1', isCorrect: true },
        { index: 1, letter: 'B', text: 'Variant 2', isCorrect: false },
      ],
      hasMath: false,
      hasChemistry: false,
      formulas: [],
      images: [],
      issues: [],
    };

    const poll = buildTelegramQuizPoll(question, 20);
    expect(poll.companionMessage).toBeDefined();
    expect(poll.companionMessage).toContain(longText);
    expect(poll.question.length).toBeLessThanOrEqual(300);
  });
});

describe('Scoring Engine and Leaderboard', () => {
  it('correctly ranks participants by score, response time, and join order', () => {
    const participants: ParticipantScoreInput[] = [
      {
        userId: 'u1',
        telegramId: '101',
        displayName: 'Sardor',
        score: 8,
        totalQuestions: 10,
        totalTimeMs: 25000,
        joinTimestamp: 100,
      },
      {
        userId: 'u2',
        telegramId: '102',
        displayName: 'Ali',
        score: 10,
        totalQuestions: 10,
        totalTimeMs: 18000,
        joinTimestamp: 200,
      },
      {
        userId: 'u3',
        telegramId: '103',
        displayName: 'Malika',
        score: 10,
        totalQuestions: 10,
        totalTimeMs: 15000, // Tied in score with Ali, but faster time!
        joinTimestamp: 300,
      },
    ];

    const leaderboard = calculateLeaderboard(participants);

    expect(leaderboard[0].displayName).toBe('Malika'); // 10/10 in 15s
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].percentage).toBe(100);

    expect(leaderboard[1].displayName).toBe('Ali'); // 10/10 in 18s
    expect(leaderboard[1].rank).toBe(2);

    expect(leaderboard[2].displayName).toBe('Sardor'); // 8/10
    expect(leaderboard[2].rank).toBe(3);
  });

  it('formats Uzbek leaderboard message with medals', () => {
    const leaderboard = [
      {
        rank: 1,
        userId: '1',
        telegramId: '1',
        displayName: 'Malika',
        score: 10,
        totalQuestions: 10,
        percentage: 100,
        totalTimeMs: 15000,
        averageTimePerQuestionMs: 1500,
      },
      {
        rank: 2,
        userId: '2',
        telegramId: '2',
        displayName: 'Ali',
        score: 9,
        totalQuestions: 10,
        percentage: 90,
        totalTimeMs: 18000,
        averageTimePerQuestionMs: 1800,
      },
    ];

    const msg = formatUzbekLeaderboardMessage('Organik kimyo', 10, leaderboard);
    expect(msg).toContain('TEST NATIJALARI');
    expect(msg).toContain('Organik kimyo');
    expect(msg).toContain('🥇 <b>1. Malika</b> — 10/10');
    expect(msg).toContain('🥈 <b>2. Ali</b> — 9/10');
    expect(msg).toContain('<b>Ishtirokchilar:</b> 2 nafar');
  });
});

describe('Excel Report Exporter', () => {
  it('generates a 3-sheet styled Excel report and protects against formula injection', async () => {
    const buffer = await generateQuizExcelReport({
      quizTitle: 'Matematika — Algebra',
      groupName: '10-A sinf',
      generalResults: [
        {
          index: 1,
          fullName: '=cmd|/c calc!A0', // Potential formula injection candidate
          telegramId: '123456',
          quizTitle: 'Matematika — Algebra',
          groupName: '10-A sinf',
          totalQuestions: 5,
          correctAnswers: 5,
          incorrectAnswers: 0,
          unansweredQuestions: 0,
          score: 5,
          percentage: 100,
          timeSpentSeconds: 45,
          startedAt: '2026-10-09 10:00',
          completedAt: '2026-10-09 10:05',
        },
      ],
      detailedAnswers: [
        {
          participantName: 'Ali Valiyev',
          questionNumber: 1,
          questionText: '2 + 2 = ?',
          selectedOption: '4',
          correctOption: '4',
          isCorrect: true,
          timeSpentSeconds: 5,
        },
      ],
      questionStats: [
        {
          questionNumber: 1,
          questionText: '2 + 2 = ?',
          correctCount: 1,
          totalAnswered: 1,
          correctPercentage: 100,
        },
      ],
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify generated workbook structure
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets).toHaveLength(3);
    expect(workbook.getWorksheet('Umumiy natijalar')).toBeDefined();
    expect(workbook.getWorksheet('Batafsil javoblar')).toBeDefined();
    expect(workbook.getWorksheet('Guruh statistikasi')).toBeDefined();

    // Check injection protection on cell
    const ws1 = workbook.getWorksheet('Umumiy natijalar');
    const cellValue = ws1?.getRow(2).getCell(2).value as string;
    expect(cellValue.startsWith("'=")).toBe(true); // Sanitized!
  });
});
