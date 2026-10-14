import { SignInButton } from '@clerk/nextjs';
import { useLocale } from 'next-intl';
import React from 'react';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';

export const LoginRequiredDialog = ({
	alertOpen,
	setAlertOpen,
}: {
	alertOpen: boolean;
	setAlertOpen: (open: boolean) => void;
}) => {
	const t = useTranslations('loginDialog');
	const locale = useLocale();
	return (
		<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t('title')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('description')}
						<br />
						<strong>{t('subDescription')}</strong>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t('cancelBtn')}</AlertDialogCancel>
					{process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'true' && (
						<SignInButton signUpForceRedirectUrl={`/${locale}/signup-success`}>
							<AlertDialogAction>{t('loginBtn')}</AlertDialogAction>
						</SignInButton>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
