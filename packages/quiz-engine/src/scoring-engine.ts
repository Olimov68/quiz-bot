import { LeaderboardEntry } from '@smart-quiz/shared';

export interface ParticipantScoreInput {
  userId: string;
  telegramId: string;
  displayName: string;
  username?: string | null;
  score: number;
  totalQuestions: number;
  totalTimeMs: number;
  joinTimestamp: number;
}

export function calculateLeaderboard(
  participants: ParticipantScoreInput[]
): LeaderboardEntry[] {
  // Sort with tie-breaking rules:
  // 1. Higher score first
  // 2. Lower total time first
  // 3. Earlier join timestamp first
  const sorted = [...participants].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.totalTimeMs !== b.totalTimeMs) {
      return a.totalTimeMs - b.totalTimeMs;
    }
    return a.joinTimestamp - b.joinTimestamp;
  });

  return sorted.map((p, index) => {
    const percentage = p.totalQuestions > 0 ? (p.score / p.totalQuestions) * 100 : 0;
    const avgTime = p.totalQuestions > 0 ? p.totalTimeMs / p.totalQuestions : 0;

    return {
      rank: index + 1,
      userId: p.userId,
      telegramId: p.telegramId,
      displayName: p.displayName,
      username: p.username,
      score: p.score,
      totalQuestions: p.totalQuestions,
      percentage,
      totalTimeMs: p.totalTimeMs,
      averageTimePerQuestionMs: avgTime,
    };
  });
}

export function formatUzbekLeaderboardMessage(
  quizTitle: string,
  totalQuestions: number,
  leaderboard: LeaderboardEntry[],
  maxTopCount = 10
): string {
  let msg = `🏆 <b>TEST NATIJALARI</b>\n\n`;
  msg += `📚 <b>${quizTitle}</b>\n`;
  msg += `📝 <b>Jami:</b> ${totalQuestions} ta savol\n\n`;

  if (leaderboard.length === 0) {
    msg += `<i>Hali hech kim testda qatnashmadi.</i>`;
    return msg;
  }

  const medals = ['🥇', '🥈', '🥉'];

  const topList = leaderboard.slice(0, maxTopCount);
  for (const entry of topList) {
    const medalOrNum = entry.rank <= 3 ? medals[entry.rank - 1] : `${entry.rank}.`;
    const timeSec = (entry.totalTimeMs / 1000).toFixed(1);
    msg += `${medalOrNum} <b>${entry.rank}. ${escapeHtml(entry.displayName)}</b> — ${entry.score}/${totalQuestions} (${timeSec}s)\n`;
  }

  if (leaderboard.length > maxTopCount) {
    msg += `\n<i>...va yana ${leaderboard.length - maxTopCount} nafar ishtirokchi</i>\n`;
  }

  // Calculate overall average
  const totalScore = leaderboard.reduce((acc, curr) => acc + curr.score, 0);
  const avgScore = leaderboard.length > 0 ? totalScore / leaderboard.length : 0;
  const avgPct = totalQuestions > 0 ? (avgScore / totalQuestions) * 100 : 0;

  msg += `\n👥 <b>Ishtirokchilar:</b> ${leaderboard.length} nafar\n`;
  msg += `📊 <b>O'rtacha natija:</b> ${avgPct.toFixed(1)}%`;

  return msg;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
