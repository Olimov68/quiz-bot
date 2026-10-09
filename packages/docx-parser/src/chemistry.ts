/**
 * Utilities for recognizing and formatting chemical formulas and equations.
 */

// Common chemical patterns: formulas, reactions, organic notation
const CHEMICAL_REACTION_REGEX = /(?:[A-Z][a-z]?\d*(?:\([A-Za-z0-9]+\)\d*)?|[A-Z][a-z]?[\+\-]\d*)\s*(?:\+|\=|\→|\->|\<\=\>|\⇄)\s*(?:[A-Z][a-z]?\d*)/;
const CHEMICAL_FORMULA_CANDIDATE_REGEX = /\b([A-Z][a-z]?\d{1,4}(?:[A-Z][a-z]?\d{0,4})*(?:\([A-Za-z0-9]+\)\d{0,4})*)\b/;

export function isChemicalExpression(text: string): boolean {
  if (!text || text.length < 2) return false;
  if (CHEMICAL_REACTION_REGEX.test(text)) return true;
  
  // Check common indicators: H2O, CO2, H2SO4, CaCO3, KMnO4, NaCl, CH3COOH, C2H5OH
  const commonChemicals = [
    'H2SO4', 'H₂SO₄', 'CaCO3', 'CaCO₃', 'KMnO4', 'CH4', 'CO2', 'CO₂', 'H2O', 'H₂O',
    'NaOH', 'HCl', 'HNO3', 'NaCl', 'C6H12O6', 'C2H5OH', 'CH3-CH2-OH', 'CH2=CH2',
    'Fe2O3', 'CuSO4', 'NH3', 'NH4Cl', 'Al2O3', 'BaSO4', 'AgNO3'
  ];

  for (const chem of commonChemicals) {
    if (text.includes(chem)) return true;
  }

  return false;
}

/**
 * Converts plain chemical formula with numbers (e.g. H2SO4, CaCO3)
 * to subscripted representation (e.g. H₂SO₄, CaCO₃) or LaTeX \ce{...}.
 */
export function formatChemicalFormulaToUnicode(formula: string): string {
  const subscriptMap: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
    '+': '⁺',
    '-': '⁻',
  };

  // Convert numbers that immediately follow chemical element symbols to subscripts
  return formula.replace(/([A-Za-z\)])(\d+)/g, (_match, prefix, digits) => {
    const subs = digits
      .split('')
      .map((d: string) => subscriptMap[d] || d)
      .join('');
    return `${prefix}${subs}`;
  });
}

/**
 * Formats reaction arrows (-> to →, <=> to ⇄)
 */
export function normalizeReactionArrows(text: string): string {
  return text
    .replace(/<->|<=>/g, ' ⇄ ')
    .replace(/->|-->/g, ' → ')
    .replace(/\s+/g, ' ')
    .trim();
}
