import Svg, { Path } from 'react-native-svg';

import { colors } from './theme';

const paths = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m-6-6 6 6 6-6',
  'chevron-up': 'm6 15 6-6 6 6',
  'chevron-down': 'm6 9 6 6 6-6',
} as const;

export function ActionIcon({ name }: { name: keyof typeof paths }) {
  return (
    <Svg
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.primary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={paths[name]} />
    </Svg>
  );
}
