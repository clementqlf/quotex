import React, { Suspense } from 'react';
import { ScreenFallback } from '@/src/shared/ui/ScreenFallback';

const SettingsScreen = React.lazy(() => import('@/src/features/user-settings/ui/SettingsScreen'));

export default function Settings() {
	return (
		<Suspense fallback={<ScreenFallback />}>
			<SettingsScreen />
		</Suspense>
	);
}
