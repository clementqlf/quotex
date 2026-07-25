import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { useRouter } from '@/src/shared/navigation/useRouter';
import { Avatar } from '@/src/shared/ui/Avatar';
import { TabBar } from '@/src/shared/ui/TabBar';
import { ThemeColors } from '@/src/shared/theme';

export interface UserTabOption<T = string> {
  key: T;
  label: string;
}

export interface UserListModalProps<T = string> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  users: any[];
  isLoading?: boolean;
  emptyText?: string;
  tabs?: UserTabOption<T>[];
  activeTab?: T;
  onTabChange?: (tabKey: T) => void;
  onUserPress?: (user: any) => void;
}

export function UserListModal<T = string>({
  visible,
  onClose,
  title,
  icon,
  users,
  isLoading = false,
  emptyText = 'Aucun utilisateur trouvé.',
  tabs,
  activeTab,
  onTabChange,
  onUserPress,
}: UserListModalProps<T>) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUserPress = (user: any) => {
    onClose();
    if (onUserPress) {
      onUserPress(user);
    } else if (user.username) {
      router.navigate(`/user-profile?username=${user.username}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            {tabs && tabs.length > 0 && activeTab && onTabChange ? (
              <TabBar
                tabs={tabs.map(t => ({ id: String(t.key), label: t.label }))}
                activeTab={String(activeTab)}
                onTabPress={(tabId) => onTabChange(tabId as unknown as T)}
                style={{ flex: 1, paddingHorizontal: 0, paddingBottom: 0, borderBottomWidth: 0, backgroundColor: 'transparent' }}
              />
            ) : (
              <View style={styles.titleContainer}>
                {icon && <View style={styles.iconWrapper}>{icon}</View>}
                {title && <Text style={styles.modalTitle}>{title}</Text>}
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
              accessible={true}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            >
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.modalBody}>
            {isLoading ? (
              <View style={styles.modalLoaderContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : users.length > 0 ? (
              <ScrollView
                contentContainerStyle={styles.modalListContent}
                showsVerticalScrollIndicator={false}
              >
                {users.map((user: any, index: number) => (
                  <TouchableOpacity
                    key={user.id || user.username || index}
                    style={styles.userRow}
                    onPress={() => handleUserPress(user)}
                    activeOpacity={0.7}
                  >
                    <Avatar
                      user={user}
                      size={48}
                      style={styles.userRowAvatar}
                      textStyle={styles.userRowAvatarText}
                    />
                    <View style={styles.userRowInfo}>
                      <Text style={styles.userRowName}>{user.name || user.username || 'Utilisateur'}</Text>
                      {user.username && (
                        <Text style={styles.userRowUsername}>@{user.username}</Text>
                      )}
                      {user.bio ? (
                        <Text style={styles.userRowBio} numberOfLines={1}>
                          {user.bio}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>{emptyText}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '80%',
      minHeight: '40%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    modalTabs: {
      flexDirection: 'row',
      gap: 16,
    },
    modalTabButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    modalTabButtonActive: {
      borderBottomColor: colors.primary,
    },
    modalTabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalTabTextActive: {
      color: colors.primary,
    },
    modalCloseButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: colors.surfaceHighlight,
    },
    modalBody: {
      flex: 1,
    },
    modalLoaderContainer: {
      flex: 1,
      paddingVertical: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalListContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingBottom: 32,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceHighlight,
    },
    userRowAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
    },
    userRowAvatarText: {
      color: colors.primary,
      fontWeight: 'bold',
      fontSize: 18,
    },
    userRowInfo: {
      flex: 1,
      marginLeft: 12,
      justifyContent: 'center',
    },
    userRowName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    userRowUsername: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 2,
    },
    userRowBio: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    modalEmptyContainer: {
      flex: 1,
      paddingVertical: 40,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalEmptyText: {
      color: colors.textTertiary,
      fontSize: 14,
      textAlign: 'center',
    },
  });
