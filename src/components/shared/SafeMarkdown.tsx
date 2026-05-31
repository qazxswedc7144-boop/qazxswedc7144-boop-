import React from 'react';

interface SafeMarkdownProps {
  children?: string | null;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ children }) => {
  if (!children) return null;

  // Split by line breaks supporting both Windows and Unix endings
  const blocks = children.split(/\r?\n/);

  return (
    <div className="space-y-2.5 font-cairo text-right leading-relaxed text-sm text-slate-700" dir="rtl">
      {blocks.map((block, id) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Check if heading 3 (###)
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={id} className="text-base font-black text-[#1E4D4D] mt-4 mb-2">
              {parseInlineStyles(trimmed.replace(/^###\s*/, ''))}
            </h4>
          );
        }

        // Check if heading 4 (####)
        if (trimmed.startsWith('####')) {
          return (
            <h5 key={id} className="text-sm font-black text-[#1E4D4D] mt-3 mb-1.5">
              {parseInlineStyles(trimmed.replace(/^####\s*/, ''))}
            </h5>
          );
        }

        // Check if bullet point (- or *)
        if (block.trim().startsWith('-') || block.trim().startsWith('*')) {
          const cleanText = block.trim().replace(/^[-*]\s*/, '');
          return (
            <div key={id} className="flex items-start gap-2.5 mr-4 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
              <p className="flex-1 text-[13px] font-bold text-slate-600 leading-relaxed">
                {parseInlineStyles(cleanText)}
              </p>
            </div>
          );
        }

        // Standard Paragraph
        return (
          <p key={id} className="text-[13px] font-bold text-slate-600 leading-relaxed block my-1">
            {parseInlineStyles(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// Simple inline styling for bold **text**
function parseInlineStyles(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-black text-[#1E4D4D] mx-0.5">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
