import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const SearchScreen = React.lazy(() => import('@/src/features/search/ui/SearchScreen'));

export default function Search() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<SearchScreen />
		</Suspense>
	);
}
