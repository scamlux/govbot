import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

/** zustand persist storage backed by AsyncStorage; failures never throw into the UI. */
export const asyncJsonStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      /* storage full or unavailable: state stays in memory */
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
