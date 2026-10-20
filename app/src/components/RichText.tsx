import { Fragment } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { inlineRuns } from '../markdown';
import { colors } from '../theme';

function inline(line: string, color: string) {
  return inlineRuns(line).map((run, i) => {
    if (run.kind === 'plain') return <Fragment key={i}>{run.text}</Fragment>;
    const style = run.kind === 'code' ? styles.code : run.kind === 'bold' ? styles.bold : styles.italic;
    return <Text key={i} style={[style, { color }]}>{run.text}</Text>;
  });
}

/**
 * Minimal Markdown for chat answers: paragraphs, "- " bullets, bold and italic.
 * Enough for travel answers without pulling in a full Markdown renderer.
 */
export function RichText({ text, color = colors.text }: { text: string; color?: string }) {
  const lines = text.split('\n');
  return (
    <View style={styles.block}>
      {lines.map((line, i) => {
        if (!line.trim()) return <View key={i} style={styles.gap} />;
        const bullet = /^\s*[-*•]\s+/.exec(line);
        if (bullet) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.text, { color }]}>•</Text>
              <Text style={[styles.text, styles.bulletText, { color }]}>{inline(line.slice(bullet[0].length), color)}</Text>
            </View>
          );
        }
        return <Text key={i} style={[styles.text, { color }]}>{inline(line, color)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  gap: { height: 6 },
  text: { fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 14 },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 2 },
  bulletText: { flex: 1 },
});
