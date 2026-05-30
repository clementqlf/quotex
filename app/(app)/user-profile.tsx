import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const UserProfileScreen = React.lazy(() => import('@/src/entities/user/ui/UserProfile'));

export default function UserProfile() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<UserProfileScreen />
		</Suspense>
	);
}
