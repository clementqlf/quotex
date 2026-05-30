import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const ScanScreen = React.lazy(() => import('@/src/features/scanner/ui/ScanScreen'));

export default function Scan() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<ScanScreen />
		</Suspense>
	);
}
