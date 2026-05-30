import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const ThemeDetailScreen = React.lazy(() => import('@/src/entities/theme/ui/ThemeDetail'));

export default function ThemeDetail() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<ThemeDetailScreen />
		</Suspense>
	);
}
