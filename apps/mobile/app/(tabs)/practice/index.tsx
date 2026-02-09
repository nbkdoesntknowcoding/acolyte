import { View, Text, StyleSheet } from 'react-native';

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Practice</Text>
      <Text style={styles.subtitle}>MCQ tests, subject-wise practice</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0A0A0A' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
});
