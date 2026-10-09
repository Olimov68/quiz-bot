/**
 * Converts Office Math Markup Language (OMML) node trees to clean, standard LaTeX.
 * Handles fractions, radicals, superscripts, subscripts, delimiters, n-ary operators, matrices, and symbols.
 */

export function ommlNodeToLatex(node: any): string {
  if (!node) return '';

  if (typeof node === 'string') {
    return node;
  }

  let result = '';

  // 1. Math Text <m:t>
  if (node['m:t'] !== undefined) {
    const text = typeof node['m:t'] === 'object' ? node['m:t']['#text'] || '' : String(node['m:t']);
    return mapMathSymbols(text);
  }

  // 2. Fractions <m:f>
  if (node['m:f']) {
    const fNode = node['m:f'];
    const num = ommlNodeToLatex(fNode['m:num']);
    const den = ommlNodeToLatex(fNode['m:den']);
    return `\\frac{${num}}{${den}}`;
  }

  // 3. Radicals / Roots <m:rad>
  if (node['m:rad']) {
    const radNode = node['m:rad'];
    const base = ommlNodeToLatex(radNode['m:e']);
    const deg = radNode['m:deg'] ? ommlNodeToLatex(radNode['m:deg']).trim() : '';
    if (deg && deg !== '') {
      return `\\sqrt[${deg}]{${base}}`;
    }
    return `\\sqrt{${base}}`;
  }

  // 4. Superscript <m:sSup>
  if (node['m:sSup']) {
    const supNode = node['m:sSup'];
    const base = ommlNodeToLatex(supNode['m:e']);
    const sup = ommlNodeToLatex(supNode['m:sup']);
    return `{${base}}^{${sup}}`;
  }

  // 5. Subscript <m:sSub>
  if (node['m:sSub']) {
    const subNode = node['m:sSub'];
    const base = ommlNodeToLatex(subNode['m:e']);
    const sub = ommlNodeToLatex(subNode['m:sub']);
    return `{${base}}_{${sub}}`;
  }

  // 6. Subscript & Superscript combined <m:sSubSup>
  if (node['m:sSubSup']) {
    const subSupNode = node['m:sSubSup'];
    const base = ommlNodeToLatex(subSupNode['m:e']);
    const sub = ommlNodeToLatex(subSupNode['m:sub']);
    const sup = ommlNodeToLatex(subSupNode['m:sup']);
    return `{${base}}_{${sub}}^{${sup}}`;
  }

  // 7. Delimiters (brackets, parentheses) <m:d>
  if (node['m:d']) {
    const dNode = node['m:d'];
    const begChr = dNode['m:dPr']?.['m:begChr']?.['@_m:val'] || '(';
    const endChr = dNode['m:dPr']?.['m:endChr']?.['@_m:val'] || ')';
    const content = ommlNodeToLatex(dNode['m:e']);
    const open = escapeBracket(begChr);
    const close = escapeBracket(endChr);
    return `\\left${open}${content}\\right${close}`;
  }

  // 8. N-ary operators (Sum, Integral, etc.) <m:nary>
  if (node['m:nary']) {
    const naryNode = node['m:nary'];
    const chr = naryNode['m:naryPr']?.['m:chr']?.['@_m:val'] || '∫';
    const sub = naryNode['m:sub'] ? ommlNodeToLatex(naryNode['m:sub']) : '';
    const sup = naryNode['m:sup'] ? ommlNodeToLatex(naryNode['m:sup']) : '';
    const body = naryNode['m:e'] ? ommlNodeToLatex(naryNode['m:e']) : '';

    let op = '\\int';
    if (chr === '∑' || chr === 'sum') op = '\\sum';
    if (chr === '∏' || chr === 'prod') op = '\\prod';

    let limits = '';
    if (sub) limits += `_{${sub}}`;
    if (sup) limits += `^{${sup}}`;

    return `${op}${limits} ${body}`;
  }

  // 9. Matrix <m:m>
  if (node['m:m']) {
    const mNode = node['m:m'];
    const rows = Array.isArray(mNode['m:mr']) ? mNode['m:mr'] : [mNode['m:mr']].filter(Boolean);
    const latexRows = rows.map((r: any) => {
      const cols = Array.isArray(r['m:e']) ? r['m:e'] : [r['m:e']].filter(Boolean);
      return cols.map((c: any) => ommlNodeToLatex(c)).join(' & ');
    });
    return `\\begin{matrix} ${latexRows.join(' \\\\ ')} \\end{matrix}`;
  }

  // Iterate over child properties or arrays
  if (Array.isArray(node)) {
    return node.map((item) => ommlNodeToLatex(item)).join('');
  }

  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key !== '@_' && !key.startsWith('@_')) {
        result += ommlNodeToLatex(node[key]);
      }
    }
  }

  return result;
}

function escapeBracket(ch: string): string {
  if (ch === '{') return '\\{';
  if (ch === '}') return '\\}';
  if (ch === '[') return '[';
  if (ch === ']') return ']';
  if (ch === '(') return '(';
  if (ch === ')') return ')';
  if (ch === '|') return '|';
  if (!ch) return '.';
  return ch;
}

function mapMathSymbols(text: string): string {
  let s = text;
  s = s.replace(/±/g, ' \\pm ');
  s = s.replace(/×/g, ' \\times ');
  s = s.replace(/÷/g, ' \\div ');
  s = s.replace(/≤/g, ' \\leq ');
  s = s.replace(/≥/g, ' \\geq ');
  s = s.replace(/≠/g, ' \\neq ');
  s = s.replace(/≈/g, ' \\approx ');
  s = s.replace(/∞/g, ' \\infty ');
  s = s.replace(/π/g, ' \\pi ');
  s = s.replace(/α/g, ' \\alpha ');
  s = s.replace(/β/g, ' \\beta ');
  s = s.replace(/γ/g, ' \\gamma ');
  s = s.replace(/θ/g, ' \\theta ');
  s = s.replace(/λ/g, ' \\lambda ');
  s = s.replace(/Δ/g, ' \\Delta ');
  s = s.replace(/→/g, ' \\rightarrow ');
  s = s.replace(/⇄/g, ' \\rightleftarrows ');
  return s;
}
