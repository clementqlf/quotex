import React, { Suspense } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const PrizeDetailScreen = React.lazy(() => import('@/src/features/prizes/ui/PrizeDetailScreen'));

export default function PrizeDetail() {
    const { prizeId, prizeData } = useLocalSearchParams<{ prizeId?: string; prizeData?: string }>();
        return (
            <Suspense fallback={<ScreenFallback />}>
                <PrizeDetailScreen prizeId={prizeId ? parseInt(prizeId) : undefined} prizeData={prizeData} />
            </Suspense>
        );
}
