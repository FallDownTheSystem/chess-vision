export const BLACK = 'b';
export const WHITE = 'w';

export function range(start, end) {
	return Array(end - start + 1)
		.fill()
		.map((_, idx) => start + idx);
}

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = range(1, 8);

export function getFiles() {
	return [...files];
}

export function getRanks() {
	return [...ranks];
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const cleanse = (x) => {
	const chars = ['↵', '✓', '1-0', '0-1', '1/2-1/2', '\n', /\[+-][0-9.]+/];
	for (const c of chars) {
		x = x.replace(c, '');
	}
	return x.trim();
};
