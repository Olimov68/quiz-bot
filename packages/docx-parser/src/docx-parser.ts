import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import {
  DocxParseResult,
  ParsedQuestion,
  ParsedOption,
  ParsedIssue,
  IssueSeverity,
  IssueType,
  ExtractedMedia,
} from '@smart-quiz/shared';
import { ommlNodeToLatex } from './omml-to-latex.js';
import { extractMediaFromZip } from './media-extractor.js';
import { isChemicalExpression, formatChemicalFormulaToUnicode, normalizeReactionArrows } from './chemistry.js';

const MAX_ZIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_ZIP_ENTRIES = 1500;

interface ParagraphData {
  text: string;
  isBold: boolean;
  images: ExtractedMedia[];
  formulas: string[];
  rawNode?: any;
}

export async function parseDocxBuffer(buffer: Buffer): Promise<DocxParseResult> {
  // 1. Safety checks on ZIP structure
  const zip = new JSZip();
  let zipData: JSZip;
  try {
    zipData = await zip.loadAsync(buffer);
  } catch (err: any) {
    return {
      success: false,
      questions: [],
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      imagesCount: 0,
      formulasCount: 0,
      globalIssues: [
        {
          type: IssueType.EMPTY_QUESTION_TEXT,
          severity: IssueSeverity.ERROR,
          message: `Faylni ochishda xatolik: haqiqiy Word (.docx) fayl emas yoki fayl buzilgan. (${err.message})`,
        },
      ],
    };
  }

  // Check zip-bomb bounds
  let totalUncompressedSize = 0;
  let entryCount = 0;
  zipData.forEach((_path, file) => {
    entryCount++;
    // @ts-ignore
    const size = file._data ? file._data.uncompressedSize || 0 : 0;
    totalUncompressedSize += size;
  });

  if (entryCount > MAX_ZIP_ENTRIES || totalUncompressedSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
    return {
      success: false,
      questions: [],
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      imagesCount: 0,
      formulasCount: 0,
      globalIssues: [
        {
          type: IssueType.EMPTY_QUESTION_TEXT,
          severity: IssueSeverity.ERROR,
          message: `Xavfsizlik chegarasi: fayl juda katta yoki ruxsat etilmagan arxiv tuzilishiga ega.`,
        },
      ],
    };
  }

  // 2. Read document.xml and rels
  const docXmlFile = zipData.file('word/document.xml');
  if (!docXmlFile) {
    return {
      success: false,
      questions: [],
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      imagesCount: 0,
      formulasCount: 0,
      globalIssues: [
        {
          type: IssueType.EMPTY_QUESTION_TEXT,
          severity: IssueSeverity.ERROR,
          message: `Word fayl ichida asosiy matn (word/document.xml) topilmadi.`,
        },
      ],
    };
  }

  const docXml = await docXmlFile.async('text');
  const relsFile = zipData.file('word/_rels/document.xml.rels');
  const relsXml = relsFile ? await relsFile.async('text') : '';

  // Extract images
  const mediaMap = await extractMediaFromZip(zipData, relsXml);

  // 3. Parse XML using fast-xml-parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: false,
    trimValues: false,
  });

  const parsedDoc = parser.parse(docXml);
  const body = parsedDoc?.['w:document']?.['w:body'];
  if (!body) {
    return {
      success: false,
      questions: [],
      totalQuestions: 0,
      validQuestions: 0,
      invalidQuestions: 0,
      imagesCount: 0,
      formulasCount: 0,
      globalIssues: [
        {
          type: IssueType.EMPTY_QUESTION_TEXT,
          severity: IssueSeverity.WARNING,
          message: `Hujjat bo'sh ko'rinadi.`,
        },
      ],
    };
  }

  // 4. Extract paragraphs
  const paragraphs: ParagraphData[] = [];
  const rawParagraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']].filter(Boolean);

  for (const p of rawParagraphs) {
    const pData = extractParagraphData(p, mediaMap);
    if (pData.text.trim() || pData.images.length > 0 || pData.formulas.length > 0) {
      paragraphs.push(pData);
    }
  }

  // 5. Group into questions
  const questions = parseQuestionsFromParagraphs(paragraphs);

  // 6. Validation and metrics
  let totalImages = 0;
  let totalFormulas = 0;
  let validQuestions = 0;
  let invalidQuestions = 0;

  for (const q of questions) {
    totalImages += q.images.length;
    for (const opt of q.options) {
      if (opt.images) totalImages += opt.images.length;
    }
    totalFormulas += q.formulas.length;

    const hasErrors = q.issues.some((issue) => issue.severity === IssueSeverity.ERROR);
    if (hasErrors) {
      invalidQuestions++;
    } else {
      validQuestions++;
    }
  }

  return {
    success: questions.length > 0,
    questions,
    totalQuestions: questions.length,
    validQuestions,
    invalidQuestions,
    imagesCount: totalImages,
    formulasCount: totalFormulas,
    globalIssues: [],
  };
}

function extractParagraphData(
  pNode: any,
  mediaMap: Map<string, ExtractedMedia>
): ParagraphData {
  let text = '';
  let isBold = false;
  const images: ExtractedMedia[] = [];
  const formulas: string[] = [];

  // Check for images in drawing/pict nodes inside paragraph
  findImageRefsInNode(pNode, (rId) => {
    const media = mediaMap.get(rId);
    if (media && !images.some((m) => m.hash === media.hash)) {
      images.push(media);
    }
  });

  // Check for OMML math formulas <m:oMath> or <m:oMathPara>
  findMathInNode(pNode, (mathNode) => {
    const latex = ommlNodeToLatex(mathNode).trim();
    if (latex) {
      formulas.push(latex);
      text += ` $${latex}$ `;
    }
  });

  // Extract text runs <w:r>
  const runs = Array.isArray(pNode['w:r']) ? pNode['w:r'] : [pNode['w:r']].filter(Boolean);
  let runBoldCount = 0;

  for (const r of runs) {
    const rPr = r['w:rPr'];
    const isRunBold = rPr && (rPr['w:b'] !== undefined || rPr['w:bCs'] !== undefined);
    if (isRunBold) runBoldCount++;

    const isSubscript = rPr?.['w:vertAlign']?.['@_w:val'] === 'subscript';
    const isSuperscript = rPr?.['w:vertAlign']?.['@_w:val'] === 'superscript';

    // Text content <w:t>
    if (r['w:t'] !== undefined) {
      let t = typeof r['w:t'] === 'object' ? r['w:t']['#text'] || '' : String(r['w:t']);
      if (isSubscript) {
        t = formatChemicalFormulaToUnicode(t);
      } else if (isSuperscript) {
        t = `^${t}`;
      }
      text += t;
    }
  }

  if (runs.length > 0 && runBoldCount === runs.length) {
    isBold = true;
  }

  // Check if text has chemical reactions or formulas
  if (isChemicalExpression(text)) {
    text = normalizeReactionArrows(text);
  }

  return {
    text: text.trim(),
    isBold,
    images,
    formulas,
    rawNode: pNode,
  };
}

function findImageRefsInNode(node: any, callback: (rId: string) => void) {
  if (!node) return;
  if (node['a:blip'] && node['a:blip']['@_r:embed']) {
    callback(node['a:blip']['@_r:embed']);
  }
  if (node['v:imagedata'] && node['v:imagedata']['@_r:id']) {
    callback(node['v:imagedata']['@_r:id']);
  }

  if (Array.isArray(node)) {
    for (const item of node) findImageRefsInNode(item, callback);
  } else if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key !== '@_') {
        findImageRefsInNode(node[key], callback);
      }
    }
  }
}

function findMathInNode(node: any, callback: (mathNode: any) => void) {
  if (!node) return;
  if (node['m:oMath']) {
    callback(node['m:oMath']);
    return;
  }
  if (node['m:oMathPara']) {
    callback(node['m:oMathPara']);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) findMathInNode(item, callback);
  } else if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key !== 'w:r' && key !== '@_') {
        findMathInNode(node[key], callback);
      }
    }
  }
}

// Regular expressions for question and option detection
const QUESTION_START_REGEX = /^(?:(\d+)[\.\)]\s*|(?:Savol|Question|\d+\s*-\s*savol)[\s\:\.\-]+)(.*)/i;
const OPTION_PREFIX_REGEX = /^([\*#]?)\s*([A-Ja-j])[\.\)]\s*([\*#]?)\s*(.*)/;
const ANSWER_KEY_REGEX = /^(?:Javob|To['‘`]?g['‘`]?ri javob|Tug['‘`]?ri javob|Correct|Answer)[\s\:\-]+([A-Ja-j])/i;
const EXPLANATION_REGEX = /^(?:Izoh|Tushuntirish|Explanation)[\s\:\-]+(.*)/i;

function parseQuestionsFromParagraphs(paragraphs: ParagraphData[]): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  let currentQ: ParsedQuestion | null = null;
  let questionCounter = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.text;

    // 1. Check if this line is an Answer key (e.g. "Javob: B" or "To'g'ri javob: C")
    const answerMatch = text.match(ANSWER_KEY_REGEX);
    if (answerMatch && currentQ) {
      const correctLetter = answerMatch[1].toUpperCase();
      let matched = false;
      for (const opt of currentQ.options) {
        if (opt.letter === correctLetter) {
          opt.isCorrect = true;
          matched = true;
        }
      }
      if (!matched) {
        currentQ.issues.push({
          questionIndex: currentQ.index,
          type: IssueType.MISSING_CORRECT_ANSWER,
          severity: IssueSeverity.ERROR,
          message: `Ko'rsatilgan javob kaliti (${correctLetter}) mavjud variantlar orasida topilmadi`,
        });
      }
      continue;
    }

    // 2. Check if this line is an Explanation (e.g. "Izoh: ...")
    const explMatch = text.match(EXPLANATION_REGEX);
    if (explMatch && currentQ) {
      currentQ.explanation = explMatch[1].trim();
      continue;
    }

    // 3. Check if this line is an Option (e.g. "A) Variant" or "*C) Guido" or "A. Variant")
    const optionMatch = text.match(OPTION_PREFIX_REGEX);
    if (optionMatch && currentQ) {
      const prefixMarker = optionMatch[1];
      const letter = optionMatch[2].toUpperCase();
      const suffixMarker = optionMatch[3];
      const optText = optionMatch[4].trim();

      const isMarkedCorrect = prefixMarker === '*' || prefixMarker === '#' || suffixMarker === '*' || suffixMarker === '#';

      const opt: ParsedOption = {
        index: currentQ.options.length,
        letter,
        text: optText,
        isCorrect: isMarkedCorrect,
        images: p.images.length > 0 ? [...p.images] : undefined,
      };

      currentQ.options.push(opt);
      continue;
    }

    // 4. Check if this line is a Question start (e.g. "1. Python ..." or "Savol 1: ...")
    const qMatch = text.match(QUESTION_START_REGEX);
    if (qMatch) {
      if (currentQ) {
        finalizeQuestion(currentQ);
        questions.push(currentQ);
      }

      questionCounter++;
      const qText = qMatch[2] ? qMatch[2].trim() : text.trim();

      currentQ = {
        index: questionCounter,
        text: qText || text.trim(),
        textRaw: text,
        options: [],
        hasMath: p.formulas.length > 0,
        hasChemistry: isChemicalExpression(text),
        formulas: [...p.formulas],
        images: [...p.images],
        issues: [],
      };
      continue;
    }

    // 5. Continuation of current question or option
    if (currentQ) {
      if (currentQ.options.length > 0) {
        // Append text to the last option
        const lastOpt = currentQ.options[currentQ.options.length - 1];
        lastOpt.text += ` ${text}`;
        if (p.images.length > 0) {
          lastOpt.images = [...(lastOpt.images || []), ...p.images];
        }
      } else {
        // Append text to question body
        currentQ.text += `\n${text}`;
        if (p.images.length > 0) currentQ.images.push(...p.images);
        if (p.formulas.length > 0) currentQ.formulas.push(...p.formulas);
      }
    }
  }

  if (currentQ) {
    finalizeQuestion(currentQ);
    questions.push(currentQ);
  }

  return questions;
}

function finalizeQuestion(q: ParsedQuestion) {
  // Validate options count
  if (q.options.length < 2) {
    q.issues.push({
      questionIndex: q.index,
      type: IssueType.TOO_FEW_OPTIONS,
      severity: IssueSeverity.ERROR,
      message: `Savolda variantlar soni kam (${q.options.length} ta). Kamida 2 ta variant bo'lishi shart.`,
    });
  } else if (q.options.length > 10) {
    q.issues.push({
      questionIndex: q.index,
      type: IssueType.TOO_MANY_OPTIONS,
      severity: IssueSeverity.ERROR,
      message: `Telegram Poll ko'pi bilan 10 ta variantni qo'llab-quvvatlaydi (hozirda ${q.options.length} ta).`,
    });
  }

  // Validate correct answers
  const correctOptions = q.options.filter((o) => o.isCorrect);
  if (correctOptions.length === 0) {
    q.issues.push({
      questionIndex: q.index,
      type: IssueType.MISSING_CORRECT_ANSWER,
      severity: IssueSeverity.WARNING,
      message: `To'g'ri javob belgilanmagan (* yoki Javob: A ko'rsatilmagan).`,
    });
  } else if (correctOptions.length > 1) {
    q.issues.push({
      questionIndex: q.index,
      type: IssueType.MULTIPLE_CORRECT_ANSWERS,
      severity: IssueSeverity.WARNING,
      message: `Bir nechta to'g'ri javob belgilangan (${correctOptions.map((c) => c.letter).join(', ')}).`,
    });
  }

  // Check empty options
  for (const opt of q.options) {
    if (!opt.text.trim()) {
      q.issues.push({
        questionIndex: q.index,
        type: IssueType.EMPTY_OPTION_TEXT,
        severity: IssueSeverity.ERROR,
        message: `${opt.letter} varianti matni bo'sh.`,
      });
    }
  }

  // Telegram limits warnings
  if (q.text.length > 300) {
    q.issues.push({
      questionIndex: q.index,
      type: IssueType.QUESTION_TEXT_TOO_LONG,
      severity: IssueSeverity.INFO,
      message: `Savol matni 300 belgidan oshgan (${q.text.length} belgi). Telegram Poll oldidan to'liq matn yuboriladi.`,
    });
  }
}
