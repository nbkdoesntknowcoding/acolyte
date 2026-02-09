import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
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
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="study/index"
        options={{
          title: 'Study',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice/index"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logbook/index"
        options={{
          title: 'Logbook',
          tabBarIcon: ({ color, size }) => <Ionicons name="journal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
