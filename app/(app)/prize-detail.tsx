import { useLocalSearchParams } from 'expo-router';
import PrizeDetailScreen from '@/src/features/prizes/ui/PrizeDetailScreen';

export default function PrizeDetail() {
    const { prizeId, prizeData } = useLocalSearchParams<{ prizeId?: string; prizeData?: string }>();
    return <PrizeDetailScreen prizeId={prizeId ? parseInt(prizeId) : undefined} prizeData={prizeData} />;
}
