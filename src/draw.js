import { WHITE, BLACK, getFiles, getRanks } from './helpers';

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
	overlayElement.style.fontFamily = 'sans-serif';
	overlayElement.style.fontSize = '12px';
	overlayElement.style.fontWeight = '500';
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

export function drawEvalBar(id, score, side, turn) {
	if (side !== turn) {
		score *= -1;
	}
	let height = (2 / (1 + Math.exp(-0.004 * score)) - 1 + 1) * 50;

	let element = document.getElementById(id);
	let evalBarElement = document.createElement('div');
	evalBarElement.id = `cv-evalbar`;
	evalBarElement.style.position = 'absolute';
	evalBarElement.style.height = element.style.height;
	evalBarElement.style.width = '12px';
	evalBarElement.style.left = '-14px';
	evalBarElement.style.backgroundColor = side === WHITE ? 'hsla(0, 0%, 0%, 0.5)' : 'hsla(0, 0%, 100%, 1.0)';

	let evalBarLevel = document.createElement('div');
	evalBarLevel.id = `cv-evalbar-level`;
	evalBarLevel.style.position = 'absolute';
	evalBarLevel.style.height = `${height}%`;
	evalBarLevel.style.width = '12px';
	evalBarLevel.style.bottom = '0';

	evalBarLevel.style.backgroundColor = side === WHITE ? 'white' : 'black';

	evalBarElement.appendChild(evalBarLevel);

	element.appendChild(evalBarElement);
}

export function drawTextBelow(id, uid, pos, text) {
	let element = document.getElementById(id);
	let existing = document.getElementById(uid);
	if (existing) {
		existing.remove();
	}
	let textElement = document.createElement('div');
	textElement.id = uid;
	textElement.style.position = 'absolute';
	textElement.style.height = element.style.height;
	textElement.style.top = `calc(${element.style.height} + 25px)`;
	textElement.style.left = pos;
	textElement.style.color = 'white';
	textElement.style.textShadow = '1px 1px 0px black';
	textElement.innerText = text;
	element.appendChild(textElement);
}
