import ExcelJS from 'exceljs';

export interface GeneralResultRow {
  index: number;
  fullName: string;
  telegramId: string;
  quizTitle: string;
  groupName: string;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  score: number;
  percentage: number;
  timeSpentSeconds: number;
  startedAt: string;
  completedAt: string;
}

export interface DetailedAnswerRow {
  participantName: string;
  questionNumber: number;
  questionText: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface QuestionStatRow {
  questionNumber: number;
  questionText: string;
  correctCount: number;
  totalAnswered: number;
  correctPercentage: number;
}

export interface ExcelExportData {
  quizTitle: string;
  groupName: string;
  generalResults: GeneralResultRow[];
  detailedAnswers: DetailedAnswerRow[];
  questionStats: QuestionStatRow[];
}

/**
 * Sanitizes cell text to prevent Excel Formula Injection (CSV/formula injection).
 */
function sanitizeCellText(val: any): any {
  if (typeof val !== 'string') return val;
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some((prefix) => val.startsWith(prefix))) {
    return `'${val}`;
  }
  return val;
}

export async function generateQuizExcelReport(data: ExcelExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Quiz Platform';
  workbook.created = new Date();

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' }, // Deep Navy
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFF' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } },
  };

  // -------------------------------------------------------------
  // Sheet 1: Umumiy natijalar (General Results)
  // -------------------------------------------------------------
  const ws1 = workbook.addWorksheet('Umumiy natijalar', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws1.columns = [
    { header: '№', key: 'index', width: 6 },
    { header: 'F.I.Sh.', key: 'fullName', width: 28 },
    { header: 'Telegram ID', key: 'telegramId', width: 16 },
    { header: 'Test nomi', key: 'quizTitle', width: 26 },
    { header: 'Guruh', key: 'groupName', width: 18 },
    { header: 'Savollar soni', key: 'totalQuestions', width: 14 },
    { header: "To'g'ri javoblar", key: 'correctAnswers', width: 16 },
    { header: "Noto'g'ri javoblar", key: 'incorrectAnswers', width: 16 },
    { header: 'Javobsiz savollar', key: 'unansweredQuestions', width: 16 },
    { header: 'Ball', key: 'score', width: 10 },
    { header: 'Foiz (%)', key: 'percentage', width: 12 },
    { header: 'Sarflangan vaqt (s)', key: 'timeSpentSeconds', width: 18 },
    { header: 'Boshlangan sana', key: 'startedAt', width: 20 },
    { header: 'Tugatilgan sana', key: 'completedAt', width: 20 },
  ];

  // Style header row
  const row1 = ws1.getRow(1);
  row1.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row1.height = 28;

  // Add data rows
  data.generalResults.forEach((r, idx) => {
    const row = ws1.addRow({
      index: r.index || idx + 1,
      fullName: sanitizeCellText(r.fullName),
      telegramId: sanitizeCellText(r.telegramId),
      quizTitle: sanitizeCellText(r.quizTitle),
      groupName: sanitizeCellText(r.groupName),
      totalQuestions: r.totalQuestions,
      correctAnswers: r.correctAnswers,
      incorrectAnswers: r.incorrectAnswers,
      unansweredQuestions: r.unansweredQuestions,
      score: r.score,
      percentage: Number(r.percentage.toFixed(1)),
      timeSpentSeconds: Number(r.timeSpentSeconds.toFixed(1)),
      startedAt: sanitizeCellText(r.startedAt),
      completedAt: sanitizeCellText(r.completedAt),
    });

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
    });

    // Zebra striping
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F9FAFB' },
        };
      });
    }
  });

  // -------------------------------------------------------------
  // Sheet 2: Batafsil javoblar (Detailed Answers)
  // -------------------------------------------------------------
  const ws2 = workbook.addWorksheet('Batafsil javoblar', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws2.columns = [
    { header: 'Ishtirokchi', key: 'participantName', width: 28 },
    { header: 'Savol №', key: 'questionNumber', width: 10 },
    { header: 'Savol matni', key: 'questionText', width: 45 },
    { header: 'Tanlangan javob', key: 'selectedOption', width: 22 },
    { header: "To'g'ri javob", key: 'correctOption', width: 22 },
    { header: 'Holati', key: 'status', width: 14 },
    { header: 'Vaqt (s)', key: 'timeSpentSeconds', width: 12 },
  ];

  const row2Header = ws2.getRow(1);
  row2Header.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row2Header.height = 28;

  data.detailedAnswers.forEach((ans, idx) => {
    const statusText = ans.isCorrect ? "To'g'ri" : "Noto'g'ri";
    const row = ws2.addRow({
      participantName: sanitizeCellText(ans.participantName),
      questionNumber: ans.questionNumber,
      questionText: sanitizeCellText(ans.questionText),
      selectedOption: sanitizeCellText(ans.selectedOption),
      correctOption: sanitizeCellText(ans.correctOption),
      status: statusText,
      timeSpentSeconds: Number(ans.timeSpentSeconds.toFixed(1)),
    });

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      // Column 6: Holati
      if (colNumber === 6) {
        cell.font = { bold: true, color: { argb: ans.isCorrect ? '059669' : 'DC2626' } };
      }
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F9FAFB' },
          };
        }
      });
    }
  });

  // -------------------------------------------------------------
  // Sheet 3: Guruh statistikasi (Group Statistics)
  // -------------------------------------------------------------
  const ws3 = workbook.addWorksheet('Guruh statistikasi');

  // Summary Metrics Table
  const totalParticipants = data.generalResults.length;
  const scores = data.generalResults.map((r) => r.score);
  const avgScore = totalParticipants > 0 ? (scores.reduce((a, b) => a + b, 0) / totalParticipants).toFixed(1) : 0;
  const maxScore = totalParticipants > 0 ? Math.max(...scores) : 0;
  const minScore = totalParticipants > 0 ? Math.min(...scores) : 0;
  const percentages = data.generalResults.map((r) => r.percentage);
  const avgPct = totalParticipants > 0 ? (percentages.reduce((a, b) => a + b, 0) / totalParticipants).toFixed(1) : 0;

  ws3.addRow(['GURUH VA TEST UMUMIY KO‘RSATKICHLARI']);
  ws3.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1E3A8A' } };
  ws3.addRow([]);

  const summaryData = [
    ['Test mavzusi:', data.quizTitle],
    ['Guruh nomi:', data.groupName],
    ['Jami qatnashchilar:', totalParticipants],
    ['O‘rtacha ball:', `${avgScore}`],
    ['Eng yuqori ball:', `${maxScore}`],
    ['Eng past ball:', `${minScore}`],
    ['O‘rtacha muvaffaqiyat foizi:', `${avgPct}%`],
  ];

  summaryData.forEach(([label, value]) => {
    const row = ws3.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(1).border = thinBorder;
    row.getCell(2).border = thinBorder;
  });

  ws3.addRow([]);
  ws3.addRow(['SAVOLLAR KESIMIDAGI STATISTIKA']);
  const titleRow = ws3.getRow(ws3.rowCount);
  titleRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: '1E3A8A' } };

  const tableHeaderRow = ws3.addRow([
    'Savol №',
    'Savol matni',
    "To'g'ri javoblar soni",
    'Jami javob berganlar',
    "Muvaffaqiyat foizi (%)",
  ]);
  tableHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  data.questionStats.forEach((qStat) => {
    const r = ws3.addRow([
      qStat.questionNumber,
      sanitizeCellText(qStat.questionText),
      qStat.correctCount,
      qStat.totalAnswered,
      Number(qStat.correctPercentage.toFixed(1)),
    ]);
    r.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
    });
  });

  ws3.columns = [
    { width: 12 },
    { width: 45 },
    { width: 22 },
    { width: 22 },
    { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
