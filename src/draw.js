import { WHITE, getFiles, getRanks } from './helpers';

export function drawSquare(square, { background, border }) {
	const squareElement = document.querySelector(`.cv-${square}`);
	if (!squareElement) {
		throw `Given square ${square} is not found`;
	}

	if (background) {
		squareElement.style.background = background;
	}
	if (border) {
		squareElement.style.border = border;
	}
}

export function drawText(square, position, text) {
	const textElement = document.querySelector(`.cv-${square}-text .cv-${position}`);
	if (!textElement) {
		throw `Given square's ${square} text element ${position} is not found`;
	}
	textElement.innerText = text;
}

export function createOverlay(id, element, side, zIndex, addText) {
	let overlay = document.getElementById(id);
	if (overlay) {
		overlay.remove();
	}

	let files = getFiles();
	let ranks = getRanks();

	const rect = element.getBoundingClientRect();
	const { width, height, top, left } = rect;

	let overlayElement = document.createElement('div');
	overlayElement.id = id;
	overlayElement.style.position = 'absolute';
	overlayElement.style.zIndex = zIndex;
	overlayElement.style.pointerEvents = 'none';
	overlayElement.style.fontFamily = "'Noto Sans','Segoe UI', sans-serif";
	overlayElement.style.fontSize = '12px';
	overlayElement.style.fontWeight = 'bold';
	overlayElement.style.width = width + 'px';
	overlayElement.style.height = height + 'px';
	overlayElement.style.top = top + window.scrollY + 'px';
	overlayElement.style.left = left + 'px';
	overlayElement.style.display = 'grid';
	overlayElement.style.gridTemplate = `repeat(8, 1fr) / repeat(8, 1fr)`;

	if (side === WHITE) {
		ranks.reverse();
	} else {
		files.reverse();
	}

	let gridSquares = [];

	for (const r of ranks) {
		let gridRow = [];
		for (const f of files) {
			gridRow.push(f + r);
			generateSquare(overlayElement, f + r, addText);
		}
		gridSquares.push(`"${gridRow.join(' ')}"`);
	}

	overlayElement.style.gridTemplateAreas = gridSquares.join('\n');

	document.body.appendChild(overlayElement);
}

function generateSquare(overlayElement, square, addText) {
	let squareElement = document.createElement('div');
	squareElement.style.gridArea = square;
	squareElement.className = `cv-${square}${addText ? '-text' : ''}`;
	squareElement.style.position = 'relative';
	squareElement.style.position = 'relative';

	overlayElement.appendChild(squareElement);
	if (addText) {
		generateText(squareElement, 'tl');
		generateText(squareElement, 'tr');
		generateText(squareElement, 'bl');
		generateText(squareElement, 'br');
	}
}

function generateText(squareElement, position) {
	let textElement = document.createElement('div');
	textElement.style.color = 'white';
	textElement.style.textShadow = '1px 1px 0px black';
	textElement.style.position = 'absolute';
	textElement.style.zIndex = '99999';
	textElement.className = `cv-${position}`;

	switch (position) {
		case 'tl':
			textElement.style.top = '0px';
			textElement.style.left = '2px';
			break;
		case 'tr':
			textElement.style.top = '0px';
			textElement.style.right = '2px';
			break;
		case 'bl':
			textElement.style.bottom = '0px';
			textElement.style.left = '2px';
			break;
		case 'br':
			textElement.style.bottom = '0px';
			textElement.style.right = '2px';
			break;
		default:
			throw `Position must be one of 'tl', 'tr', 'bl', 'br'`;
	}

	squareElement.appendChild(textElement);
}
