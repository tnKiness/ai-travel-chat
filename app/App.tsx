import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Composer } from './src/components/Composer';
import { MessageBubble } from './src/components/MessageBubble';
import { DEMO_MODE } from './src/demo';
import { colors } from './src/theme';
import { useChat } from './src/useChat';

const SUGGESTIONS = [
  'Plan 2 days in Hội An',
  'Đà Lạt cuối tuần này thời tiết thế nào?',
  'What should I eat in Huế?',
];

function ChatScreen() {
  const { messages, busy, send, stop, reset } = useChat();
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Vietnam Travel Chat</Text>
          {DEMO_MODE && <Text style={styles.badge}>Browser demo · no AI model</Text>}
        </View>
        {messages.length > 0 && (
          <Pressable onPress={reset} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>New chat</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Where to next?</Text>
              <Text style={styles.emptyText}>Ask for places, day plans or the weather in Hà Nội, Huế, Đà Nẵng, Hội An, Đà Lạt or Sài Gòn.</Text>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestion} onPress={() => send(s)} accessibilityRole="button">
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </ScrollView>
        <Composer busy={busy} onSend={send} onStop={stop} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ChatScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  badge: { fontSize: 12, color: colors.muted, marginTop: 2 },
  link: { color: colors.accent, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 24, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: { flex: 1, justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 26, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, lineHeight: 22, color: colors.muted, marginBottom: 8 },
  suggestion: {
    alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  suggestionText: { color: colors.text, fontSize: 14 },
});
