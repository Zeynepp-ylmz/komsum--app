import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { getConversation, markConversationAsRead, MessageItem, sendMessage } from '../../api/messages';
import { CurrentUser, getCurrentUser } from '../../api/users';
import { AppStackParamList } from '../../navigation/types';
import { messageSocket } from '../../services/messageSocket';

function formatMessageDate(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'Chat'>>();
  const isFocused = useIsFocused();
  const { aliciId, ilanId, aliciAdSoyad, ilanBaslik } = route.params;
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const appendMessageIfMissing = (message: MessageItem) => {
    setMessages((currentMessages) => {
      if (currentMessages.some((item) => item.id === message.id)) {
        return currentMessages;
      }

      return [...currentMessages, message].sort(
        (left, right) => new Date(left.tarih).getTime() - new Date(right.tarih).getTime(),
      );
    });
  };

  const markMessagesAsRead = (messageIds: number[]) => {
    if (messageIds.length === 0) {
      return;
    }

    const readMessageIds = new Set(messageIds);
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        readMessageIds.has(message.id) ? { ...message, okundu: true } : message,
      ),
    );
  };

  const loadConversation = async () => {
    try {
      setErrorMessage('');
      const [conversation, user] = await Promise.all([getConversation(aliciId), getCurrentUser()]);
      setMessages(conversation);
      setCurrentUser(user);

      await markConversationAsRead(aliciId, ilanId);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Sohbet yüklenemedi.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    setIsLoading(true);
    loadConversation();
  }, [aliciId, ilanId, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const unsubscribe = messageSocket.subscribe((event) => {
      if (event.type === 'message:new' && event.message) {
        const incomingMessage = event.message;
        const isCurrentConversation =
          incomingMessage.gonderen_id === aliciId &&
          incomingMessage.alici_id === currentUser?.id &&
          (incomingMessage.ilan_id ?? null) === (ilanId ?? null);

        if (!isCurrentConversation) {
          return;
        }

        appendMessageIfMissing(incomingMessage);
        return;
      }

      if (event.type !== 'conversation:read') {
        return;
      }

      const isCurrentConversation =
        event.reader_id === aliciId &&
        event.other_user_id === currentUser?.id &&
        (event.ilan_id ?? null) === (ilanId ?? null);

      if (!isCurrentConversation || !event.read_message_ids?.length) {
        return;
      }

      markMessagesAsRead(event.read_message_ids);
    });

    return unsubscribe;
  }, [aliciId, currentUser?.id, ilanId, isFocused]);

  const handleSend = async () => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage('');
      await sendMessage({
        metin: trimmedMessage,
        alici_id: aliciId,
        ilan_id: ilanId,
      });
      setMessageText('');
      await loadConversation();
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Mesaj gönderilemedi.';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{aliciAdSoyad || 'Sohbet'}</Text>
          {ilanBaslik ? <Text style={styles.headerSubtitle}>{ilanBaslik}</Text> : null}
        </View>

        <View style={styles.backButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={APP_COLORS.secondary} />
          <Text style={styles.stateText}>Sohbet yükleniyor...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={loadConversation}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
            renderItem={({ item }) => {
              const isOwnMessage = item.gonderen_id === currentUser?.id;

              return (
                <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : styles.messageRowOther]}>
                  <View style={[styles.bubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
                    <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>{item.metin}</Text>
                    <View style={styles.messageMetaRow}>
                      <Text style={[styles.messageDate, isOwnMessage && styles.ownMessageDate]}>
                        {formatMessageDate(item.tarih)}
                      </Text>
                      {isOwnMessage ? (
                        <Text style={[styles.readIndicator, item.okundu ? styles.readIndicatorRead : styles.readIndicatorUnread]}>
                          ✓✓
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={APP_COLORS.primary} />
                <Text style={styles.emptyTitle}>Henuz mesaj yok</Text>
                <Text style={styles.emptyDescription}>Bu kisiyle ilk mesaji sen gonderebilirsin.</Text>
              </View>
            }
          />

          <View style={styles.inputBar}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Mesaj yaz..."
              placeholderTextColor="#9ca3af"
              style={styles.input}
              multiline
            />
            <Pressable
              style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
            >
              <Text style={styles.sendButtonText}>{isSending ? '...' : 'Gönder'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#f3efe7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    marginTop: 14,
    fontSize: 16,
    color: '#4b5563',
  },
  errorText: {
    marginTop: 12,
    marginBottom: 18,
    fontSize: 16,
    lineHeight: 24,
    color: '#991b1b',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: APP_COLORS.secondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  ownBubble: {
    backgroundColor: APP_COLORS.secondary,
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#1f2937',
  },
  ownMessageText: {
    color: '#ffffff',
  },
  messageDate: {
    fontSize: 11,
    color: '#6b7280',
    alignSelf: 'flex-end',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  ownMessageDate: {
    color: '#f3f4f6',
  },
  readIndicator: {
    fontSize: 11,
    fontWeight: '700',
  },
  readIndicatorRead: {
    color: '#60a5fa',
  },
  readIndicatorUnread: {
    color: '#d1d5db',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.secondary,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
