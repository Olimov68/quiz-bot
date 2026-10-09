import { describe, it, expect } from 'vitest';
import { ommlNodeToLatex } from '../src/omml-to-latex.js';
import {
  isChemicalExpression,
  formatChemicalFormulaToUnicode,
  normalizeReactionArrows,
} from '../src/chemistry.js';
import { parseDocxBuffer } from '../src/docx-parser.js';
import JSZip from 'jszip';

describe('OMML to LaTeX Converter', () => {
  it('converts fractions <m:f>', () => {
    const fractionNode = {
      'm:f': {
        'm:num': { 'm:t': 'x + 1' },
        'm:den': { 'm:t': 'y - 2' },
      },
    };
    expect(ommlNodeToLatex(fractionNode)).toBe('\\frac{x + 1}{y - 2}');
  });

  it('converts radicals <m:rad>', () => {
    const sqrtNode = {
      'm:rad': {
        'm:e': { 'm:t': 'x^2 + 1' },
      },
    };
    expect(ommlNodeToLatex(sqrtNode)).toBe('\\sqrt{x^2 + 1}');

    const cubeRootNode = {
      'm:rad': {
        'm:deg': { 'm:t': '3' },
        'm:e': { 'm:t': '8' },
      },
    };
    expect(ommlNodeToLatex(cubeRootNode)).toBe('\\sqrt[3]{8}');
  });

  it('converts superscripts and subscripts', () => {
    const supNode = {
      'm:sSup': {
        'm:e': { 'm:t': 'x' },
        'm:sup': { 'm:t': '2' },
      },
    };
    expect(ommlNodeToLatex(supNode)).toBe('{x}^{2}');

    const subNode = {
      'm:sSub': {
        'm:e': { 'm:t': 'H' },
        'm:sub': { 'm:t': '2' },
      },
    };
    expect(ommlNodeToLatex(subNode)).toBe('{H}_{2}');
  });

  it('maps math symbols correctly', () => {
    const symbolNode = {
      'm:t': '± × ≤ ≥ π',
    };
    expect(ommlNodeToLatex(symbolNode)).toBe(' \\pm   \\times   \\leq   \\geq   \\pi ');
  });
});

describe('Chemistry Notation', () => {
  it('detects chemical reactions and formulas', () => {
    expect(isChemicalExpression('CH4 + 2O2 -> CO2 + 2H2O')).toBe(true);
    expect(isChemicalExpression('H2SO4 konsentrlangan kislota')).toBe(true);
    expect(isChemicalExpression('Bugun havo juda yaxshi')).toBe(false);
  });

  it('formats chemical numbers to unicode subscripts', () => {
    expect(formatChemicalFormulaToUnicode('H2SO4')).toBe('H₂SO₄');
    expect(formatChemicalFormulaToUnicode('CaCO3')).toBe('CaCO₃');
    expect(formatChemicalFormulaToUnicode('CH3COOH')).toBe('CH₃COOH');
  });

  it('normalizes reaction arrows', () => {
    expect(normalizeReactionArrows('CH4 + 2O2 -> CO2 + 2H2O')).toBe('CH4 + 2O2 → CO2 + 2H2O');
    expect(normalizeReactionArrows('N2 + 3H2 <=> 2NH3')).toBe('N2 + 3H2 ⇄ 2NH3');
  });
});

describe('DOCX Parser Integration', () => {
  it('rejects invalid or corrupted buffer gracefully', async () => {
    const invalidBuffer = Buffer.from('NOT_A_VALID_DOCX');
    const result = await parseDocxBuffer(invalidBuffer);
    expect(result.success).toBe(false);
    expect(result.questions).toHaveLength(0);
    expect(result.globalIssues.length).toBeGreaterThan(0);
  });

  it('parses valid synthetic docx containing questions with * and Javob: key', async () => {
    const zip = new JSZip();

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <w:body>
    <!-- Question 1 -->
    <w:p><w:r><w:t>1. Python tilini kim yaratgan?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A) Dennis Ritchie</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) James Gosling</w:t></w:r></w:p>
    <w:p><w:r><w:t>*C) Guido van Rossum</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) Bjarne Stroustrup</w:t></w:r></w:p>

    <!-- Question 2 with Suffix Answer Key -->
    <w:p><w:r><w:t>2. O‘zbekiston poytaxti qaysi shahar?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A) Samarqand</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) Toshkent</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) Buxoro</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) Xiva</w:t></w:r></w:p>
    <w:p><w:r><w:t>Javob: B</w:t></w:r></w:p>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);
    zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await parseDocxBuffer(buffer);

    expect(result.success).toBe(true);
    expect(result.totalQuestions).toBe(2);
    expect(result.questions[0].text).toContain('Python tilini kim yaratgan?');
    expect(result.questions[0].options).toHaveLength(4);
    expect(result.questions[0].options[2].isCorrect).toBe(true); // C) Guido van Rossum
    expect(result.questions[0].options[2].text).toBe('Guido van Rossum');

    expect(result.questions[1].text).toContain('O‘zbekiston poytaxti qaysi shahar?');
    expect(result.questions[1].options[1].isCorrect).toBe(true); // B) Toshkent
  });
});
