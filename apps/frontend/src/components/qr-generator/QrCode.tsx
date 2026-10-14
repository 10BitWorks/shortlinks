'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import QRCodeStyling, { type Options } from 'qr-code-styling';
import { cn, createLinkFromShortUrl } from '@/lib/utils';
import {
	convertQRCodeDataToStringByType,
	convertQrCodeOptionsToLibraryOptions,
	generateIsometricQrSvg,
	isDynamic,
	type TQrCode,
	type TShortUrlResponseDto,
	type TShortUrlWithCustomDomainResponseDto,
} from '@shared/schemas';
import { DynamicBadge } from './DynamicBadge';
import { DefaultDomainPicker } from './DefaultDomainPicker';
import { SmartTipPopover } from '@/components/dashboard/smart-tips/SmartTipPopover';
import { useShortUrlLink } from '@/hooks/use-short-url-link';

export type QrCodeProps = {
	qrCode: Pick<TQrCode, 'config' | 'content'> & { qrCodeData?: TQrCode['qrCodeData'] };
	additionalStyles?: string;
	shortUrl?: TShortUrlWithCustomDomainResponseDto | TShortUrlResponseDto;
	hasProPlan?: boolean;
	hideDomainEdit?: boolean;
};

function getQrCodeData(props: QrCodeProps): string {
	const { qrCode, shortUrl } = props;

	// Use stored qrCodeData if available (has correct custom domain baked in)
	if (qrCode.qrCodeData) {
		return qrCode.qrCodeData;
	}

	// Otherwise compute on the fly (for preview/generator)
	return (
		convertQRCodeDataToStringByType(
			qrCode.content,
			shortUrl ? createLinkFromShortUrl(shortUrl) : undefined,
		) || 'https://qrcodly.de'
	);
}

/**
 * Which custom domain the short URL points at, as far as the props reveal it.
 *
 * `getQrCodeData` cannot see this: it builds the link without a resolved domain, and a short URL
 * that only carries `customDomainId` therefore always renders as the system link there. Comparing
 * the id separately is what lets a domain switch through — the component resolves the id to a host
 * itself, so without this the memo would report "equal" and the link under the code would freeze
 * on the previous domain.
 */
function getCustomDomainKey(props: QrCodeProps): string | null {
	const { shortUrl } = props;
	if (!shortUrl) return null;
	return 'customDomain' in shortUrl
		? (shortUrl.customDomain?.id ?? null)
		: (shortUrl.customDomainId ?? null);
}

function areQrCodePropsEqual(prev: QrCodeProps, next: QrCodeProps) {
	if (getCustomDomainKey(prev) !== getCustomDomainKey(next)) return false;
	if (prev.qrCode.config.theme !== next.qrCode.config.theme) return false;

	const optionsPrev = {
		...convertQrCodeOptionsToLibraryOptions(prev.qrCode.config),
		theme: prev.qrCode.config.theme,
		data: getQrCodeData(prev),
	};

	const optionsNext = {
		...convertQrCodeOptionsToLibraryOptions(next.qrCode.config),
		theme: next.qrCode.config.theme,
		data: getQrCodeData(next),
	};

	return JSON.stringify(optionsPrev) == JSON.stringify(optionsNext);
}

function QrCode({
	qrCode,
	additionalStyles = '',
	shortUrl,
	hasProPlan,
	hideDomainEdit,
}: QrCodeProps) {
	const { link: resolvedShortUrl } = useShortUrlLink(shortUrl);
	const { link: shortUrlDisplay } = useShortUrlLink(shortUrl, true);

	const isIsometric = qrCode.config.theme === '10bit-isometric';

	const qrData = useMemo(() => {
		return (
			qrCode.qrCodeData ??
			((isDynamic(qrCode.content) && resolvedShortUrl
				? convertQRCodeDataToStringByType(qrCode.content, resolvedShortUrl)
				: convertQRCodeDataToStringByType(qrCode.content)) ||
				'https://qrcodly.de')
		);
	}, [qrCode.content, qrCode.qrCodeData, resolvedShortUrl]);

	const options: Options = useMemo(() => {
		return {
			...convertQrCodeOptionsToLibraryOptions(qrCode.config),
			data: qrData,
		};
	}, [qrCode.config, qrData]);

	const [qrCodeInstance, setQrCode] = useState<QRCodeStyling>();
	const ref = useRef<HTMLDivElement>(null);

	// In isometric mode: generate SVG directly and inject into container
	// In standard mode: instantiate/update QRCodeStyling and clean up container
	useEffect(() => {
		if (!ref.current) return;

		if (isIsometric) {
			// Clear any previous QRCodeStyling canvas/svg elements
			ref.current.innerHTML = '';

			const dotsStyle = qrCode.config.dotsOptions?.style;
			const fgColor =
				dotsStyle?.type === 'hex' || dotsStyle?.type === 'rgba'
					? dotsStyle.value
					: dotsStyle?.type === 'gradient'
						? (dotsStyle.colorStops?.[0]?.color ?? '#000000')
						: '#000000';

			const bgStyle = qrCode.config.backgroundOptions?.style;
			const bgColor =
				bgStyle?.type === 'hex' || bgStyle?.type === 'rgba'
					? bgStyle.value
					: bgStyle?.type === 'gradient'
						? (bgStyle.colorStops?.[0]?.color ?? null)
						: null;

			const margin = qrCode.config.margin;
			const quietZone =
				typeof margin === 'number' && margin > 0 ? Math.max(0, Math.round(margin / 20)) : 4;

			try {
				const svg = generateIsometricQrSvg(qrData, {
					fgColor,
					bgColor,
					quietZone,
					ecc: 'high',
				});
				if (ref.current) {
					ref.current.innerHTML = svg;
				}
			} catch (e) {
				console.error('Failed to generate isometric QR SVG:', e);
			}

			return () => {
				if (ref.current) {
					ref.current.innerHTML = '';
				}
			};
		} else {
			// Standard mode
			ref.current.innerHTML = '';
			const instance = new QRCodeStyling(options);
			setQrCode(instance);
			instance.append(ref.current);

			return () => {
				if (ref.current) {
					ref.current.innerHTML = '';
				}
			};
		}
	}, [isIsometric, qrCode.config, qrData]);

	// Update standard QRCodeStyling instance if options change while in standard mode
	useEffect(() => {
		if (isIsometric || !qrCodeInstance) return;

		qrCodeInstance.update(options);
	}, [isIsometric, qrCodeInstance, options]);

	return (
		<div className="flex flex-col">
			<div
				className={cn(
					'canvas-wrap mx-auto max-h-[200px] max-w-[200px] lg:max-h-[300px] lg:max-w-[300px]',
					additionalStyles,
				)}
				ref={ref}
			/>

			{shortUrl && isDynamic(qrCode.content) && (
				<div className="mt-4 hidden flex-wrap xs:flex items-center justify-between">
					<DynamicBadge />
					<SmartTipPopover
						anchor="dynamic-url"
						stateContext={{
							hasDynamicQr: true,
							hasCustomDomain:
								('customDomain' in shortUrl && !!shortUrl.customDomain) ||
								('customDomainId' in shortUrl && !!shortUrl.customDomainId),
							hasProPlan,
						}}
					>
						<div className="text-xs ml-4 flex items-center gap-1">
							<span className="pt-0.5">{shortUrlDisplay}</span>
							{!hideDomainEdit && <DefaultDomainPicker />}
						</div>
					</SmartTipPopover>
				</div>
			)}
		</div>
	);
}

export default memo(QrCode, areQrCodePropsEqual);
