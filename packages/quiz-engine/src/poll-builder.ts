import { ParsedQuestion, ParsedOption } from '@smart-quiz/shared';

export interface TelegramPollPayload {
  question: string;
  options: string[];
  type: 'quiz';
  is_anonymous: boolean;
  correct_option_id: number;
  explanation?: string;
  open_period?: number;
  companionMessage?: string;
  mediaUrl?: string;
}

const TELEGRAM_MAX_QUESTION_LENGTH = 300;
const TELEGRAM_MAX_OPTION_LENGTH = 100;
const TELEGRAM_MAX_EXPLANATION_LENGTH = 200;

export function buildTelegramQuizPoll(
  q: ParsedQuestion,
  timeLimitSeconds = 30,
  isAnonymous = false
): TelegramPollPayload {
  // Find correct option index
  let correctIndex = q.options.findIndex((o) => o.isCorrect);
  if (correctIndex === -1) {
    correctIndex = 0; // Fallback
  }

  // Format options, trim to Telegram's 100 char limit
  const options = q.options.map((opt) => {
    let text = `${opt.letter}) ${opt.text}`.trim();
    if (text.length > TELEGRAM_MAX_OPTION_LENGTH) {
      text = text.substring(0, TELEGRAM_MAX_OPTION_LENGTH - 3) + '...';
    }
    return text;
  });

  // Prepare question text and optional companion message if too long
  let questionTitle = q.text.trim();
  let companionMessage: string | undefined = undefined;

  if (questionTitle.length > TELEGRAM_MAX_QUESTION_LENGTH) {
    companionMessage = `<b>Savol #${q.index}:</b>\n\n${questionTitle}`;
    questionTitle = `Savol #${q.index}: To'liq matn yuqoridagi xabarda ko'rsatilgan. Javobni tanlang:`;
  }

  // Explanation trimming
  let explanation = q.explanation?.trim();
  if (explanation && explanation.length > TELEGRAM_MAX_EXPLANATION_LENGTH) {
    explanation = explanation.substring(0, TELEGRAM_MAX_EXPLANATION_LENGTH - 3) + '...';
  }

  // Open period: Telegram Bot API requires 5 <= open_period <= 600
  let openPeriod: number | undefined = undefined;
  if (timeLimitSeconds >= 5 && timeLimitSeconds <= 600) {
    openPeriod = timeLimitSeconds;
  }

  return {
    question: questionTitle,
    options,
    type: 'quiz',
    is_anonymous: isAnonymous,
    correct_option_id: correctIndex,
    explanation: explanation || undefined,
    open_period: openPeriod,
    companionMessage,
  };
}
