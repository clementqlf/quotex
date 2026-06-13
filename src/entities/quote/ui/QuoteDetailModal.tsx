import { InteractiveTooltip, TOUR_STEPS, useAppTourState } from '@/src/features/app-tour';
import { useSmartNavigation } from '@/src/shared/lib/hooks/useSmartNavigation';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Calendar, CheckCircle2, Edit3, Heart, Plus, Share2, Sparkles, Trash2, User as UserIcon, X } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import type { SortableGridRenderItem } from 'react-native-sortables';
import Sortable from 'react-native-sortables';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

// Removed walkthroughable components
import { useTheme } from '@/src/app/providers/ThemeContext';
import { authorService } from '@/src/entities/author/api/AuthorService';
import { useAuthor } from '@/src/entities/author/providers/AuthorProvider';
import { quoteService } from '@/src/entities/quote/api/QuoteService';
import { useQuote } from '@/src/entities/quote/providers/QuoteProvider';
import { fetchDefinition } from '@/src/features/dictionary/api/WiktionaryService';
import WordSelectionModal from '@/src/features/dictionary/ui/WordSelectionModal';
import AddBlockModal from '@/src/features/edit-book/ui/AddBlockModal';
import ScanPreviewModal from '@/src/features/scanner/ui/ScanPreviewModal';
import ResourceSearchModal from '@/src/features/search/ui/ResourceSearchModal';
import { BlockService } from '@/src/shared/api/BlockService';
import { Author, Book, Quote } from '@/src/shared/api/types';
import { BLOCK_CONFIGS, QUOTE_DETAIL_BLOCK_OPTIONS } from '@/src/shared/config/blocks';
import { getAuthorName, getBookTitle } from '@/src/shared/lib/dataHelpers';
import { formatRelativeDate } from '@/src/shared/lib/dateUtils';
import { useRealtimeBooks } from '@/src/shared/lib/hooks/useRealtimeEntity';
import { registerModalScrollHandler, registerModalScrollRef, unregisterModalScrollHandler } from '@/src/shared/lib/modalScrollSync';
import { ThemeColors } from '@/src/shared/theme';
import { BlockContext, BlockDispatcher } from '@/src/shared/ui/blocks/BlockDispatcher';
import AIChatModal from './AIChatModal';

const STANDARD_THEMES = [
  "Philosophie & Sagesse",
  "Amour & Relations",
  "Condition Humaine",
  "Temps & Mort",
  "Art & Littérature",
  "Politique & Société",
  "Liberté & Justice",
  "Bonheur & Existence",
  "Nature & Sciences",
  "Savoir & Vérité",
  "Destin & Choix",
];

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

const RecBookSkeleton = ({ colors, styles }: { colors: ThemeColors; styles: any }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.recBookCard}>
      <Animated.View
        style={[
          styles.recBookCover,
          { backgroundColor: colors.surfaceHighlight },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: 85,
            height: 12,
            borderRadius: 4,
            backgroundColor: colors.surfaceHighlight,
            marginBottom: 6,
          },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: 60,
            height: 9,
            borderRadius: 4,
            backgroundColor: colors.surfaceHighlight,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

// Composant interne : a accès au CopilotProvider local
function QuoteDetailContent() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const { currentStepIndex, nextStep } = useAppTourState();


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

  React.useEffect(() => {
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
  }, [glow1X, glow1Y, glow1Scale, glow2X, glow2Y, glow2Scale, glow3X, glow3Y, glow3Scale, glow4X, glow4Y, glow4Scale]);
  const { navigateToBook, navigateToAuthor } = useSmartNavigation();
  const { quote: quoteParam, quoteId } = useLocalSearchParams<{ quote?: string; quoteId?: string }>();
  
  // Remplacement de useData() par les hooks spécifiques
  const { quotes, updateQuote: updateQuoteMutation, toggleLikeQuote, deleteQuote: deleteQuoteMutation } = useQuote();
  const { books, refreshBooks } = useAuthor();
  
  // Méthodes pour BlockService
  const getBlockLayout = useCallback((parentId: string | number, parentType: "quote" | "book") => {
    return BlockService.getLayout(parentId, parentType);
  }, []);
  
  const updateBlockLayout = useCallback((parentId: string | number, parentType: "quote" | "book", layout: string[]) => {
    return BlockService.saveLayout(parentId, parentType, layout);
  }, []);
  
  // Wrapper pour updateQuote
  const updateQuote = useCallback(async (id: number, updates: Partial<Quote>) => {
    await updateQuoteMutation(id, updates);
  }, [updateQuoteMutation]);
  
  // Wrapper pour deleteQuote
  const deleteQuote = useCallback(async (id: number) => {
    await deleteQuoteMutation(id);
  }, [deleteQuoteMutation]);

  // 1. Prioritize lookup by ID from global store
  // 2. Fallback to parsing the stringified quote param
  const initialQuote = useMemo(() => {
    if (quoteId) {
      const found = quotes.find(q => q.id === parseInt(quoteId));
      if (found) return found;
    }
    if (quoteParam) {
      try {
        return JSON.parse(quoteParam) as Quote;
      } catch (e) {
        console.error('Failed to parse quote param', e);
      }
    }
    return undefined;
  }, [quoteId, quoteParam, quotes]);

  const [quote, setQuote] = React.useState<Quote | undefined>(initialQuote);

  // Autosave notes/blockData
  const lastSavedBlockData = React.useRef<string>(
    initialQuote?.blockData ? JSON.stringify(initialQuote.blockData) : '{}'
  );

  // State for rich data
  const [fetchedBook, setFetchedBook] = React.useState<Book | null>(null);
  const [fetchedAuthor, setFetchedAuthor] = React.useState<Author | null>(null);
  const [gridData, setGridData] = React.useState<string[]>([]);
  const [, setIsLoadingLayout] = React.useState(true);
  const [isAIChatVisible, setAIChatVisible] = React.useState(false);
  const [isThemeSelectorVisible, setThemeSelectorVisible] = React.useState(false);
  const [themeToModify, setThemeToModify] = React.useState<string | null>(null);
  const [customThemeText, setCustomThemeText] = React.useState('');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const removeTheme = async (themeToRemove: string) => {
    if (!quote) return;
    const currentTheme = quote.theme;
    const currentAdditional = quote.blockData?.additionalThemes || [];

    if (currentTheme === themeToRemove) {
      if (currentAdditional.length > 0) {
        const newTheme = currentAdditional[0];
        const newAdditional = currentAdditional.slice(1);
        const newBlockData = { ...(quote.blockData || {}), additionalThemes: newAdditional };
        const updatedQuote = { ...quote, theme: newTheme, blockData: newBlockData };
        setQuote(updatedQuote);
        if (quote.id) {
          await quoteService.updateQuote(quote.id, { theme: newTheme, blockData: newBlockData });
          if (updateQuote) updateQuote(quote.id, { theme: newTheme, blockData: newBlockData });
        }
      } else {
        const updatedQuote = { ...quote, theme: undefined };
        setQuote(updatedQuote);
        if (quote.id) {
          await quoteService.updateQuote(quote.id, { theme: undefined });
          if (updateQuote) updateQuote(quote.id, { theme: undefined });
        }
      }
    } else {
      const newAdditional = currentAdditional.filter((t: string) => t !== themeToRemove);
      const newBlockData = { ...(quote.blockData || {}), additionalThemes: newAdditional };
      const updatedQuote = { ...quote, blockData: newBlockData };
      setQuote(updatedQuote);
      if (quote.id) {
        await quoteService.updateQuote(quote.id, { blockData: newBlockData });
        if (updateQuote) updateQuote(quote.id, { blockData: newBlockData });
      }
    }
  };

  const addTheme = async (themeToAdd: string) => {
    if (!quote) return;
    const currentTheme = quote.theme;
    const currentAdditional = quote.blockData?.additionalThemes || [];

    if (!currentTheme || currentTheme === 'Thème non renseigné') {
      const updatedQuote = { ...quote, theme: themeToAdd };
      setQuote(updatedQuote);
      if (quote.id) {
        await quoteService.updateQuote(quote.id, { theme: themeToAdd });
        if (updateQuote) updateQuote(quote.id, { theme: themeToAdd });
      }
    } else {
      if (currentTheme === themeToAdd || currentAdditional.includes(themeToAdd)) return;
      const newAdditional = [...currentAdditional, themeToAdd];
      const newBlockData = { ...(quote.blockData || {}), additionalThemes: newAdditional };
      const updatedQuote = { ...quote, blockData: newBlockData };
      setQuote(updatedQuote);
      if (quote.id) {
        await quoteService.updateQuote(quote.id, { blockData: newBlockData });
        if (updateQuote) updateQuote(quote.id, { blockData: newBlockData });
      }
    }
  };

  const replaceTheme = async (oldTheme: string, newTheme: string) => {
    if (!quote) return;

    let newPrimaryTheme = quote.theme;
    let newAdditionalThemes = [...(quote.blockData?.additionalThemes || [])];

    if (newPrimaryTheme === oldTheme) {
      newPrimaryTheme = newTheme;
    } else {
      const index = newAdditionalThemes.indexOf(oldTheme);
      if (index > -1) {
        newAdditionalThemes[index] = newTheme;
      } else {
        newAdditionalThemes.push(newTheme);
      }
    }

    const allUnique = Array.from(new Set([newPrimaryTheme, ...newAdditionalThemes].filter(Boolean) as string[]));
    newPrimaryTheme = allUnique[0] || undefined;
    newAdditionalThemes = allUnique.slice(1);

    const newBlockData = { ...(quote.blockData || {}), additionalThemes: newAdditionalThemes };
    const updatedQuote = { ...quote, theme: newPrimaryTheme, blockData: newBlockData };

    setQuote(updatedQuote);
    if (quote.id) {
      await quoteService.updateQuote(quote.id, { theme: newPrimaryTheme, blockData: newBlockData });
      if (updateQuote) updateQuote(quote.id, { theme: newPrimaryTheme, blockData: newBlockData });
    }
  };

  const handleThemeLongPress = (themeStr: string) => {
    if (themeStr === 'Thème non renseigné') return;
    Alert.alert(
      "Options de l'étiquette",
      `Que souhaitez-vous faire avec le thème "${themeStr}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Remplacer",
          onPress: () => {
            setThemeToModify(themeStr);
            setThemeSelectorVisible(true);
          }
        },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await removeTheme(themeStr);
          }
        }
      ]
    );
  };

  const handleTriggerAnalysis = async () => {
    if (!quote?.id) return;
    setIsAnalyzing(true);
    try {
      const updatedQuote = await quoteService.analyzeQuote(quote.id);
      setQuote(updatedQuote);
      if (updateQuote) {
        updateQuote(quote.id, {
          aiInterpretation: updatedQuote.aiInterpretation,
          theme: updatedQuote.theme,
          blockData: updatedQuote.blockData
        });
      }
      if (refreshBooks) {
        refreshBooks();
      }
    } catch (error) {
      console.error('[AI Analysis]', error);
      // Fallback: set a default analysis
      const authorName = getAuthorName(quote?.author);
      const fallbackAnalysis = {
        aiInterpretation: `Cette citation de ${authorName} invite à la réflexion littéraire.`,
        theme: "Art & Littérature",
        blockData: { recommendedBooks: [] }
      };
      setQuote({ ...quote, ...fallbackAnalysis });
      if (updateQuote) {
        updateQuote(quote.id, fallbackAnalysis);
      }
      Alert.alert(
        "Analyse indisponible",
        "Une analyse par défaut a été appliquée. Veuillez réessayer plus tard pour une analyse IA complète."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };


  React.useEffect(() => {
    if (quoteId) {
      const globalQuote = quotes.find(q => q.id === parseInt(quoteId));
      if (globalQuote) {
        lastSavedBlockData.current = globalQuote.blockData ? JSON.stringify(globalQuote.blockData) : '{}';
        setQuote(globalQuote);
      }
    }
  }, [quoteId, quotes]);

  React.useEffect(() => {
    if (quoteId) {
      const qId = parseInt(quoteId);
      quoteService.getQuoteById(qId).then((freshQuote) => {
        if (freshQuote) {
          lastSavedBlockData.current = freshQuote.blockData ? JSON.stringify(freshQuote.blockData) : '{}';
          setQuote(freshQuote);
        }
      }).catch(err => console.log('Failed to refresh quote details on mount:', err));
    }
  }, [quoteId]);

  React.useEffect(() => {
    const loadData = async () => {
      if (quote) {
        // If user is missing, try to fetch the full quote details freshly
        if (!quote.user && quote.id) {
          try {
            const freshQuote = await quoteService.getQuoteById(quote.id);
            if (freshQuote && freshQuote.user) {
              lastSavedBlockData.current = freshQuote.blockData ? JSON.stringify(freshQuote.blockData) : '{}';
              setQuote(freshQuote);
              return; // Return to avoid double fetching book/author immediately, let the effect re-run
            }
          } catch (e) {
            console.log('Failed to refresh quote details', e);
          }
        }

        const bookTitle = getBookTitle(quote.book);
        const authorName = getAuthorName(quote.author);

        // Fetch rich data using services
        const book = await authorService.getBookByTitle(bookTitle);
        setFetchedBook(book || null);

        const author = await authorService.getAuthorByName(authorName);
        setFetchedAuthor(author || null);
      }
    };
    loadData();
  }, [quote?.id, quote?.user, quote?.book, quote?.author]); // eslint-disable-line react-hooks/exhaustive-deps

  const quoteAuthorName = quote ? getAuthorName(quote.author) : '';
  const quoteBookTitle = quote ? getBookTitle(quote.book) : '';
  const isBookNull = !quote || !quote.book || getBookTitle(quote.book) === 'Livre inconnu';
  const isAuthorNull = !quote || !quote.author || getAuthorName(quote.author) === 'Auteur inconnu';

  // Data helpers based on fetched state
  const aiInterpretation = quote?.aiInterpretation;
  const recommendedBooks = React.useMemo(() => {
    const recs = (quote?.blockData?.recommendedBooks as any[]) || [];
    const booksMap = new Map(books.map((db: any) => [Number(db.id), db]));
    const mapped = recs.map((b: any) => {
      if (b.id) {
        const dbBook = booksMap.get(Number(b.id));
        if (dbBook) {
          return {
            ...b,
            title: dbBook.title || b.title,
            cover: dbBook.cover || b.cover,
            isEnriching: dbBook.isEnriching ?? false,
          };
        } else {
          return {
            ...b,
            isEnriching: !b.cover,
          };
        }
      }
      return b;
    });
    console.log('[QuoteDetailModal] Mapped recommended books:', JSON.stringify(mapped, null, 2));
    return mapped;
  }, [quote?.blockData?.recommendedBooks, books]);
  const quoteTheme = quote?.theme;
  const additionalThemes = quote?.blockData?.additionalThemes || [];
  const allThemes = Array.from(new Set([quoteTheme, ...additionalThemes].filter(Boolean) as string[]));
  if (allThemes.length === 0) {
    allThemes.push('Thème non renseigné');
  }

  // Tab Logic
  type TabType = 'description' | 'my_sheet';
  const [activeTab, setActiveTab] = React.useState<TabType>('description');

  const DESCRIPTION_BLOCKS = ['bookInfo', 'author', 'similarBooks', 'similarAuthors'];
  const MYSHEET_BLOCKS = ['connection', 'definition', 'notes'];

  const blockOptions = QUOTE_DETAIL_BLOCK_OPTIONS.map(key => ({
    key,
    label: BLOCK_CONFIGS[key].label
  }));

  const isBlockInTab = (blockKey: string, tab: TabType) => {
    if (blockKey === "addBlock") return true;
    const base = blockKey.split('#')[0];
    if (tab === 'description') return DESCRIPTION_BLOCKS.includes(base);
    if (tab === 'my_sheet') return MYSHEET_BLOCKS.includes(base);
    return false;
  };

  const currentTabBlocks = (gridData || []).filter(key => isBlockInTab(key, activeTab));

  const filteredBlockOptions = activeTab === 'description'
    ? blockOptions.filter(opt => DESCRIPTION_BLOCKS.includes(opt.key))
    : blockOptions.filter(opt => MYSHEET_BLOCKS.includes(opt.key));

  React.useEffect(() => {
    if (quote?.id) {
      getBlockLayout(quote.id, "quote").then(layout => {
        setGridData(layout);
        setIsLoadingLayout(false);
      });
    }
  }, [quote?.id, getBlockLayout]);

  // Autosave notes/blockData effect

  React.useEffect(() => {
    if (!quote?.id || !quote.blockData) return;

    const currentDataStr = JSON.stringify(quote.blockData);
    if (currentDataStr === lastSavedBlockData.current) return;

    const timer = setTimeout(() => {
      updateQuote(quote.id, { blockData: quote.blockData });
      lastSavedBlockData.current = currentDataStr;
    }, 1000);
    return () => clearTimeout(timer);
  }, [quote?.blockData, quote?.id, updateQuote]);

  const handleRealtimeBooksUpdate = React.useCallback(() => {
    if (quote?.id) {
      quoteService.getQuoteById(quote.id).then((freshQuote) => {
        if (freshQuote) {
          lastSavedBlockData.current = freshQuote.blockData ? JSON.stringify(freshQuote.blockData) : '{}';
          setQuote(freshQuote);
        }
      }).catch(err => console.log('Failed to refresh quote on realtime update:', err));
    }
    if (refreshBooks) {
      refreshBooks();
    }
  }, [quote?.id, refreshBooks]);

  // Utiliser Realtime pour les livres recommandés au lieu du polling
  useRealtimeBooks(recommendedBooks, handleRealtimeBooksUpdate);

  const handleUpdateBlockData = useCallback((blockId: string, data: any) => {
    setQuote((current: Quote | undefined) => {
      if (!current) return current;
      // Safety check: ensure blockData is an object
      const safeBlockData = typeof current.blockData === 'object' && current.blockData !== null
        ? current.blockData
        : {};
      const newBlockData = { ...safeBlockData, [blockId]: data };
      return { ...current, blockData: newBlockData };
    });
  }, []);

  const onClose = () => {
    const activeStepName = TOUR_STEPS[currentStepIndex];
    if (activeStepName === 'quoteDetailClose') {
      nextStep();
    }
    router.back();
  };

  const [isResourceSearchModalVisible, setResourceSearchModalVisible] = React.useState(false);
  const [currentConnectionBlockId, setCurrentConnectionBlockId] = React.useState<string | null>(null);

  const handleResourceSelected = (resource: any) => {
    if (currentConnectionBlockId) {
      handleUpdateBlockData(currentConnectionBlockId, resource);
      setResourceSearchModalVisible(false);
      setCurrentConnectionBlockId(null);
    }
  };

  // Helper for Dispatcher Context
  const blockContext = useMemo((): BlockContext => ({
    quote,
    book: fetchedBook,
    author: fetchedAuthor,
    onUpdateBlockData: handleUpdateBlockData,
    onBookPress: (idOrTitle, uri) => navigateToBook(idOrTitle, uri),
    onAuthorPress: (name, uri) => navigateToAuthor(name, uri),
    onEditDefinitionSelection: (blockId) => {
      setCurrentDefinitionBlockId(blockId);
      setWordSelectionModalVisible(true);
    },
    onConnectionSearchPress: (blockId) => {
      setCurrentConnectionBlockId(blockId);
      setResourceSearchModalVisible(true);
    },
  }), [quote, fetchedBook, fetchedAuthor, handleUpdateBlockData, navigateToBook, navigateToAuthor]);

  const handleToggleLike = () => {
    if (!quote) return;
    setQuote((currentQuote: Quote | undefined) => {
      if (!currentQuote) return currentQuote;
      return { ...currentQuote, isLiked: !currentQuote.isLiked, likesCount: currentQuote.isLiked ? currentQuote.likesCount - 1 : currentQuote.likesCount + 1 };
    });
    toggleLikeQuote(quote.id);
  };

  const handleShare = async () => {
    if (!quote) return;
    try {
      const message = `"${quote.text}"\n- ${quoteAuthorName}\n(via Quotex)`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const onAuthorPress = (authorName: string, inventaireUri?: string) => navigateToAuthor(authorName, inventaireUri);
  const onBookPress = (bookTitle: string) => navigateToBook(fetchedBook?.id ?? bookTitle, fetchedBook?.inventaireUri);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
  const aiSectionRef = React.useRef<View>(null);

  // Enregistre le handler de scroll ET la ref Reanimated pour que le tooltip
  // puisse scroller via le UI thread (scrollTo Reanimated) avant goToNext
  React.useEffect(() => {
    registerModalScrollHandler((y, animated = true) => {
      scrollableRef.current?.scrollTo({ y, animated });
    });
    registerModalScrollRef(scrollableRef as any);
    return () => unregisterModalScrollHandler();
  }, [scrollableRef]);



  // State and helpers for "Ajouter un bloc"
  const [isAddBlockModalVisible, setAddBlockModalVisible] = React.useState(false);
  const [isWordSelectionModalVisible, setWordSelectionModalVisible] = React.useState(false);
  const [currentDefinitionBlockId, setCurrentDefinitionBlockId] = React.useState<string | null>(null);
  const [showEditModal, setShowEditModal] = React.useState(false);

  const handleWordsSelected = async (words: string[]) => {
    if (!currentDefinitionBlockId) return;

    const newDefinitions = [];
    for (const word of words) {
      const defs = await fetchDefinition(word);
      if (defs.length > 0) {
        newDefinitions.push(...defs);
      } else {
        newDefinitions.push({
          term: word,
          genre: 'Non trouvé',
          definition: "Aucune définition trouvée pour ce mot.",
          example: ''
        });
      }
    }

    handleUpdateBlockData(currentDefinitionBlockId, newDefinitions);
    setWordSelectionModalVisible(false);
    setCurrentDefinitionBlockId(null);
  };

  const openAddBlockModal = () => setAddBlockModalVisible(true);
  const closeAddBlockModal = () => setAddBlockModalVisible(false);

  const handleAddBlock = (blockKey: string) => {
    const newLayout = [...gridData.filter(x => x !== "addBlock"), `${blockKey}#${Date.now()}`, "addBlock"];
    setGridData(newLayout);
    if (quote?.id) updateBlockLayout(quote.id, "quote", newLayout);
    closeAddBlockModal();
  };

  const handleDeleteQuote = () => {
    if (!quote) return;
    Alert.alert(
      "Supprimer la citation",
      "Êtes-vous sûr de vouloir supprimer cette citation ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            await deleteQuote(quote.id);
            onClose();
          }
        }
      ]
    );
  };

  const handleRemoveBlock = useCallback((itemToRemove: string) => {
    if (itemToRemove === "addBlock") return;

    // 1. Update Layout
    const newLayout = gridData.filter(x => x !== itemToRemove);
    setGridData(newLayout);
    if (quote?.id) updateBlockLayout(quote.id, "quote", newLayout);

    // 2. Cleanup blockData
    setQuote((current: Quote | undefined) => {
      if (!current) return current;
      const newBlockData = { ...(current.blockData || {}) };
      delete newBlockData[itemToRemove];

      const updates: Partial<Quote> = { blockData: newBlockData };
      return { ...current, ...updates };
    });
  }, [gridData, quote?.id, updateBlockLayout]);

  const renderGridItem = useCallback<SortableGridRenderItem<string>>(({ item }) => {
    if (item === "addBlock") {
      return (
        <TouchableOpacity style={styles.placeholderSection} onPress={openAddBlockModal}>
          <Plus size={20} color={colors.textTertiary} style={styles.placeholderIcon} />
          <Text style={styles.placeholderText}>Ajouter un bloc</Text>
        </TouchableOpacity>
      );
    }

    return (
      <BlockDispatcher
        blockId={item}
        context={blockContext}
        onRemove={() => handleRemoveBlock(item)}
      />
    );
  }, [blockContext, handleRemoveBlock, colors, styles]);

  if (!quote) return null;

  return (
      <View style={styles.container}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.modalView}>
        <View style={styles.handleBar} />

        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Détails de la citation</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity style={styles.closeButton} onPress={handleDeleteQuote}>
                <Trash2 size={20} color={colors.warning} />
              </TouchableOpacity>
              <InteractiveTooltip
                text="Appuyez sur cette croix pour fermer la fiche et revenir à votre liste de citations."
                stepName="quoteDetailClose"
                placement="bottom"
                allowChildInteraction={true}
              >
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </InteractiveTooltip>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowEditModal(true)}>
                <Edit3 size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quote Section */}

          <View style={styles.section}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"
                fill={colors.primary}
                opacity={0.2}
              />
            </Svg>
            <Text style={styles.quoteText}>{quote.text}</Text>

            <View style={styles.quoteMetaFooter}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.metaRow}
                  onPress={() => onBookPress(quoteBookTitle)}
                  disabled={isBookNull}
                >
                  <BookOpen size={16} color={colors.textTertiary} />
                  <Text style={[styles.metaTextBook, isBookNull && { color: colors.textSecondary }]}>
                    {quoteBookTitle}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.metaRow}
                  onPress={() => onAuthorPress(quoteAuthorName)}
                  disabled={isAuthorNull}
                >
                  <UserIcon size={16} color={colors.textTertiary} />
                  <Text style={styles.metaTextAuthor}>{quoteAuthorName}</Text>
                </TouchableOpacity>

                {quote.user && (
                  <TouchableOpacity style={styles.metaRow} onPress={() => router.navigate(`/user-profile?username=${quote.user?.username}`)}>
                    <Image
                      source={{ uri: quote.user.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
                      style={styles.publisherAvatar}
                    />
                    <Text style={styles.metaTextPublisher}>Publié par <Text style={styles.publisherUsername}>@{quote.user.username}</Text></Text>
                  </TouchableOpacity>
                )}

                {quote.date && (
                  <View style={styles.metaRow}>
                    <Calendar size={16} color={colors.textTertiary} />
                    <Text style={styles.metaTextDate}>{formatRelativeDate(quote.date)}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                {allThemes.map((themeStr, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.themeBadgeIA}
                    activeOpacity={0.7}
                    onPress={() => router.navigate({ pathname: '/theme-detail', params: { themeName: themeStr } })}
                    onLongPress={() => handleThemeLongPress(themeStr)}
                  >
                    <Text style={styles.themeBadgeValue}>{themeStr}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addThemeButton}
                  onPress={() => {
                    setThemeToModify(null);
                    setThemeSelectorVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleToggleLike}
            >
              <Heart
                size={20}
                color={quote.isLiked ? colors.primary : colors.textTertiary}
                fill={quote.isLiked ? colors.primary : 'none'}
              />
              <Text
                style={[
                  styles.actionText,
                  quote.isLiked && styles.actionTextActive,
                ]}
              >
                {quote.likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Share2 size={20} color={colors.textTertiary} />
              <Text style={styles.actionText}>Partager</Text>
            </TouchableOpacity>
          </View>

          {/* AI Interpretation */}
          <View ref={aiSectionRef}>
          <InteractiveTooltip
            text="L'IA met en contexte la citation et propose des œuvres en rapport avec son thème."
            stepName="quoteDetailIA"
            placement="top"
          >
            <View style={[styles.aiSectionWrapper, { width: '100%' }]}>
              {!isAnalyzing && (
                <View style={styles.glowContainer}>
                  {/* Top edge glow */}
                  <GlowCircle color1="#8B5CF6" x={glow1X} y={glow1Y} scale={glow1Scale} size={200} opacity={isDark ? 0.38 : 0.22} style={{ top: -65, left: '25%' }} />
                  {/* Bottom edge glow */}
                  <GlowCircle color1="#EC4899" x={glow2X} y={glow2Y} scale={glow2Scale} size={190} opacity={isDark ? 0.38 : 0.22} style={{ bottom: -65, left: '25%' }} />
                  {/* Left edge glow */}
                  <GlowCircle color1="#06B6D4" x={glow3X} y={glow3Y} scale={glow3Scale} size={180} opacity={isDark ? 0.45 : 0.25} style={{ top: '20%', left: -60 }} />
                  {/* Right edge glow */}
                  <GlowCircle color1="#3B82F6" x={glow4X} y={glow4Y} scale={glow4Scale} size={180} opacity={isDark ? 0.45 : 0.25} style={{ top: '20%', right: -60 }} />
                </View>
              )}

              <View
                style={styles.aiSection}
              >
                {isAnalyzing ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
                    <ActivityIndicator color={colors.primary} size="small" style={{ marginBottom: 10 }} />
                    <Text style={[styles.aiText, { fontStyle: 'italic', color: colors.textSecondary }]}>
                      Analyse littéraire par {"l'IA"} en cours...
                    </Text>
                  </View>
                ) : aiInterpretation ? (
                  <>
                    <View style={styles.aiHeader}>
                      <Sparkles size={16} color={colors.primary} />
                      <Text style={styles.aiTitle}>Interprétation IA</Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleTriggerAnalysis();
                        }}
                        style={{ marginLeft: 'auto', padding: 4 }}
                      >
                        <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Régénérer</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.aiText}>{aiInterpretation}</Text>

                    {recommendedBooks && recommendedBooks.length > 0 && (
                      <View style={styles.recContainer} onStartShouldSetResponder={() => true}>
                        <Text style={styles.recHeaderTitle}>Lectures recommandées par {"l'IA"}</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.recScrollContent}
                          style={styles.recScrollView}
                          keyboardShouldPersistTaps="handled"
                        >
                          {recommendedBooks.map((bookItem: any, idx: number) => {
                            if (bookItem.isEnriching && !bookItem.cover) {
                              return <RecBookSkeleton key={idx} colors={colors} styles={styles} />;
                            }
                            const hasCover = !!bookItem.cover;
                            return (
                              <TouchableOpacity
                                key={idx}
                                style={styles.recBookCard}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  if (bookItem.id) {
                                    router.push({
                                      pathname: '/book-detail',
                                      params: { bookId: bookItem.id.toString(), bookTitle: bookItem.title }
                                    });
                                  } else {
                                    router.push({
                                      pathname: '/search',
                                      params: { q: `${bookItem.title} ${bookItem.author}` }
                                    });
                                  }
                                }}
                              >
                                {hasCover ? (
                                  <Image source={{ uri: bookItem.cover }} style={styles.recBookCover} />
                                ) : (
                                  <View style={styles.recBookCoverFallback}>
                                    <BookOpen size={24} color={colors.primary} />
                                    <Text numberOfLines={3} style={styles.fallbackCoverTitle}>
                                      {bookItem.title}
                                    </Text>
                                  </View>
                                )}
                                <Text numberOfLines={2} style={styles.recBookTitle}>
                                  {bookItem.title}
                                </Text>
                                <Text numberOfLines={1} style={styles.recBookAuthor}>
                                  {bookItem.author}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}


                  </>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}>
                    <Sparkles size={28} color={colors.primary} style={{ marginBottom: 8, opacity: 0.8 }} />
                    <Text style={[styles.aiTitle, { marginBottom: 6, fontSize: 15 }]}>Analyse Littéraire par {"l'IA"}</Text>
                    <Text style={[styles.aiText, { textAlign: 'center', color: colors.textSecondary, marginBottom: 14, fontSize: 13, lineHeight: 18 }]}>
                      Laissez notre IA analyser la profondeur de cette citation et extraire ses thèmes clés.
                    </Text>
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.primary,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTriggerAnalysis();
                      }}
                    >
                      <Sparkles size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Analyser la citation</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </InteractiveTooltip>
          </View>{/* end aiSectionRef */}


          {/* TABS */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'description' && styles.activeTabButton]}
              onPress={() => setActiveTab('description')}
            >
              <Text style={[styles.tabText, activeTab === 'description' && styles.activeTabText]}>Description</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'my_sheet' && styles.activeTabButton]}
              onPress={() => setActiveTab('my_sheet')}
            >
              <Text style={[styles.tabText, activeTab === 'my_sheet' && styles.activeTabText]}>Ma fiche</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.gridSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {activeTab === 'description' ? 'Détails' : 'Mon espace personnel'}
              </Text>
            </View>

            {activeTab === 'description' ? (
              <View style={{ gap: 10 }}>
                {DESCRIPTION_BLOCKS.map(blockKey => (
                  <BlockDispatcher
                    key={blockKey}
                    blockId={blockKey}
                    context={blockContext}
                  />
                ))}
              </View>
            ) : (
              <>
                <Sortable.Grid
                  columns={1}
                  data={currentTabBlocks}
                  renderItem={renderGridItem}
                  rowGap={10}
                  columnGap={10}
                  scrollableRef={scrollableRef}
                  autoScrollEnabled={true}
                  autoScrollActivationOffset={75}
                  onOrderChange={(params) => {
                    const { fromIndex, toIndex } = params as { fromIndex: number; toIndex: number };
                    const newSubOrder = [...currentTabBlocks];
                    const [moved] = newSubOrder.splice(fromIndex, 1);
                    newSubOrder.splice(toIndex, 0, moved);

                    const newMasterList: string[] = [];
                    let subIndex = 0;
                    for (const item of gridData) {
                      if (isBlockInTab(item, activeTab)) {
                        if (subIndex < newSubOrder.length) {
                          newMasterList.push(newSubOrder[subIndex]);
                          subIndex++;
                        }
                      } else {
                        newMasterList.push(item);
                      }
                    }

                    setGridData(newMasterList);
                    if (quote?.id) updateBlockLayout(quote.id, "quote", newMasterList);
                  }}
                />
                <AddBlockModal visible={isAddBlockModalVisible} onClose={closeAddBlockModal} onSelect={handleAddBlock} options={filteredBlockOptions} />

                <WordSelectionModal
                  visible={isWordSelectionModalVisible}
                  onClose={() => setWordSelectionModalVisible(false)}
                  onConfirm={handleWordsSelected}
                  quoteText={quote.text}
                />

                <ResourceSearchModal
                  visible={isResourceSearchModalVisible}
                  onClose={() => setResourceSearchModalVisible(false)}
                  onSelect={handleResourceSelected}
                />
              </>
            )}
          </View>

        </Animated.ScrollView>

        <AIChatModal
          visible={isAIChatVisible}
          onClose={() => setAIChatVisible(false)}
          quote={quote}
          book={fetchedBook}
          author={fetchedAuthor}
          onUpdateQuote={(updated) => setQuote(updated)}
        />

        <ScanPreviewModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          onConfirm={async (text, book, author) => {
            console.log('[QuoteDetailModal] Edit modal onConfirm called');
            console.log('[QuoteDetailModal] text:', text);
            console.log('[QuoteDetailModal] book:', book);
            console.log('[QuoteDetailModal] author:', author);
            
            try {
              if (quote) {
                console.log('[QuoteDetailModal] Updating quote:', quote.id);
                await updateQuote(quote.id, { text, book: book || quote.book, author: author || quote.author });
                // Mettre à jour l'état local pour refléter les modifications immédiatement
                setQuote({ ...quote, text, book: book || quote.book, author: author || quote.author });
                console.log('[QuoteDetailModal] Quote updated successfully');
              }
            } catch (error) {
              console.error('[QuoteDetailModal] Error updating quote:', error);
            } finally {
              setShowEditModal(false);
            }
          }}
          scannedText={quote?.text || ""}
          initialBook={quoteBookTitle}
          initialAuthor={quoteAuthorName}
        />

        {/* Theme Selector Modal */}
        <Modal
          visible={isThemeSelectorVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setThemeSelectorVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setThemeSelectorVisible(false)}
          >
            <View style={styles.themeSelectorContainer}>
              <View style={styles.themeSelectorHeader}>
                <Text style={styles.themeSelectorTitle}>Changer le thème</Text>
                <TouchableOpacity onPress={() => setThemeSelectorVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.customThemeContainer}>
                <TextInput
                  style={styles.customThemeInput}
                  placeholder="Créer un thème personnalisé..."
                  placeholderTextColor={colors.textTertiary}
                  value={customThemeText}
                  onChangeText={setCustomThemeText}
                  onSubmitEditing={async () => {
                    const cleanTheme = customThemeText.trim();
                    if (cleanTheme.length > 0) {
                      setThemeSelectorVisible(false);
                      setCustomThemeText('');
                      if (themeToModify) {
                        if (themeToModify !== cleanTheme) {
                          await replaceTheme(themeToModify, cleanTheme);
                        }
                        setThemeToModify(null);
                      } else {
                        await addTheme(cleanTheme);
                      }
                    }
                  }}
                  returnKeyType="done"
                />
              </View>

              <ScrollView style={styles.themeSelectorList} showsVerticalScrollIndicator={false}>
                {STANDARD_THEMES.map((theme) => {
                  const isSelected = allThemes.includes(theme);
                  return (
                    <TouchableOpacity
                      key={theme}
                      style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
                      onPress={async () => {
                        setThemeSelectorVisible(false);
                        if (!quote) return;

                        if (themeToModify) {
                          if (themeToModify !== theme) {
                            await replaceTheme(themeToModify, theme);
                          }
                          setThemeToModify(null);
                          return;
                        }

                        if (isSelected) {
                          await removeTheme(theme);
                        } else {
                          await addTheme(theme);
                        }
                      }}
                    >
                      <Text style={[styles.themeOptionText, isSelected && styles.themeOptionTextSelected]}>{theme}</Text>
                      {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

      </View>
    </View>
  );
}

// QuoteDetailModal exported as the pure entity component.
export default function QuoteDetailModal() {
  return <QuoteDetailContent />;
}

const createStyles = (colors: ThemeColors, isDark?: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  modalView: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get('window').height * 0.9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHighlight,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  quoteMetaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHighlight,
    gap: 8
  },
  themeBadgeIA: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    maxWidth: '100%',
    marginLeft: 12,
  },
  themeBadgeValue: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  addThemeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  themeSelectorContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  themeSelectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  customThemeContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  customThemeInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  themeSelectorList: {
    padding: 8,
  },
  themeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  themeOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  themeOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  themeOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  quoteText: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
    marginVertical: 12,
    fontFamily: 'Times New Roman',
    fontStyle: 'italic',
    fontWeight: '100'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaTextBook: {
    color: colors.primary,
    fontSize: 13,
  },
  metaTextAuthor: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metaTextDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  publisherAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
  },
  metaTextPublisher: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  publisherUsername: {
    color: colors.text,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionTextActive: {
    color: colors.primary,
  },
  aiSectionWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'visible',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  aiSection: {
    backgroundColor: isDark ? 'rgba(28, 28, 40, 0.78)' : 'rgba(238, 243, 255, 0.82)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.18)',
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.25 : 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  recContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.12)',
    paddingTop: 12,
  },
  recHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recScrollView: {
    marginHorizontal: -16,
  },
  recScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recBookCard: {
    width: 120,
    alignItems: 'center',
    marginRight: 2,
  },
  recBookCover: {
    width: 110,
    height: 165,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  recBookCoverFallback: {
    width: 110,
    height: 165,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    marginBottom: 8,
    gap: 6,
  },
  fallbackCoverTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 13,
  },
  recBookTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 15,
  },
  recBookAuthor: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  placeholderSection: {
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  gridSection: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHighlight,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600',
  },
});
