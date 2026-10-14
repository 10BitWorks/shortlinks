import 'reflect-metadata';
import { container } from 'tsyringe';
import { QrCodeDefaults } from '@shared/schemas';
import { RenderQrCodeUseCase } from '../render-qr-code.use-case';

describe('RenderQrCodeUseCase (10bit-isometric)', () => {
	let useCase: RenderQrCodeUseCase;

	beforeAll(() => {
		useCase = container.resolve(RenderQrCodeUseCase);
	});

	it('renders isometric SVG with finder-def and unit-def when theme is 10bit-isometric', async () => {
		const result = await useCase.execute({
			format: 'svg',
			config: {
				...QrCodeDefaults,
				theme: '10bit-isometric',
				width: 1000,
				height: 1000,
				margin: 0,
			},
			data: 'https://10bitworks.org/isometric',
		});

		expect(result.contentType).toBe('image/svg+xml');
		const svgText = result.buffer.toString('utf8');
		expect(svgText).toContain('finder-def');
		expect(svgText).toContain('unit-def');
	});

	it('renders isometric PNG with valid PNG magic bytes when theme is 10bit-isometric', async () => {
		const result = await useCase.execute({
			format: 'png',
			config: {
				...QrCodeDefaults,
				theme: '10bit-isometric',
				width: 1000,
				height: 1000,
				margin: 0,
			},
			data: 'https://10bitworks.org/isometric',
		});

		expect(result.contentType).toBe('image/png');
		const body = result.buffer;
		expect(body.length).toBeGreaterThan(100);
		expect(body.subarray(0, 8)).toEqual(
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		);
	});
});
