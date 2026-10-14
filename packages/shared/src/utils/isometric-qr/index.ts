import { qrcodegen } from './qrcodegen';

export interface IsometricQrOptions {
	fgColor?: string;
	bgColor?: string | null;
	quietZone?: number;
	ecc?: 'low' | 'medium' | 'quartile' | 'high';
}

const FINDER_INNER = `<g
     inkscape:groupmode="layer"
     id="layer3"
     inkscape:label="main"
     style="display:inline"
     transform="translate(-4.066176e-6,-350.13974)"><g
       fill="#000000"
       id="finder"><path
         d="m 89.999979,377.47265 54.482061,31.40813 v 62.8223 L 89.999979,503.11423 35.517946,471.70307 v -62.82229 m -15.517939,-6.68376 0.124759,76.53019 69.875213,41.11706 L 160,478.7181 V 400.39605 L 90.000007,360.43521 Z"
         id="cube-wrapper-finder-shell"
         inkscape:label="cube-wrapper-finder-shell"
         sodipodi:nodetypes="ccccccccccccc" /><g
         id="cube"
         style="fill:#000000;fill-opacity:1"
         transform="matrix(0.30477627,0,0,0.30435484,21.9267,364.05103)"><g
           id="inner"
           transform="translate(3.1149455e-8,-1.3184715e-5)"
           style="display:inline;fill:#000000;fill-opacity:1"><polygon
             points="416.54,138.77 416.28,361.69 223.09,472.92 30.17,361.23 30.43,138.31 223.62,27.08 "
             id="polygon1"
             fill="#ffffff"
             style="display:inline;fill:#ffffff;fill-opacity:1"
             transform="matrix(0.92916706,0,0,0.92916706,15.820891,17.708235)" /><polygon
             points="336.52,315.7 336.52,194.07 384.95,166.09 384.94,343.64 "
             id="polygon3"
             fill="#c8c8c8"
             style="display:inline;fill:#c8c8c8;fill-opacity:1"
             transform="matrix(1.0236,0,0,1.0048041,-7.9418788,-1.1854011)" /><polygon
             points="231.2,376.47 231.2,432.4 384.94,343.64 336.52,315.7 "
             id="polygon4"
             fill="#b3b5b5"
             style="display:inline;fill:#b3b5b5;fill-opacity:1"
             transform="matrix(1.0016623,0,0,1.0033122,0.24923128,-0.52017175)" /><polygon
             points="108.99,194.08 60.56,166.1 60.57,343.65 108.99,315.71 "
             id="polygon5"
             fill="#f2f2f2"
             style="display:inline;fill:#f2f2f2;fill-opacity:1" /><polygon
             points="214.31,432.41 60.57,343.65 108.99,315.71 214.31,376.48 "
             id="polygon6"
             fill="#e1e1e1"
             style="display:inline;fill:#e1e1e1;fill-opacity:1" /><path
             d="m 222.75003,126.82441 -113.76498,63.29028 v 126.58065 l 113.76498,63.29028 113.76502,-63.29028 V 190.11469 Z"
             id="finder-core"
             style="display:inline;fill-opacity:1;fill-rule:evenodd;stroke-width:0.505974;stroke-dasharray:none"
             sodipodi:nodetypes="ccccccc"
             inkscape:export-filename="unit-block-template.svg"
             inkscape:export-xdpi="97.835205"
             inkscape:export-ydpi="97.835205" /></g><path
           d="M 394.57149,141.20261 223.355,42.208209 52.148547,141.20261 43.67,146.09656 v 207.79681 l 171.20645,99.00445 8.47855,4.89394 8.47855,-4.89394 L 403.04,353.89337 V 146.09656 l -8.47855,-4.89395 z M 223.355,61.804096 377.61439,151.0106 223.355,240.21712 69.095608,151.0106 Z M 214.88649,433.31198 60.627095,344.10547 V 165.7025 L 214.88649,254.90901 Z M 386.09294,344.10547 231.83355,433.31198 V 254.90901 L 386.09294,165.7025 Z"
           id="cubeframe"
           style="display:inline;fill:#2a2a2a;fill-opacity:1;stroke:#000000;stroke-width:0;stroke-dasharray:none;stroke-opacity:1"
           fill="#1a1a1a" /></g></g></g>`;

const UNIT_INNER = `<path
     d="M 10,0 1,5 v 10 l 9,5 9,-5 V 5 Z"
     id="unit-block-template"
     style="display:inline;fill-opacity:1;fill-rule:evenodd;stroke-width:0.04;stroke-dasharray:none"
     sodipodi:nodetypes="ccccccc"
     inkscape:export-filename="unit-block-template.svg"
     inkscape:export-xdpi="97.835205"
     inkscape:export-ydpi="97.835205" />`;

function mapEccLevel(level?: 'low' | 'medium' | 'quartile' | 'high'): qrcodegen.QrCode.Ecc {
	switch (level) {
		case 'low':
			return qrcodegen.QrCode.Ecc.LOW;
		case 'medium':
			return qrcodegen.QrCode.Ecc.MEDIUM;
		case 'quartile':
			return qrcodegen.QrCode.Ecc.QUARTILE;
		case 'high':
		default:
			return qrcodegen.QrCode.Ecc.HIGH;
	}
}

/**
 * Generates an SVG string of the 10BitWorks isometric QR code.
 *
 * @param text The text or URL to encode. Throws Error if empty or too long.
 * @param options Optional rendering configurations (colors, quietZone, error correction).
 * @returns Complete standalone SVG XML string.
 */
export function generateIsometricQrSvg(text: string, options: IsometricQrOptions = {}): string {
	if (!text || text.length === 0) {
		throw new Error('QR text cannot be empty');
	}

	const fgColor = options.fgColor ?? '#000000';
	const bgColor = options.bgColor ?? null;
	const quietZone = options.quietZone ?? 4;
	const ecc = mapEccLevel(options.ecc);

	const segs = qrcodegen.QrSegment.makeSegments(text);
	const qr = qrcodegen.QrCode.encodeSegments(segs, ecc, 1, 40, -1, true);

	const size = qr.size;
	const moduleSize = 20;
	const viewSize = (size + quietZone * 2) * moduleSize;

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" viewBox="0 0 ${viewSize} ${viewSize}" width="100%" height="100%">`;

	// Background
	if (bgColor !== null && bgColor !== undefined && bgColor !== '') {
		svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`;
	}

	// Content root group
	svg += `<g transform="translate(${quietZone * moduleSize}, ${quietZone * moduleSize})" color="${fgColor}" fill="${fgColor}">`;

	// Finders: Top-Left defines finder-def
	svg += `<g transform="translate(-20, -20)"><g id="finder-def">${FINDER_INNER}</g></g>`;
	// Top-Right
	svg += `<use href="#finder-def" x="${(size - 7) * moduleSize - 20}" y="-20" />`;
	// Bottom-Left
	svg += `<use href="#finder-def" x="-20" y="${(size - 7) * moduleSize - 20}" />`;

	// Data modules
	let unitDefRendered = false;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			// Skip 8x8 corner zones
			const isTopLeft = x < 8 && y < 8;
			const isTopRight = x >= size - 8 && y < 8;
			const isBottomLeft = x < 8 && y >= size - 8;

			if (isTopLeft || isTopRight || isBottomLeft) {
				continue;
			}

			if (qr.getModule(x, y)) {
				if (!unitDefRendered) {
					svg += `<g transform="translate(${x * moduleSize}, ${y * moduleSize})"><g id="unit-def">${UNIT_INNER}</g></g>`;
					unitDefRendered = true;
				} else {
					svg += `<use href="#unit-def" x="${x * moduleSize}" y="${y * moduleSize}" />`;
				}
			}
		}
	}

	svg += `</g></svg>`;
	return svg;
}

export * from './qrcodegen';
