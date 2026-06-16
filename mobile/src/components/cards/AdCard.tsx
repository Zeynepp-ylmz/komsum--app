import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdItem } from '../../api/ads';
import { APP_COLORS } from '../../../theme/appColor';

type AdCardProps = {
  item: AdItem;
  onPressDetail: () => void;
  onPressFavorite?: () => void;
  isFavorite?: boolean;
  onPressEdit?: () => void;
  onPressMessage?: () => void;
  onPressComment?: () => void;
};

function formatDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function AdCard({ item, onPressDetail, onPressFavorite, isFavorite = false, onPressEdit, onPressMessage, onPressComment }: AdCardProps) {
  const formattedDate = formatDate(item.tarih);
  const ownerName = [item.sahibi?.ad, item.sahibi?.soyad].filter(Boolean).join(' ').trim();
  const hasPrice = typeof item.fiyat === 'number';
  const avatarLetter = ownerName ? ownerName.charAt(0).toUpperCase() : '?';
  const ownerProfileImage = item.sahibi?.profil_resmi;

  return (
    <Pressable onPress={onPressDetail}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.ownerRow}>
            {ownerProfileImage ? (
              <Image source={{ uri: ownerProfileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
            )}

            <View style={styles.ownerMeta}>
              <Text style={styles.ownerName}>{ownerName || 'Komşu'}</Text>
              {formattedDate ? <Text style={styles.cardDate}>{formattedDate}</Text> : null}
            </View>
          </View>

          {item.kategori?.ad ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.kategori.ad}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.contentBlock}>
          <Text style={styles.cardTitle}>{item.baslik}</Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.aciklama}
          </Text>

          {hasPrice && item.kategori?.ad !== "Kayıp/Buluntu" ? (
            <Text style={styles.cardPrice}>
              {item.fiyat === 0 ? "Ücretsiz" : `${item.fiyat} TL`}
            </Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.actionsRow}>
          <View style={styles.leftActions}>
            <Pressable style={styles.actionItem} onPress={onPressFavorite} disabled={!onPressFavorite}>
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? '#dc2626' : '#6b7280'} />
              <Text style={[styles.actionText, isFavorite && styles.favoriteActionText]}>Beğen</Text>
            </Pressable>
            <Pressable style={styles.actionItem} onPress={onPressComment} disabled={!onPressComment}>
              <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
              <Text style={styles.actionText}>Yorum</Text>
            </Pressable>
            {onPressMessage ? (
              <Pressable style={styles.actionItem} onPress={onPressMessage}>
                <Ionicons name="paper-plane-outline" size={18} color="#6b7280" />
                <Text style={styles.actionText}>Mesaj</Text>
              </Pressable>
            ) : null}
            {onPressEdit ? (
              <Pressable style={styles.actionItem} onPress={onPressEdit}>
                <Ionicons name="create-outline" size={18} color={APP_COLORS.secondary} />
                <Text style={[styles.actionText, styles.editActionText]}>Düzenle</Text>
              </Pressable>
            ) : null}
          </View>


        </View>
      </View>
    </Pressable>

  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 2,
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  ownerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  ownerMeta: {
    flex: 1,
    gap: 3,
  },
  ownerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 24,
  },
  categoryBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff3e8',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: APP_COLORS.secondary,
  },
  contentBlock: {
    gap: 4,
    paddingLeft: 55
  },
  cardDescription: {
    color: '#4b5563',
    lineHeight: 21,
    fontSize: 14,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#c2410c',
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  divider: {
    height: 1,
    backgroundColor: '#edf0f3',
    marginBottom: -5
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  leftActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  favoriteActionText: {
    color: '#dc2626',
  },
  editActionText: {
    color: APP_COLORS.secondary,
  },

  detailButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
});
