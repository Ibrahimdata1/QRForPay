---
name: react-native-extras
description: Use when asked about FlashList, Reanimated animations, EAS Build, haptic feedback, or platform-specific shadow/style patterns in React Native Expo projects.
---

# React Native Extras — Performance, Native & Build

Curated patterns for QRForPay stack (Expo + Zustand + Supabase). Covers gaps not in dev agent: FlashList, Reanimated, EAS Build, Haptics.

> ⚠️ Project uses **Zustand** (not React Query) and **Supabase auth** (not expo-secure-store) — do not apply those patterns here.

---

## Pattern 1: FlashList (แทน FlatList)

```typescript
import { FlashList } from '@shopify/flash-list'
import { memo, useCallback } from 'react'

const ProductItem = memo(function ProductItem({
  item,
  onPress,
}: {
  item: Product
  onPress: (id: string) => void
}) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress])
  return (
    <Pressable onPress={handlePress}>
      <Text>{item.name}</Text>
    </Pressable>
  )
})

export function ProductList({ products, onProductPress }) {
  const renderItem = useCallback(
    ({ item }) => <ProductItem item={item} onPress={onProductPress} />,
    [onProductPress]
  )

  return (
    <FlashList
      data={products}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      estimatedItemSize={100}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  )
}
```

Install: `npx expo install @shopify/flash-list`

---

## Pattern 2: Reanimated (60fps animations)

```typescript
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Platform, Pressable } from 'react-native'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function AnimatedButton({ title, onPress, disabled }) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.95)
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handlePressOut = () => {
    scale.value = withSpring(1)
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={animatedStyle}
    >
      <Text>{title}</Text>
    </AnimatedPressable>
  )
}
```

Install: `npx expo install react-native-reanimated`
Add to `babel.config.js` plugins: `'react-native-reanimated/plugin'`

---

## Pattern 3: Haptic Feedback Service

```typescript
// services/haptics.ts
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

export const haptics = {
  light: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  },
  medium: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  },
  heavy: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }
  },
  success: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  },
  error: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  },
}
```

Install: `npx expo install expo-haptics`

---

## Pattern 4: Platform-Specific Shadows

```typescript
import { StyleSheet, Platform } from 'react-native'

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
})
```

---

## Pattern 5: EAS Build

```json
// eas.json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@email.com", "ascAppId": "123456789" },
      "android": { "serviceAccountKeyPath": "./google-services.json" }
    }
  }
}
```

```bash
# Build
eas build --platform ios --profile development
eas build --platform android --profile preview
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android

# OTA update
eas update --branch production --message "Bug fixes"
```

---

## Best Practices

- **FlashList แทน FlatList** เสมอสำหรับ list ยาว (ประหยัด memory มากกว่า)
- **Reanimated แทน Animated** สำหรับ animation (รันบน native thread = 60fps)
- **ห้าม inline styles** — ใช้ `StyleSheet.create` เสมอ (cached, ไม่สร้าง object ใหม่ทุก render)
- **ทดสอบบน device จริง** — simulator ไม่แสดง haptics, biometrics, และ performance ที่แท้จริง
- **ทุก haptic call ต้องมี `Platform.OS !== 'web'` guard** — expo-haptics crash บน web
