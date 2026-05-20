import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // @ts-expect-error Animation option not typed in expo-router
    router.replace('/(app)', { animation: 'none' });
  }, [router]);

  return null;
}
