# **🎨 Quotex Design System**

*Version 1.0.0 - Dernière mise à jour : 25/07/2026*

---

## **📋 Table des Matières**

1. [Philosophie](#-philosophie)
2. [Architecture FSD](#-architecture-fsd)
3. [Système de Tokens](#-système-de-tokens)
4. [Composants Atomiques](#-composants-atomiques)
5. [Composants Moléculaires](#-composants-moléculaires)
6. [Composants Organismiques](#-composants-organismiques)
7. [Bonnes Pratiques](#-bonnes-pratiques)
8. [Exemples d'Utilisation](#-exemples-dutilisation)
9. [Contribution](#-contribution)

---

---

## **🎯 Philosophie**

Notre design system suit les principes suivants :

- **🔄 Réutilisabilité** : Un composant = une source de vérité
- **🎨 Cohérence** : Une seule façon de faire les choses
- **📏 Flexibilité** : Adaptable via props et tokens
- **♿ Accessibilité** : Respect des standards WCAG
- **⚡ Performance** : Composants optimisés et memoized

---

---

## **🏗️ Architecture FSD**

```
src/
├── shared/
│   ├── ui/                    # Composants partagés
│   │   ├── atoms/            # Composants atomiques (Button, Input...)
│   │   ├── molecules/        # Composants moléculaires (SearchBar...)
│   │   ├── organisms/        # Composants organismiques (Cards...)
│   │   ├── skeletons/        # Composants de chargement
│   │   ├── index.ts          # Export centralisé
│   │   └── ...
│   ├── theme/                # Design tokens
│   │   ├── colors.ts
│   │   ├── tokens.ts
│   │   └── index.ts
│   └── ...
├── entities/                 # Domain layer
│   └── {entity}/
│       ├── ui/              # UI spécifique à l'entité
│       └── ...
└── features/                 # Feature layer
    └── {feature}/
        └── ui/              # UI spécifique à la feature
```

**Règle de co-location** : Tout ce qui est utilisé ensemble doit être co-localisé.

---

---

## **🪶 Système de Tokens**

### **Couleurs** (`src/shared/theme/colors.ts`)

#### Couleurs communes (tous thèmes)
```ts
{
  primary: '#20B8CD',        // Bleu turquoise
  primaryLight: 'rgba(32, 184, 205, 0.1)',
  accent: '#3B82F6',         // Bleu
  accentLight: 'rgba(59, 130, 246, 0.1)',
  success: '#10B981',        // Vert
  successLight: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',        // Orange
  warningLight: 'rgba(245, 158, 11, 0.1)',
  error: '#EF4444',          // Rouge
  errorLight: 'rgba(239, 68, 68, 0.1)',
  iconSecondary: '#9CA3AF',
}
```

#### Thème Sombre
```ts
{
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceHighlight: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  border: '#1F1F1F',
  inputBackground: '#1A1A1A',
  inputText: '#FFFFFF',
  backdrop: 'rgba(0, 0, 0, 0.45)',
}
```

#### Thème Clair
```ts
{
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceHighlight: '#F3F4F6',
  text: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  border: '#E5E7EB',
  inputBackground: '#F3F4F6',
  inputText: '#111827',
  backdrop: 'rgba(0, 0, 0, 0.45)',
}
```

### **Espacements** (`src/shared/theme/tokens.ts`)
```ts
{
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}
```

### **Bordures**
```ts
{
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}
```

### **Tailles** (`sizes`)
```ts
{
  xs: 32,
  sm: 40,
  md: 48,
  lg: 56,
  xl: 84,
  xxl: 110,
}
```

### **Tailles d'Icônes**
```ts
{
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
}
```

### **Typographie**
```ts
{
  fontFamily: {
    body: undefined,
    quote: 'Times New Roman' (iOS) / 'serif' (Android),
    mono: 'Courier' (iOS) / 'monospace' (Android),
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    heading: 32,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    heading: 40,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
  },
  letterSpacing: {
    xs: 0.5,
    sm: 1,
    md: 1.5,
  },
}
```

### **Ombres**
```ts
{
  sm: { shadowColor: '#000', shadowOffset: { w: 0, h: 1 }, shadowOpacity: 0.18, shadowRadius: 1, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { w: 0, h: 2 }, shadowOpacity: 0.23, shadowRadius: 2.62, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { w: 0, h: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
}
```

**Utilisation recommandée** :
```tsx
// ❌ À éviter
const styles = StyleSheet.create({
  container: {
    padding: 16,
    margin: 8,
    borderRadius: 12,
    fontSize: 16,
    color: '#20B8CD',
  },
});

// ✅ Recommandé
const createStyles = (colors: ThemeColors, tokens: Tokens) => StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
    margin: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    fontSize: tokens.typography.fontSize.md,
    color: colors.primary,
  },
});
```

---

---

## **⚛️ Composants Atomiques**

### **Typographie**

#### `AppText` - Texte standardisé
```tsx
import { AppText } from '@/src/shared/ui';

<AppText
  variant="body"        // xs | sm | md | lg | xl | xxl | heading
  weight="semibold"    // regular | medium | semibold | bold | extraBold
  color="primary"      // primary | secondary | tertiary | text | textSecondary | textTertiary
  customColor="#F59E0B"
  numberOfLines={2}
  style={{ marginBottom: 8 }}
>
  Hello World
</AppText>
```

**Variantes disponibles** :
- `caption` (12px)
- `bodySmall` (14px)
- `body` (16px)
- `h6` (18px)
- `h5` (20px)
- `h4` (24px)
- `h3` (28px)
- `h2` (32px)
- `h1` (36px)

### **Boutons**

#### `Button` - Bouton standard
```tsx
import { Button } from '@/src/shared/ui';

<Button
  title="Submit"
  variant="primary"     // primary | secondary | outline | ghost | danger | social
  size="md"            // sm | md | lg
  isLoading={false}
  disabled={false}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
  onPress={() => {}}
  style={{ marginTop: 16 }}
/>
```

**Variantes** :
| Variant | Description | Style |
|---------|-------------|-------|
| `primary` | Bouton principal | Fond: primary, Texte: buttonText |
| `secondary` | Bouton secondaire | Fond: surfaceHighlight, Texte: text |
| `outline` | Bouton outline | Fond: transparent, Bordure: border, Texte: text |
| `ghost` | Bouton fantôme | Fond: transparent, Texte: primary |
| `danger` | Bouton danger | Fond: warning, Texte: #FFFFFF |
| `social` | Bouton social | Fond: surfaceHighlight, Bordure: border, Texte: text |

#### `IconButton` - Bouton icône
```tsx
import { IconButton } from '@/src/shared/ui';

<IconButton
  icon={<Settings size={24} />}
  variant="ghost"     // ghost | outline | filled
  size="md"           // sm | md | lg
  onPress={() => {}}
  color={colors.primary}
/>
```

#### `CircleButton` - Bouton circulaire
```tsx
import { CircleButton } from '@/src/shared/ui';

<CircleButton
  icon={<ScanLine size={28} />}
  onPress={handleScan}
  size="md"           // sm (48px) | md (84px) | lg (110px)
  disabled={false}
  active={true}
  color={colors.primary}
  inactiveColor={colors.textTertiary}
  disabledColor={colors.border}
/>
```

#### `Link` - Lien texte
```tsx
import { Link } from '@/src/shared/ui';

<Link
  text="Forgot password?"
  onPress={handleForgotPassword}
  variant="primary"    // primary | secondary | tertiary
  size="md"           // sm | md | lg
  style={{ alignSelf: 'flex-end' }}
  testID="forgot-password"
/>
```

### **Inputs**

#### `Input` - Champ de texte
```tsx
import { Input } from '@/src/shared/ui';

<Input
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
  leftIcon={<Mail size={20} />}
  rightIcon={<X size={20} />}
  secureTextEntry={false}
  keyboardType="email-address"
  returnKeyType="next"
  onSubmitEditing={handleSubmit}
  error="Invalid email"
  label="Email Address"
  containerStyle={{ marginBottom: 16 }}
  inputContainerStyle={{ borderColor: colors.error }}
  inputStyle={{ color: colors.text }}
/>
```

### **Feedback**

#### `Badge` - Badge/Tag
```tsx
import { Badge } from '@/src/shared/ui';

<Badge
  label="New"
  variant="primary"   // primary | secondary | accent | outline | success | warning
  size="sm"          // sm | md
  icon={<Star size={12} />}
  onPress={() => {}}
  style={{ marginLeft: 8 }}
  textStyle={{ fontWeight: 'bold' }}
/>
```

#### `DebugBadge` - Badge de développement (DEV only)
```tsx
import { DebugBadge } from '@/src/shared/ui';

{__DEV__ && <DebugBadge label="DB" color="error" />}
// Colors: error | info | warning | success
```

#### `Divider` - Séparateur
```tsx
import { Divider } from '@/src/shared/ui';

<Divider
  orientation="horizontal"  // horizontal | vertical
  thickness={1}
  color={colors.border}
  spacing="md"             // none | sm | md | lg
  text="or"                 // Texte optionnel au centre
  textStyle={{ color: colors.textSecondary }}
/>
```

#### `LoadingOverlay` - Overlay de chargement
```tsx
import { LoadingOverlay } from '@/src/shared/ui';

<LoadingOverlay
  visible={isLoading}
  color={colors.primary}
  size="large"          // small | large
/>
```

### **Conteneurs**

#### `Card` - Carte
```tsx
import { Card } from '@/src/shared/ui';

<Card
  variant="flat"       // flat | elevated | outlined
  padding="md"         // none | sm | md | lg
  onPress={() => {}}
  style={{ borderRadius: 16 }}
>
  {/* Contenu */}
</Card>
```

#### `Modal` - Modale
```tsx
import { Modal } from '@/src/shared/ui';

<Modal
  visible={isVisible}
  onClose={() => setVisible(false)}
  title="Confirmation"
  avoidKeyboard={true}
>
  {/* Contenu */}
</Modal>
```

### **Images & Médias**

#### `BookCover` - Couverture de livre
```tsx
import { BookCover } from '@/src/shared/ui';

<BookCover
  uri={book.cover}
  title={book.title}
  width={60}
  height={90}
  fallbackIcon="book"     // book | bookOpen | library
  fallbackIconColor={colors.primary}
  borderRadius={4}
  showTitleFallback={true}
  style={{ marginRight: 16 }}
/>
```

#### `Avatar` - Avatar utilisateur
```tsx
import { Avatar } from '@/src/shared/ui';

<Avatar
  uri={user.image}
  name={user.name}        // Utilisé pour les initiales si pas d'uri
  size={40}             // Diamètre
  style={{ marginRight: 12 }}
/>
```

### **Autres**

#### `QuotexLogo` - Logo de l'application
```tsx
import QuotexLogo from '@/src/shared/ui/QuotexLogo';

<QuotexLogo
  width={200}
  height={80}
  color={colors.primary}
  style={{ marginBottom: 24 }}
/>
```

#### `ScreenFallback` - Écran de fallback
```tsx
import { ScreenFallback } from '@/src/shared/ui';

<ScreenFallback
  icon={<BookOpen size={48} />}
  title="No books found"
  subtitle="Try searching for something else"
/>
```

---

---

## **🧩 Composants Moléculaires**

### **Formulaire**

#### `FormWrapper` - Wrapper de formulaire
```tsx
import { FormWrapper } from '@/src/shared/ui';

<FormWrapper onSubmit={handleSubmit}>
  <Input name="email" label="Email" required />
  <Input name="password" label="Password" secureTextEntry />
  <Button title="Login" type="submit" />
</FormWrapper>
```

### **Navigation**

#### `TabBar` - Barre d'onglets
```tsx
import { TabBar } from '@/src/shared/ui';

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'books', label: 'Books' },
  { id: 'authors', label: 'Authors' },
];

<TabBar
  tabs={tabs}
  activeTab={activeTab}
  onTabPress={(id) => setActiveTab(id)}
/>
```

### **Indicateurs**

#### `CounterTab` - Onglet avec compteur
```tsx
import { CounterTab } from '@/src/shared/ui';

<CounterTab
  label="Quotes"
  count={quotesCount}
  active={activeTab === 'quotes'}
  onPress={() => setActiveTab('quotes')}
/>
```

#### `PageIndicator` - Indicateur de pages
```tsx
import { PageIndicator } from '@/src/shared/ui';

<PageIndicator
  count={3}
  activeIndex={activeIndex}
/>
```

---

---

## **🧬 Composants Organismiques**

### **Blocs** (`src/shared/ui/blocks/`)

Les blocs sont des composants complexes utilisés pour construire les écrans d'entités :

- `AuthorBlock` - Bloc auteur
- `BookInfoBlock` - Bloc d'informations livre
- `DefinitionBlock` - Bloc de définition
- `EditionsBlock` - Bloc d'éditions
- `LibraryBlock` - Bloc bibliothèque
- `NotesBlock` - Bloc de notes
- `SavedQuotesBlock` - Bloc de citations sauvegardées
- `SimilarBlock` - Bloc similaire
- `ConnectionBlock` - Bloc de connexion
- `BuyLinkBlock` - Bloc de liens d'achat
- `AboutBlock` - Bloc à propos

### **Squelettes** (`src/shared/ui/skeletons/`)

Composants de chargement standardisés :

```tsx
import { BookSkeleton, QuoteSkeleton, UserProfileSkeleton } from '@/src/shared/ui/skeletons';

// Dans un écran de chargement
{isLoading && <UserProfileSkeleton />}

// Skeleton de livre
<BookSkeleton style={{ marginRight: 12 }} />

// Skeleton de citation
<QuoteSkeleton width="100%" height={120} />
```

---

---

## **📜 Bonnes Pratiques**

### **✅ DO (À faire)**

1. **Toujours vérifier `shared/ui/` avant de créer un nouveau composant**
   ```tsx
   // ❌ Ne pas faire
   <Text style={{ fontSize: 16, color: '#333' }}>Hello</Text>
   
   // ✅ Faire
   <AppText variant="body">Hello</AppText>
   ```

2. **Utiliser les tokens pour toutes les valeurs de style**
   ```tsx
   // ❌ Ne pas faire
   const styles = StyleSheet.create({
     container: {
       padding: 16,
       margin: 8,
       borderRadius: 12,
     },
   });
   
   // ✅ Faire
   const createStyles = (colors: ThemeColors, tokens: Tokens) => StyleSheet.create({
     container: {
       padding: tokens.spacing.md,
       margin: tokens.spacing.sm,
       borderRadius: tokens.radii.md,
     },
   });
   ```

3. **Créer des variants plutôt que de dupliquer des styles**
   ```tsx
   // ❌ Ne pas faire - création d'un bouton social custom
   <TouchableOpacity style={{ ...styles.button, backgroundColor: '#F3F4F6', borderWidth: 1 }}>
     <Text>Google</Text>
   </TouchableOpacity>
   
   // ✅ Faire - utiliser le variant social
   <Button title="Google" variant="social" />
   ```

4. **Utiliser AppText au lieu de Text natif**
   ```tsx
   // ❌ Ne pas faire
   import { Text } from 'react-native';
   <Text style={{ fontSize: 16, fontWeight: '600' }}>Title</Text>
   
   // ✅ Faire
   import { AppText } from '@/src/shared/ui';
   <AppText variant="body" weight="semibold">Title</AppText>
   ```

5. **Thématiser les couleurs d'icônes**
   ```tsx
   // ❌ Ne pas faire
   <Settings size={24} color="#E5E7EB" />
   
   // ✅ Faire
   <Settings size={24} color={colors.textSecondary} />
   ```

6. **Respecter la co-location FSD**
   ```
   // Structure correcte
   src/shared/ui/Button.tsx          # Composant réutilisable
   src/features/auth/ui/LoginForm.tsx  # Composant spécifique feature
   src/entities/book/ui/BookCard.tsx   # Composant spécifique entité
   ```

### **❌ DON'T (À éviter)**

1. **Ne pas créer de composants UI dans features/**
   ```
   // ❌ Mauvaise structure
   src/features/user-settings/ui/components/DeleteAccountButton.tsx
   
   // ✅ Bonne structure
   src/shared/ui/DeleteAccountButton.tsx
   ```

2. **Ne pas hardcoder les couleurs**
   ```tsx
   // ❌ Ne pas faire
   <View style={{ backgroundColor: '#FFFFFF' }} />
   
   // ✅ Faire
   <View style={{ backgroundColor: colors.surface }} />
   ```

3. **Ne pas hardcoder les tailles**
   ```tsx
   // ❌ Ne pas faire
   <View style={{ padding: 16, margin: 8 }} />
   
   // ✅ Faire
   <View style={{ padding: tokens.spacing.md, margin: tokens.spacing.sm }} />
   ```

4. **Ne pas réinventer des composants existants**
   ```tsx
   // ❌ Ne pas faire - création d'un overlay custom
   {isLoading && (
     <View style={StyleSheet.absoluteFill}>
       <ActivityIndicator />
     </View>
   )}
   
   // ✅ Faire - utiliser le composant partagé
   <LoadingOverlay visible={isLoading} />
   ```

---

---

## **💡 Exemples d'Utilisation**

### **Exemple 1 : Écran de Login**

```tsx
import { AppText, Button, Input, Divider, Link } from '@/src/shared/ui';

export default function LoginScreen() {
  const { colors, tokens } = useTheme();
  const styles = useMemo(() => createStyles(colors, tokens), [colors, tokens]);
  
  return (
    <KeyboardAvoidingView style={styles.container}>
      <AppText variant="h1" weight="bold" style={styles.title}>
        Welcome Back
      </AppText>
      
      <Input
        leftIcon={<Mail size={20} color={colors.textTertiary} />}
        placeholder="Email"
        containerStyle={styles.inputContainer}
      />
      
      <Link
        text="Forgot password?"
        onPress={handleForgotPassword}
        style={styles.forgotPassword}
      />
      
      <Button
        title="Continue"
        variant="primary"
        onPress={handleSubmit}
      />
      
      <Divider text="or" spacing="md" />
      
      <Button
        title="Continue with Google"
        variant="social"
        leftIcon={<GoogleIcon size={20} />}
      />
    </KeyboardAvoidingView>
  );
}
```

### **Exemple 2 : Carte de Livre**

```tsx
import { Card, BookCover, AppText, Badge, IconButton } from '@/src/shared/ui';

export default function BookCard({ book, onPress, onMenuPress }) {
  const { colors, tokens } = useTheme();
  
  return (
    <Card variant="flat" onPress={onPress}>
      <BookCover
        uri={book.cover}
        title={book.title}
        width={60}
        height={90}
        fallbackIcon="book"
        fallbackIconColor={colors.primary}
      />
      
      <View style={styles.info}>
        <AppText variant="body" weight="semibold" numberOfLines={1}>
          {book.title}
        </AppText>
        
        <AppText variant="caption" color="secondary">
          {book.author}
        </AppText>
        
        {book.year && (
          <Badge
            label={String(book.year)}
            variant="outline"
            size="sm"
          />
        )}
      </View>
      
      <IconButton
        icon={<MoreVertical size={20} />}
        variant="ghost"
        size="sm"
        onPress={onMenuPress}
      />
    </Card>
  );
}
```

---

---

## **🤝 Contribution**

### **Ajouter un nouveau composant**

1. **Vérifier que le composant n'existe pas** dans `shared/ui/` ou `shared/ui/blocks/`
2. **Créer le composant** dans le bon dossier selon sa portée
3. **Utiliser les tokens** pour toutes les valeurs de style
4. **Documenter le composant** avec JSDoc
5. **Exporter le composant** dans `shared/ui/index.ts`
6. **Ajouter un test** si applicable

### **Modifier un token**

1. **Modifier le fichier** `src/shared/theme/tokens.ts` ou `colors.ts`
2. **Vérifier l'impact** sur tous les composants
3. **Mettre à jour la documentation** si nécessaire

### **Signaler un problème**

Ouvrir une issue avec :
- Description du problème
- Localisation (fichier, ligne)
- Screenshot si UI
- Proposition de solution

---

---

## **📚 Ressources**

- [FSD (Feature-Sliced Design)](https://feature-sliced.design/)
- [Design System Guide](https://www.designsystems.com/)
- [React Native Best Practices](https://reactnative.dev/docs/performance)

---

*Documentation générée le 25/07/2026*
