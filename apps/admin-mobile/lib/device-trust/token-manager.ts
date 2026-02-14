import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "acolyte_device_token";
const EXPIRY_KEY = "acolyte_device_expiry";

export const tokenManager = {
  async store(token: string, expiresAt: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(EXPIRY_KEY, expiresAt);
  },

  async getToken(): Promise<string | null> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return null;
    const expiry = await SecureStore.getItemAsync(EXPIRY_KEY);
    if (expiry && new Date(expiry) < new Date()) {
      await this.clear();
      return null;
    }
    return token;
  },

  async isRegistered(): Promise<boolean> {
    return (await this.getToken()) !== null;
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRY_KEY);
  },

  async getExpiry(): Promise<string | null> {
    return SecureStore.getItemAsync(EXPIRY_KEY);
  },
};
