import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const AuthorDetailScreen = React.lazy(() => import('@/src/entities/author/ui/AuthorDetail'));

export default function AuthorDetail() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<AuthorDetailScreen />
		</Suspense>
	);
}
