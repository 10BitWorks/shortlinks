import { buttonVariants } from '@/components/ui/button';
import Container from '@/components/ui/container';
import type { DefaultPageParams } from '@/types/page';
import type { Metadata } from 'next';
import Link from 'next/link';

// Keep auth-offline page out of search engines.
export const metadata: Metadata = {
	title: 'Sign-in Offline | 10BitWorks',
	robots: { index: false, follow: false },
};

// TODO(i18n): localize when Authentik port lands
export default async function AuthOfflinePage({ params }: DefaultPageParams) {
	await params;

	return (
		<div className="mt-24 flex h-full w-full flex-1 flex-col items-center justify-center">
			<Container>
				<h1 className="mt-8 mb-6 text-center text-2xl sm:text-4xl font-semibold">
					Sign-in Temporarily Offline
				</h1>
				<p className="mb-4 text-center text-lg text-gray-700">
					Sign-in is temporarily disabled on this instance. SSO via 10BitWorks Authentik is coming
					soon.
				</p>
				<p className="mb-10 text-center text-md text-gray-500">
					Please check back later or return to the main page.
				</p>
				<div className="flex justify-center">
					<Link href="/" className={buttonVariants()}>
						Return Home
					</Link>
				</div>
			</Container>
		</div>
	);
}
