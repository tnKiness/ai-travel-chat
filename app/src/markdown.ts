// `code`, **bold**, and _italic_ — the underscores must not touch letters on the outside,
// so identifiers such as ANTHROPIC_API_KEY are left alone.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|(?<![\p{L}\p{N}_])_[^_\n]+_(?![\p{L}\p{N}_]))/u;

/** Splits a line into plain, `code`, **bold** and _italic_ runs. */
export function inlineRuns(line: string): { kind: 'plain' | 'code' | 'bold' | 'italic'; text: string }[] {
  return line.split(new RegExp(INLINE.source, 'gu')).filter(Boolean).map((part) => {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return { kind: 'code', text: part.slice(1, -1) };
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return { kind: 'bold', text: part.slice(2, -2) };
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_') && INLINE.test(part)) return { kind: 'italic', text: part.slice(1, -1) };
    return { kind: 'plain', text: part };
  });
}
