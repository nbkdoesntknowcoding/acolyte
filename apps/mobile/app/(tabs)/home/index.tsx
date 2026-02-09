import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome back</Text>
      <Text style={styles.subtitle}>Your study companion</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0A0A0A' },
  greeting: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  subtitle: { fontSize: 16, color: '#94A3B8', marginTop: 4 },
});
