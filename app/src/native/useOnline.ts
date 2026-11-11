import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** Live connectivity; assumes online until NetInfo says otherwise. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false)),
    [],
  );
  return online;
}
