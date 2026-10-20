import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_MESSAGE_LENGTH } from '@travel/shared';
import { colors } from '../theme';

interface Props {
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const canSend = !busy && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ask about a city, a day plan, the weather…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={MAX_MESSAGE_LENGTH}
        onSubmitEditing={submit}
        submitBehavior="submit"
        accessibilityLabel="Message"
      />
      {busy ? (
        <Pressable style={[styles.button, styles.stop]} onPress={onStop} accessibilityRole="button" accessibilityLabel="Stop answering">
          <Text style={styles.buttonText}>■</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, !canSend && styles.disabled]}
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Text style={styles.buttonText}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.bg },
  input: {
    flex: 1, minHeight: 44, maxHeight: 140, fontSize: 15, color: colors.text,
    backgroundColor: colors.surface, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stop: { backgroundColor: colors.text },
  disabled: { opacity: 0.4 },
  buttonText: { color: colors.accentText, fontSize: 18, fontWeight: '700' },
});
