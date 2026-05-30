import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const QuoteDetailModal = React.lazy(() => import('@/src/entities/quote/ui/QuoteDetailModal'));

export default function QuoteDetail() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<QuoteDetailModal />
		</Suspense>
	);
}
