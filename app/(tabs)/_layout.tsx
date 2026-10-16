import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTab } from '@/components/haptic-tab';
import { Icon, palette } from '@/components/crop/ui';
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'web' ? 10 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{
    headerShown: false, tabBarButton: HapticTab,
    tabBarActiveTintColor: palette.lime, tabBarInactiveTintColor: '#798579',
    tabBarStyle: { backgroundColor: '#141717', borderTopColor: palette.line, borderTopWidth: 1, paddingTop: 9, paddingBottom: bottomPadding, height: 55 + bottomPadding },
    tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginTop: 3 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Studio', tabBarIcon: ({ color }) => <Icon name="grid-outline" color={color} size={22} /> }} />
    <Tabs.Screen name="exports" options={{ title: 'Exports', tabBarIcon: ({ color }) => <Icon name="layers-outline" color={color} size={22} /> }} />
    <Tabs.Screen name="pro" options={{ title: 'Pro', tabBarIcon: ({ color }) => <Icon name="sparkles-outline" color={color} size={22} /> }} />
  </Tabs>;
}
