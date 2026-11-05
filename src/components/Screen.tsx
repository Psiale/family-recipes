import {
  createContext,
  useContext,
  useImperativeHandle,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
  type Ref,
  type RefObject,
} from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from './theme';

type Scroller = ComponentRef<typeof ScrollView>;
const ScrollContext = createContext<RefObject<Scroller | null> | null>(null);

// Reveal a newly mounted step once, after native layout supplies its position.
export function ScrollIntoView({ children }: PropsWithChildren) {
  const scroller = useContext(ScrollContext);
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const revealed = useRef(false);
  const reveal = async () => {
    const node = anchor.current;
    const scroll = scroller?.current;
    const content = scroll?.getInnerViewRef();
    if (!node || !scroll || !content || revealed.current) return;
    revealed.current = true;
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
      () => true,
    );
    if (node !== anchor.current) return;
    node.measureLayout(content, (_x, y) => {
      if (node === anchor.current)
        scroll.scrollTo({
          y: Math.max(0, y - spacing.md),
          animated: !reduceMotion,
        });
    });
  };
  return (
    <View ref={anchor} collapsable={false} onLayout={() => void reveal()}>
      {children}
    </View>
  );
}

type ScreenProps = PropsWithChildren<{
  contentStyle?: ViewStyle;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
}>;

export function Screen({ children, contentStyle, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const nativeScroll = useRef<Scroller>(null);
  useImperativeHandle(scrollRef, () => nativeScroll.current!, []);

  return (
    <ScrollView
      ref={nativeScroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          paddingLeft: Math.max(insets.left, spacing.lg),
          paddingRight: Math.max(insets.right, spacing.lg),
          paddingTop: Math.max(insets.top, spacing.lg),
        },
        contentStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      <ScrollContext.Provider value={nativeScroll}>
        {children}
      </ScrollContext.Provider>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
