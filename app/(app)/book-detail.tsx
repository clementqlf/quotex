import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const BookDetailScreen = React.lazy(() => import('@/src/entities/book/ui/BookDetail'));

export default function BookDetail() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<BookDetailScreen />
		</Suspense>
	);
}
