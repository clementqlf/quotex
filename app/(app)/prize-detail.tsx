import PrizeDetailScreen from '@/src/features/prizes/ui/PrizeDetailScreen';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function PrizeDetail() {
    const { prizeId, prizeData } = useLocalSearchParams<{ prizeId?: string; prizeData?: string }>();
    return <PrizeDetailScreen prizeId={prizeId ? parseInt(prizeId) : undefined} prizeData={prizeData} />;
}
