import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { APP_COLORS } from '../../../theme/appColor';
import { CommentItem, createComment, deleteComment, getComments } from '../../api/comments';
import { CurrentUser, getCurrentUser } from '../../api/users';
import { AppStackParamList } from '../../navigation/types';

function formatCommentDate(value?: string) {
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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function CommentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'Comments'>>();
  const isFocused = useIsFocused();
  const { adId, adTitle } = route.params;
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadComments = async () => {
    try {
      setErrorMessage('');
      const [commentsData, userData] = await Promise.all([getComments(adId), getCurrentUser()]);
      setComments(commentsData);
      setCurrentUser(userData);
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Yorumlar yuklenemedi.';
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
    loadComments();
  }, [adId, isFocused]);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      Alert.alert('Eksik Alan', 'Yorum icerigi bos olamaz.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createComment(adId, {
        icerik: trimmedContent,
        puan: rating,
      });
      setContent('');
      setRating(5);
      await loadComments();
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Yorum gonderilemedi.';
      Alert.alert('Hata', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await deleteComment(commentId);
      await loadComments();
    } catch (error: any) {
      const message = error?.response?.data?.detail || 'Yorum silinemedi.';
      Alert.alert('Hata', message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Yorumlar</Text>
          {adTitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{adTitle}</Text> : null}
        </View>

        <View style={styles.backButtonPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={APP_COLORS.secondary} />
          <Text style={styles.stateText}>Yorumlar yukleniyor...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={36} color="#b91c1c" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={loadComments}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={comments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={comments.length === 0 ? styles.emptyContainer : styles.listContent}
            renderItem={({ item }) => {
              const fullName = [item.yazan_ad, item.yazan_soyad].filter(Boolean).join(' ').trim();
              const avatarLetter = fullName ? fullName.charAt(0).toUpperCase() : '?';
              const isOwnComment = currentUser?.id === item.yazan_kullanici_id;

              return (
                <View style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={styles.authorRow}>
                      {item.yazan_profil_resmi ? (
                        <Image source={{ uri: item.yazan_profil_resmi }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                        </View>
                      )}

                      <View style={styles.authorMeta}>
                        <Text style={styles.authorName}>{fullName || 'Kullanici'}</Text>
                        <Text style={styles.commentDate}>{formatCommentDate(item.tarih)}</Text>
                      </View>
                    </View>

                    {isOwnComment ? (
                      <Pressable onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.ratingRow}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Ionicons
                        key={`${item.id}-${index}`}
                        name={index < item.puan ? 'star' : 'star-outline'}
                        size={16}
                        color={index < item.puan ? '#f59e0b' : '#9ca3af'}
                      />
                    ))}
                  </View>

                  <Text style={styles.commentText}>{item.icerik}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={38} color={APP_COLORS.primary} />
                <Text style={styles.emptyTitle}>Henuz yorum yok</Text>
                <Text style={styles.emptyDescription}>Bu ilan icin ilk yorumu sen yapabilirsin.</Text>
              </View>
            }
          />

          <View style={styles.inputSection}>
            <Text style={styles.inputSectionTitle}>Yorum Yap</Text>

            <View style={styles.ratingSelector}>
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                return (
                  <Pressable key={value} onPress={() => setRating(value)} style={styles.ratingButton}>
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={24}
                      color={value <= rating ? '#f59e0b' : '#9ca3af'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Yorumunu yaz..."
              placeholderTextColor="#9ca3af"
              style={styles.input}
              multiline
            />

            <Pressable
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>{isSubmitting ? 'Gonderiliyor...' : 'Yorumu Gonder'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 12,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
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
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  commentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.primary,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  authorMeta: {
    flex: 1,
    gap: 2,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  commentDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  inputSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  ratingSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingButton: {
    padding: 2,
  },
  input: {
    minHeight: 88,
    maxHeight: 140,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_COLORS.secondary,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
