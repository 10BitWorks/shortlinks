import {
	convertQRCodeDataToStringByType,
	convertQrCodeOptionsToLibraryOptions,
	getDefaultContentByType,
	generateIsometricQrSvg,
	isDynamic,
	type TCustomDomainResponseDto,
	type TFileExtension,
	type TQrCodeContent,
	type TQrCodeOptions,
	type TShortUrl,
} from '@shared/schemas';
import { createLinkFromShortUrl } from './utils';
import type { Options } from 'qr-code-styling';

/**
 * Get the short URL string for rendering if needed
 * @param content - The QR code content
 * @param shortUrl - The short URL object (with customDomainId)
 * @param customDomain - Optional resolved custom domain object
 */
export function getShortUrlForRendering(
	content: TQrCodeContent,
	shortUrl?: TShortUrl,
	customDomain?: TCustomDomainResponseDto | null,
): string | undefined {
	if (!isDynamic(content) || !shortUrl) {
		return undefined;
	}
	return createLinkFromShortUrl(shortUrl, { customDomain });
}

/**
 * Resolve QR code payload string according to data/content/shortUrl.
 */
export function getQrCodePayload(
	content: TQrCodeContent,
	options?: {
		qrCodeData?: string | null;
		shortUrl?: TShortUrl;
		customDomain?: TCustomDomainResponseDto | null;
	},
): string {
	const { qrCodeData, shortUrl, customDomain } = options ?? {};
	return (
		qrCodeData ??
		(convertQRCodeDataToStringByType(
			content,
			getShortUrlForRendering(content, shortUrl, customDomain),
		) ||
			'https://qrcodly.de')
	);
}

/**
 * Build isometric QR SVG string from config and payload data.
 * Reuses the same color and quietZone mapping as QrCode.tsx.
 */
export function buildIsometricQrSvg(config: TQrCodeOptions, payload: string): string {
	const dotsStyle = config.dotsOptions?.style;
	const fgColor =
		dotsStyle?.type === 'hex' || dotsStyle?.type === 'rgba'
			? dotsStyle.value
			: dotsStyle?.type === 'gradient'
				? (dotsStyle.colorStops?.[0]?.color ?? '#000000')
				: '#000000';

	const bgStyle = config.backgroundOptions?.style;
	const bgColor =
		bgStyle?.type === 'hex' || bgStyle?.type === 'rgba'
			? bgStyle.value
			: bgStyle?.type === 'gradient'
				? (bgStyle.colorStops?.[0]?.color ?? null)
				: null;

	const margin = config.margin;
	const quietZone =
		typeof margin === 'number' && margin > 0 ? Math.max(0, Math.round(margin / 20)) : 4;

	return generateIsometricQrSvg(payload, {
		fgColor,
		bgColor,
		quietZone,
		ecc: 'high',
	});
}

/**
 * Trigger browser file download from Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
}

/**
 * Export isometric QR code directly client-side as SVG or raster (PNG/JPEG/WEBP).
 */
export async function downloadIsometricQrCode({
	config,
	payload,
	name = 'qr-code',
	extension,
}: {
	config: TQrCodeOptions;
	payload: string;
	name?: string;
	extension: TFileExtension;
}): Promise<void> {
	const svgString = buildIsometricQrSvg(config, payload);
	const filename = `${name}.${extension}`;

	if (extension === 'svg') {
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		downloadBlob(blob, filename);
		return;
	}

	const width = config.width && config.width > 0 ? config.width : 1024;
	const height = config.height && config.height > 0 ? config.height : 1024;

	const mimeType =
		extension === 'jpeg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : 'image/png';

	await new Promise<void>((resolve, reject) => {
		const img = new Image();
		const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(svgBlob);

		img.onload = () => {
			URL.revokeObjectURL(url);
			try {
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Could not get 2D canvas context'));
					return;
				}

				if (extension === 'jpeg') {
					// JPEG needs opaque background (canvas default is transparent)
					const bgStyle = config.backgroundOptions?.style;
					const bgColor =
						bgStyle?.type === 'hex' || bgStyle?.type === 'rgba'
							? bgStyle.value
							: bgStyle?.type === 'gradient'
								? (bgStyle.colorStops?.[0]?.color ?? '#ffffff')
								: '#ffffff';
					ctx.fillStyle = bgColor;
					ctx.fillRect(0, 0, width, height);
				}

				ctx.drawImage(img, 0, 0, width, height);
				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Failed to convert canvas to blob'));
						return;
					}
					downloadBlob(blob, filename);
					resolve();
				}, mimeType);
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG into image'));
		};

		img.src = url;
	});
}

/**
 * Convert QR code data to QRCodeStyling options.
 * If qrCodeData is provided (from database), use it directly.
 * Otherwise, compute it from content and shortUrl (for preview/generator).
 *
 * @param config - QR code styling configuration
 * @param content - QR code content
 * @param options - Optional settings
 * @param options.qrCodeData - Pre-computed QR code data from database (takes priority)
 * @param options.shortUrl - Short URL object for computing data on the fly
 * @param options.customDomain - Custom domain for computing data on the fly
 */
export function getQrCodeStylingOptions(
	config: TQrCodeOptions,
	content: TQrCodeContent,
	options?: {
		qrCodeData?: string | null;
		shortUrl?: TShortUrl;
		customDomain?: TCustomDomainResponseDto | null;
	},
): Options {
	const data = getQrCodePayload(content, options);

	return {
		...convertQrCodeOptionsToLibraryOptions(config),
		data,
	};
}

/**
 * Check if content is at default state (not ready for download)
 */
export function isContentAtDefault(content: TQrCodeContent, isSignedIn = false): boolean {
	return (
		JSON.stringify(content) === JSON.stringify(getDefaultContentByType(content.type, isSignedIn))
	);
}

/**
 * Check if QR code data has changed
 */
export function hasQrCodeChanged(
	current: { config: TQrCodeOptions; content: TQrCodeContent },
	latest?: { config: TQrCodeOptions; content: TQrCodeContent },
): boolean {
	if (!latest) return true;
	return (
		JSON.stringify(current.content) !== JSON.stringify(latest.content) ||
		JSON.stringify(current.config) !== JSON.stringify(latest.config)
	);
}
