import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Account, settings, analytics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0A0A0A' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
});
