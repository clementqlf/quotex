import { useLocalSearchParams } from 'expo-router';
import PrizeDetailScreen from '../../src/pages/PrizeDetailScreen';

export default function PrizeDetail() {
    const { prizeId, prizeData } = useLocalSearchParams<{ prizeId?: string; prizeData?: string }>();
    return <PrizeDetailScreen prizeId={prizeId ? parseInt(prizeId) : undefined} prizeData={prizeData} />;
}
