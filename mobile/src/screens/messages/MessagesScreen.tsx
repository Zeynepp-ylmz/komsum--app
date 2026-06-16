import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { getInboxConversations, InboxConversationItem } from '../../api/messages';
import { AppStackParamList } from '../../navigation/types';
import { messageSocket } from '../../services/messageSocket';
import AntDesign from '@expo/vector-icons/AntDesign';

function formatConversationDate(value?: string) {
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

function getConversationTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function groupConversationsByUser(items: InboxConversationItem[]) {
  const groupedMap = new Map<number, InboxConversationItem>();

  for (const item of items) {
    const existingItem = groupedMap.get(item.karsi_taraf_id);

    if (!existingItem) {
      groupedMap.set(item.karsi_taraf_id, item);
      continue;
    }

    const existingTimestamp = getConversationTimestamp(existingItem.son_mesaj_tarihi);
    const nextTimestamp = getConversationTimestamp(item.son_mesaj_tarihi);

    if (nextTimestamp >= existingTimestamp) {
      groupedMap.set(item.karsi_taraf_id, {
        ...item,
        okunmamis_sayisi: existingItem.okunmamis_sayisi + item.okunmamis_sayisi,
      });
      continue;
    }

    groupedMap.set(item.karsi_taraf_id, {
      ...existingItem,
      okunmamis_sayisi: existingItem.okunmamis_sayisi + item.okunmamis_sayisi,
    });
  }

  return Array.from(groupedMap.values()).sort(
    (a, b) => getConversationTimestamp(b.son_mesaj_tarihi) - getConversationTimestamp(a.son_mesaj_tarihi),
  );
}

export function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const isFocused = useIsFocused();
  const [conversations, setConversations] = useState<InboxConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadConversations = async (refresh = false) => {
    try {
      setErrorMessage('');

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const data = await getInboxConversations();
      setConversations(groupConversationsByUser(data));
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Mesajlar yüklenemedi.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    loadConversations();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const unsubscribe = messageSocket.subscribe((event) => {
      if (event.type !== 'message:new') {
        return;
      }

      void loadConversations();
    });

    return unsubscribe;
  }, [isFocused]);

  if (isLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={APP_COLORS.secondary} />
        <Text style={styles.stateText}>Mesajlar yükleniyor...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centeredState}>
        <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadConversations()}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesajlar</Text>
        <AntDesign name="message" size={24} color="black" />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.karsi_taraf_id)}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadConversations(true)} />}
        renderItem={({ item }) => {
          const fullName = [item.karsi_taraf_ad, item.karsi_taraf_soyad].filter(Boolean).join(' ').trim();
          const avatarLetter = fullName ? fullName.charAt(0).toUpperCase() : '?';

          return (
            <Pressable
              style={styles.chatRow}
              onPress={() =>
                navigation.navigate('Chat', {
                  aliciId: item.karsi_taraf_id,
                  aliciAdSoyad: fullName,
                  ilanBaslik: item.ilan_baslik ?? undefined,
                })
              }
            >
              {item.karsi_taraf_profil_resmi ? (
                <Image source={{ uri: item.karsi_taraf_profil_resmi }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                </View>
              )}

              <View style={styles.chatContent}>
                <View style={styles.chatTopRow}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {fullName || 'Kullanici'}
                  </Text>
                  <Text style={styles.dateText}>{formatConversationDate(item.son_mesaj_tarihi)}</Text>
                </View>

                {item.ilan_baslik ? (
                  <Text style={styles.adText} numberOfLines={1}>
                    {item.ilan_baslik}
                  </Text>
                ) : null}

                <View style={styles.chatBottomRow}>
                  <Text style={styles.messagePreview} numberOfLines={1}>
                    {item.son_mesaj}
                  </Text>

                  {item.okunmamis_sayisi > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.okunmamis_sayisi}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={APP_COLORS.primary} />
            <Text style={styles.emptyTitle}>Henuz konusma yok</Text>
            <Text style={styles.emptyDescription}>
              Ilanlar uzerinden baslattigin veya aldigin mesajlar burada gorunecek.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3efe7',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f3efe7',
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
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    marginRight: 10,
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#eadfce',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    color: '#6b7280',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f3f4f6',
  },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  chatContent: {
    flex: 1,
    gap: 4,
  },
  chatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nameText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  adText: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_COLORS.secondary,
  },
  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messagePreview: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
