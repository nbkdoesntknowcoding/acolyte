import { View, Text, StyleSheet } from 'react-native';

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Acolyte</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
      {/* TODO: Clerk SignIn component for mobile */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
  },
});
