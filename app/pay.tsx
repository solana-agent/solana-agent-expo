import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

export default function TransferScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Wait a tick to ensure router is mounted
    const timeout = setTimeout(() => {
      if (params.to) {
        router.replace({
          pathname: '/',
          params,
        });
      } else {
        router.replace('/');
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [params, router]);

  return null;
}
