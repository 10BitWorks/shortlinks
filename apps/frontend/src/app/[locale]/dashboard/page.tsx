import { redirect } from 'next/navigation';
import type { DefaultPageParams } from '@/types/page';

export default async function DashboardIndexPage({ params }: DefaultPageParams) {
	const { locale } = await params;
	// next-intl middleware strips the `en` prefix (localePrefix: 'as-needed'),
	// so redirecting via the locale-prefixed path is safe for every locale.
	redirect(`/${locale}/dashboard/qr-codes`);
}
