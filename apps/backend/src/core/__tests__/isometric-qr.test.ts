import { generateIsometricQrSvg, IsometricQrOptions, qrcodegen } from '@shared/schemas';

describe('Isometric QR Vector Generator', () => {
	const sampleText = 'https://10bitworks.org';

	it('criterion 1: output starts with <svg, has viewBox, ends with </svg>', () => {
		const svg = generateIsometricQrSvg(sampleText);
		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg).toContain('viewBox="0 0 ');
		expect(svg.endsWith('</svg>')).toBe(true);
	});

	it('criterion 2: contains finder-def and unit-def in definitions', () => {
		const svg = generateIsometricQrSvg(sampleText);
		expect(svg).toContain('id="finder-def"');
		expect(svg).toContain('id="unit-def"');
	});

	it('criterion 3: count of <use href="#unit-def" equals active data modules computed via ported QrCode minus 1', () => {
		const segs = qrcodegen.QrSegment.makeSegments(sampleText);
		const qr = qrcodegen.QrCode.encodeSegments(segs, qrcodegen.QrCode.Ecc.HIGH, 1, 40, -1, true);

		let activeDataModules = 0;
		for (let y = 0; y < qr.size; y++) {
			for (let x = 0; x < qr.size; x++) {
				const isTopLeft = x < 8 && y < 8;
				const isTopRight = x >= qr.size - 8 && y < 8;
				const isBottomLeft = x < 8 && y >= qr.size - 8;
				if (isTopLeft || isTopRight || isBottomLeft) continue;

				if (qr.getModule(x, y)) {
					activeDataModules++;
				}
			}
		}

		const svg = generateIsometricQrSvg(sampleText, { ecc: 'high' });
		// First module defines unit-def (<g id="unit-def">), subsequent modules use <use href="#unit-def"
		const matches = svg.match(/<use href="#unit-def"/g) || [];
		expect(activeDataModules).toBeGreaterThan(0);
		expect(matches.length).toBe(activeDataModules - 1);
	});

	it('criterion 4: both non-top-left finder use offsets present', () => {
		const quietZone = 4;
		const segs = qrcodegen.QrSegment.makeSegments(sampleText);
		const qr = qrcodegen.QrCode.encodeSegments(segs, qrcodegen.QrCode.Ecc.HIGH, 1, 40, -1, true);
		const expectedOffset = (qr.size - 7) * 20 - 20;

		const svg = generateIsometricQrSvg(sampleText, { quietZone, ecc: 'high' });
		expect(svg).toContain(`<use href="#finder-def" x="${expectedOffset}" y="-20" />`);
		expect(svg).toContain(`<use href="#finder-def" x="-20" y="${expectedOffset}" />`);
	});

	it('criterion 5: fgColor and bgColor are properly applied', () => {
		const customFg = '#ff5500';
		const customBg = '#112233';
		const svgWithBg = generateIsometricQrSvg(sampleText, {
			fgColor: customFg,
			bgColor: customBg,
		});

		expect(svgWithBg).toContain(`color="${customFg}"`);
		expect(svgWithBg).toContain(`fill="${customFg}"`);
		expect(svgWithBg).toContain(`<rect width="100%" height="100%" fill="${customBg}"/>`);

		// bgColor null/omitted = transparent (no bg rect)
		const svgTransparent = generateIsometricQrSvg(sampleText, {
			fgColor: customFg,
			bgColor: null,
		});
		expect(svgTransparent).not.toContain('<rect');
	});

	it('criterion 6: empty string throws error', () => {
		expect(() => generateIsometricQrSvg('')).toThrow('QR text cannot be empty');
	});
});
