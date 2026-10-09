'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  displayMode?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({ content, className = '', displayMode = false }) => {
  const html = useMemo(() => {
    if (!content) return '';

    // If string contains inline math like $x^2$ or $$x^2$$
    if (content.includes('$')) {
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
      return parts
        .map((part) => {
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2);
            try {
              return katex.renderToString(math, { displayMode: true, throwOnError: false });
            } catch {
              return part;
            }
          }
          if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1);
            try {
              return katex.renderToString(math, { displayMode: false, throwOnError: false });
            } catch {
              return part;
            }
          }
          return escapeHtml(part);
        })
        .join('');
    }

    // Try rendering as pure formula if requested or contains LaTeX commands
    if (displayMode || /\\(?:frac|sqrt|sum|int|alpha|beta|ce|rightarrow)/.test(content)) {
      try {
        return katex.renderToString(content, { displayMode, throwOnError: false });
      } catch {
        return escapeHtml(content);
      }
    }

    return escapeHtml(content);
  }, [content, displayMode]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
