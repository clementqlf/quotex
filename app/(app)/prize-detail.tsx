import { useLocalSearchParams } from 'expo-router';
import PrizeDetailScreen from '../../src/pages/PrizeDetailScreen';

export default function PrizeDetail() {
    const { prizeId } = useLocalSearchParams<{ prizeId: string }>();
    return <PrizeDetailScreen prizeId={parseInt(prizeId)} />;
}
