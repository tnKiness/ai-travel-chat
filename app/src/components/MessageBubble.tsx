import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage, ToolCall } from '../useChat';
import { colors, radius } from '../theme';
import { RichText } from './RichText';

const TOOL_LABEL: Record<ToolCall['name'], string> = {
  search_places: 'Searching places',
  get_weather: 'Checking weather',
};

function ToolChip({ tool }: { tool: ToolCall }) {
  return (
    <View style={styles.chip} accessibilityLabel={`${TOOL_LABEL[tool.name]}: ${tool.summary ?? 'in progress'}`}>
      {tool.status === 'running' ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={[styles.chipIcon, tool.status === 'error' && { color: colors.danger }]}>
          {tool.status === 'ok' ? '✓' : '!'}
        </Text>
      )}
      <Text style={styles.chipText} numberOfLines={1}>
        {tool.summary ?? `${TOOL_LABEL[tool.name]}…`}
      </Text>
    </View>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <View style={[styles.bubble, styles.user]}>
        <Text style={styles.userText}>{message.text}</Text>
      </View>
    );
  }

  const thinking = message.status === 'streaming' && !message.text && message.tools.length === 0;
  return (
    <View style={[styles.bubble, styles.assistant]}>
      {message.tools.length > 0 && (
        <View style={styles.tools}>
          {message.tools.map((t) => <ToolChip key={t.id} tool={t} />)}
        </View>
      )}
      {thinking && <ActivityIndicator color={colors.muted} style={styles.thinking} />}
      {!!message.text && <RichText text={message.text} />}
      {message.status === 'stopped' && <Text style={styles.note}>Stopped.</Text>}
      {message.error && <Text style={[styles.note, styles.error]}>{message.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '88%', borderRadius: radius, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 4 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.userBubble, borderBottomRightRadius: 4 },
  userText: { color: colors.accentText, fontSize: 15, lineHeight: 22 },
  assistant: {
    alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 8,
  },
  tools: { gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipIcon: { color: colors.accent, fontWeight: '700', width: 16, textAlign: 'center' },
  chipText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  thinking: { alignSelf: 'flex-start', paddingVertical: 4 },
  note: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  error: { color: colors.danger, fontStyle: 'normal' },
});
