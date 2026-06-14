import { useTheme } from '@/src/app/providers/ThemeContext';
import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { Author, Book, Quote } from '@/src/shared/api/types';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { BookOpen, Send, Sparkles, User as UserIcon, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
  quote: Quote;
  book: Book | null;
  author: Author | null;
  onUpdateQuote?: (updatedQuote: Quote) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'card';
  content: string;
  timestamp: Date;
}

const GlowCircle = ({ color1, x, y, scale, size = 200, opacity = 0.55, style }: any) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { scale: scale.value }
      ],
    };
  });

  const radius = size / 2;

  return (
    <Animated.View style={[{ width: size, height: size, position: 'absolute', opacity }, animatedStyle, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id={`grad-${color1}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color1} stopOpacity="1" />
            <Stop offset="60%" stopColor={color1} stopOpacity="0.4" />
            <Stop offset="100%" stopColor={color1} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill={`url(#grad-${color1})`} />
      </Svg>
    </Animated.View>
  );
};

export default function AIChatModal({ visible, onClose, quote, book, author, onUpdateQuote }: AIChatModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Apple Intelligence glowing effect shared values
  const glow1X = useSharedValue(0);
  const glow1Y = useSharedValue(0);
  const glow1Scale = useSharedValue(1);

  const glow2X = useSharedValue(0);
  const glow2Y = useSharedValue(0);
  const glow2Scale = useSharedValue(1);

  const glow3X = useSharedValue(0);
  const glow3Y = useSharedValue(0);
  const glow3Scale = useSharedValue(1);

  const glow4X = useSharedValue(0);
  const glow4Y = useSharedValue(0);
  const glow4Scale = useSharedValue(1);

  const [prevQuoteId, setPrevQuoteId] = useState<number | undefined>(undefined);
  const [prevVisible, setPrevVisible] = useState<boolean>(false);

  if (visible !== prevVisible || (visible && quote?.id !== prevQuoteId)) {
    setPrevVisible(visible);
    setPrevQuoteId(quote?.id);

    if (visible && quote) {
      const initialMessages: ChatMessage[] = [
        {
          id: 'card-msg',
          role: 'card',
          content: '',
          timestamp: new Date(0),
        },
      ];

      if (
        quote.blockData &&
        quote.blockData.chatHistory &&
        Array.isArray(quote.blockData.chatHistory) &&
        quote.blockData.chatHistory.length > 0
      ) {
        const historyMessages: ChatMessage[] = quote.blockData.chatHistory.map((m: any, idx: number) => ({
          id: `saved-${idx}-${quote.id}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(0),
        }));
        setMessages([initialMessages[0], ...historyMessages]);
      } else {
        if (quote.aiInterpretation) {
          initialMessages.push({
            id: 'analysis-msg',
            role: 'model',
            content: quote.aiInterpretation,
            timestamp: new Date(0),
          });
        } else {
          initialMessages.push({
            id: 'no-analysis-msg',
            role: 'model',
            content: "Bonjour ! Je suis votre assistant littéraire IA. Je n'ai pas encore analysé cette citation. Posez-moi une question ci-dessous ou demandez-moi de faire l'analyse initiale !",
            timestamp: new Date(0),
          });
        }
        setMessages(initialMessages);
      }
    } else if (!visible) {
      setMessages([]);
    }
  }

  // Initialize conversation animations
  useEffect(() => {
    if (visible && quote) {
      // Glow 1: Top Edge Slider (Indigo)
      glow1X.value = withRepeat(
        withSequence(
          withTiming(-130, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
          withTiming(130, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow1Y.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow1Scale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 4000 }),
          withTiming(0.85, { duration: 3500 }),
          withTiming(1.0, { duration: 4500 })
        ),
        -1,
        true
      );

      // Glow 2: Bottom Edge Slider (Pink)
      glow2X.value = withRepeat(
        withSequence(
          withTiming(130, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-130, { duration: 4800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 4500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow2Y.value = withRepeat(
        withSequence(
          withTiming(10, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow2Scale.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 3800 }),
          withTiming(1.35, { duration: 4800 }),
          withTiming(1.0, { duration: 3500 })
        ),
        -1,
        true
      );

      // Glow 3: Left Edge Slider (Cyan)
      glow3X.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow3Y.value = withRepeat(
        withSequence(
          withTiming(-75, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
          withTiming(75, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow3Scale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 3600 }),
          withTiming(0.9, { duration: 4100 }),
          withTiming(1.0, { duration: 3800 })
        ),
        -1,
        true
      );

      // Glow 4: Right Edge Slider (Blue)
      glow4X.value = withRepeat(
        withSequence(
          withTiming(10, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow4Y.value = withRepeat(
        withSequence(
          withTiming(75, { duration: 4800, easing: Easing.inOut(Easing.ease) }),
          withTiming(-75, { duration: 4400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow4Scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 4000 }),
          withTiming(0.9, { duration: 3500 }),
          withTiming(1.0, { duration: 4200 })
        ),
        -1,
        true
      );
    }
  }, [visible, quote, glow1X, glow1Y, glow1Scale, glow2X, glow2Y, glow2Scale, glow3X, glow3Y, glow3Scale, glow4X, glow4Y, glow4Scale]);

  // Scroll to bottom when message list or typing state changes
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isTyping) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    // 1. Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      // 2. Format history for backend API (excluding the citation card message)
      const chatHistory = updatedMessages
        .filter(m => m.role !== 'card')
        .map(m => ({
          role: m.role as 'user' | 'model',
          content: m.content,
        }));

      // 3. Request answer from service
      const replyText = await quoteService.chatWithAI(quote.id, chatHistory);

      // 4. Add model reply
      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: replyText,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, modelMsg];
      setMessages(finalMessages);

      // Save to local parent state to avoid reload delays
      if (onUpdateQuote) {
        const historyForSave = finalMessages
          .filter(m => m.role !== 'card')
          .map(m => ({
            role: m.role as 'user' | 'model',
            content: m.content,
          }));

        const updatedQuote: Quote = {
          ...quote,
          blockData: {
            ...(quote.blockData || {}),
            chatHistory: historyForSave,
          },
        };
        onUpdateQuote(updatedQuote);
      }
    } catch (err) {
      console.error('[AIChatModal] Error generating response:', err);
      // Fallback message
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'model',
        content: "Désolé, j'ai rencontré une petite erreur de connexion. Pouvez-vous reformuler votre question ?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteMessage = (index: number) => {
    const msg = messages[index];
    if (msg.role !== 'user') return;

    Alert.alert(
      "Supprimer le message",
      "Voulez-vous supprimer ce message ainsi que la réponse de l'IA ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            const newMessages = [...messages];
            
            // Check if the next message is the model's reply and remove both
            const nextMsg = newMessages[index + 1];
            if (nextMsg && nextMsg.role === 'model') {
              newMessages.splice(index, 2);
            } else {
              newMessages.splice(index, 1);
            }
            
            setMessages(newMessages);

            // Map and filter for storage
            const historyForSave = newMessages
              .filter(m => m.role !== 'card')
              .map(m => ({
                role: m.role as 'user' | 'model',
                content: m.content,
              }));

            const updatedBlockData = {
              ...(quote.blockData || {}),
              chatHistory: historyForSave,
            };

            const updatedQuote: Quote = {
              ...quote,
              blockData: updatedBlockData,
            };

            if (onUpdateQuote) {
              onUpdateQuote(updatedQuote);
            }

            try {
              // Asynchronously persist to backend DB
              await quoteService.updateQuote(quote.id, { blockData: updatedBlockData });
            } catch (err) {
              console.error("[AIChatModal] Error persisting message deletion:", err);
            }
          }
        }
      ]
    );
  };

  const quoteBookTitle = getBookTitle(quote.book);
  const quoteAuthorName = getAuthorName(quote.author);

  const renderCardMessage = () => {
    const hasCover = !!book?.cover;

    return (
      <View key="card" style={styles.cardContainer}>
        <View style={styles.cardBubbleWrapper}>
          <View style={styles.glowContainer}>
            {/* Top edge glow */}
            <GlowCircle color1="#8B5CF6" x={glow1X} y={glow1Y} scale={glow1Scale} size={170} opacity={isDark ? 0.38 : 0.22} style={{ top: -55, left: '20%' }} />
            {/* Bottom edge glow */}
            <GlowCircle color1="#EC4899" x={glow2X} y={glow2Y} scale={glow2Scale} size={160} opacity={isDark ? 0.38 : 0.22} style={{ bottom: -55, left: '20%' }} />
            {/* Left edge glow */}
            <GlowCircle color1="#06B6D4" x={glow3X} y={glow3Y} scale={glow3Scale} size={150} opacity={isDark ? 0.45 : 0.25} style={{ top: '15%', left: -45 }} />
            {/* Right edge glow */}
            <GlowCircle color1="#3B82F6" x={glow4X} y={glow4Y} scale={glow4Scale} size={150} opacity={isDark ? 0.45 : 0.25} style={{ top: '15%', right: -45 }} />
          </View>

          <View style={styles.cardBubble}>
            <View style={styles.cardRow}>
              {hasCover ? (
                <Image source={{ uri: book.cover }} style={styles.cardBookCover} />
              ) : (
                <View style={styles.cardBookCoverFallback}>
                  <BookOpen size={24} color={colors.primary} />
                  <Text style={styles.fallbackTitleText} numberOfLines={2}>
                    {quoteBookTitle}
                  </Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardQuoteLabel}>CITATION</Text>
                <Text style={styles.cardQuoteText} numberOfLines={4}>
                  « {quote.text} »
                </Text>
                <View style={styles.cardMeta}>
                  <UserIcon size={12} color={colors.textSecondary} />
                  <Text style={styles.cardAuthorText} numberOfLines={1}>
                    {quoteAuthorName}
                  </Text>
                </View>
                <View style={styles.cardMetaBook}>
                  <BookOpen size={12} color={colors.textTertiary} />
                  <Text style={styles.cardBookTitleText} numberOfLines={1}>
                    {quoteBookTitle}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderBubble = (msg: ChatMessage) => {
    if (msg.role === 'card') {
      return renderCardMessage();
    }

    const isUser = msg.role === 'user';

    return (
      <View
        key={msg.id}
        style={[
          styles.bubbleWrapper,
          isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperModel,
        ]}
      >
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Sparkles size={14} color="#FFF" />
          </View>
        )}
        <TouchableOpacity
          activeOpacity={isUser ? 0.85 : 1}
          onLongPress={() => {
            if (isUser) {
              const index = messages.findIndex(m => m.id === msg.id);
              if (index > -1) {
                handleDeleteMessage(index);
              }
            }
          }}
          delayLongPress={350}
          disabled={!isUser}
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleModel,
          ]}
        >
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextModel]}>
            {msg.content}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.sparkleIconBadge}>
                <Sparkles size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Assistant Littéraire IA</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {quoteAuthorName} — {quoteBookTitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Chat message list */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(renderBubble)}

            {isTyping && (
              <View style={[styles.bubbleWrapper, styles.bubbleWrapperModel]}>
                <View style={styles.assistantAvatar}>
                  <Sparkles size={14} color="#FFF" />
                </View>
                <View style={[styles.bubble, styles.bubbleModel, styles.typingBubble]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.bubbleTextModel, { fontSize: 13, fontStyle: 'italic' }]}>
                    {"L'IA réfléchit..."}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input field */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder="Posez une question sur cette citation..."
              placeholderTextColor={colors.textTertiary}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline={false}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputMessage.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputMessage.trim() || isTyping}
            >
              <Send size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: any, isDark?: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    sparkleIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      maxWidth: Dimensions.get('window').width * 0.6,
    },
    closeButton: {
      padding: 6,
    },
    chatList: {
      flex: 1,
      backgroundColor: colors.background,
    },
    chatListContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 24,
    },
    // Card Bubble
    cardContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 4,
      paddingVertical: 12,
      overflow: 'visible',
    },
    cardBubbleWrapper: {
      position: 'relative',
      width: '90%',
      borderRadius: 20,
      overflow: 'visible',
    },
    glowContainer: {
      ...StyleSheet.absoluteFill,
      overflow: 'visible',
    },
    cardBubble: {
      backgroundColor: isDark ? 'rgba(28, 28, 40, 0.78)' : 'rgba(238, 243, 255, 0.82)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.18)',
      borderRadius: 20,
      padding: 16,
      width: '100%',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
    cardRow: {
      flexDirection: 'row',
      gap: 14,
    },
    cardBookCover: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor: colors.surfaceHighlight,
    },
    cardBookCoverFallback: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 6,
      gap: 4,
    },
    fallbackTitleText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    cardContent: {
      flex: 1,
      justifyContent: 'center',
    },
    cardQuoteLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.primary,
      marginBottom: 6,
    },
    cardQuoteText: {
      fontSize: 15,
      color: colors.text,
      fontStyle: 'italic',
      fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
      lineHeight: 21,
      marginBottom: 8,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    cardMetaBook: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    cardAuthorText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    cardBookTitleText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    // Standard Bubbles
    bubbleWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      width: '100%',
      gap: 8,
    },
    bubbleWrapperUser: {
      justifyContent: 'flex-end',
    },
    bubbleWrapperModel: {
      justifyContent: 'flex-start',
    },
    assistantAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    bubble: {
      maxWidth: '75%',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    bubbleUser: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleModel: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceHighlight,
      borderBottomLeftRadius: 4,
    },
    typingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 20,
    },
    bubbleTextUser: {
      color: '#FFFFFF',
      fontWeight: '400',
    },
    bubbleTextModel: {
      color: colors.text,
    },
    // Reply Input Bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: 12,
    },
    textInput: {
      flex: 1,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      fontSize: 14,
      color: colors.text,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.textTertiary,
      opacity: 0.6,
    },
  });
