import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useAuthenticatedUser, type UserRole } from '@/lib/auth';

type TabConfig = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles: UserRole[] | 'all';
};

const TABS: TabConfig[] = [
  { name: 'home/index', title: 'Home', icon: 'home', roles: 'all' },
  { name: 'study/index', title: 'Study', icon: 'book', roles: ['student'] },
  { name: 'practice/index', title: 'Practice', icon: 'clipboard', roles: ['student'] },
  { name: 'logbook/index', title: 'Logbook', icon: 'journal', roles: ['student', 'faculty', 'hod'] },
  { name: 'profile/index', title: 'Profile', icon: 'person', roles: 'all' },
];

function isTabVisible(tab: TabConfig, role: UserRole): boolean {
  if (tab.roles === 'all') return true;
  return tab.roles.includes(role);
}

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useAuthenticatedUser();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const role = user?.role || 'student';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#2A2A2A',
        },
        headerStyle: {
          backgroundColor: '#0A0A0A',
        },
        headerTintColor: '#FFFFFF',
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} size={size} color={color} />
            ),
            // Hide tabs that aren't relevant for this role
            href: isTabVisible(tab, role) ? undefined : null,
          }}
        />
      ))}
    </Tabs>
  );
}
