import { WHITE, BLACK, getFiles, getRanks, range } from './helpers';

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

export function createOverlay(id, element, side, zIndex, addText, svg) {
	let overlay = document.getElementById(id);
	if (overlay) {
		overlay.remove();
	}

	let files = getFiles();
	let ranks = getRanks();

	const rect = element.getBoundingClientRect();
	const { width, height, top, left } = rect;

	let overlayElement = document.createElement('div');

	if (svg) {
		overlayElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		overlayElement.setAttribute('width', width);
		overlayElement.setAttribute('height', width);
	}

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

	return overlayElement;
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
	if (side != turn) {
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
	evalBarElement.style.backgroundColor = side === WHITE ? 'black' : 'white';

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
	textElement.style.top = `calc(${element.style.height} + 25px)`;
	textElement.style.left = pos;
	textElement.style.color = 'white';
	textElement.style.textShadow = '1px 1px 0px black';
	textElement.innerText = text;
	element.appendChild(textElement);
}

export function drawECO(element, id, text) {
	let existing = document.getElementById(id);
	if (existing) {
		existing.remove();
	}
	let textElement = document.createElement('div');
	textElement.id = id;
	textElement.style.position = 'absolute';
	textElement.style.top = '-40px';
	textElement.style.left = '45%';
	textElement.style.color = 'white';
	textElement.style.textShadow = '1px 1px 0px black';
	textElement.innerText = text;
	element.appendChild(textElement);
}

export function drawSlider(id, uid, value, min, max, pos) {
	let element = document.getElementById(id);
	let existing = document.getElementById(uid);
	if (existing) {
		existing.remove();
	}
	let inputElement = document.createElement('input');
	inputElement.id = uid;
	inputElement.style.position = 'absolute';
	inputElement.style.top = `calc(${element.style.height} + 45px)`;
	inputElement.style.left = pos;
	inputElement.style.width = '120px';
	inputElement.style.pointerEvents = 'all';
	inputElement.style.padding = '0px';
	inputElement.type = 'range';
	inputElement.min = min.toString();
	inputElement.max = max.toString();
	inputElement.value = value.toString();
	element.appendChild(inputElement);
}

export function drawArrow(overlay, move, turn, size, side) {
	const colors = {
		[BLACK]: 'hsla(350, 100%, 50%, 0.66)', // BLACK
		[WHITE]: 'hsla(145, 100%, 50%, 0.66)', // WHITE
	};

	const squareSize = size / 8;

	let marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
	marker.id = 'triangle' + turn;
	marker.setAttribute('viewBox', '0 0 20 20');
	marker.setAttribute('refX', '0');
	marker.setAttribute('refY', '5');
	marker.setAttribute('markerUnits', 'strokeWidth');
	marker.setAttribute('markerWidth', squareSize / 12);
	marker.setAttribute('markerHeight', squareSize / 12);
	marker.setAttribute('orient', 'auto');
	marker.setAttribute('fill', colors[turn]);

	let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', 'M 0 0 L 7.5 5 L 0 10 z');
	marker.appendChild(path);

	overlay.appendChild(marker);
	if (move.length > 4) {
		move = move.slice(0, 4);
	}
	let from = move.slice(0, 2);
	let to = move.slice(-2);

	let [x1, y1] = squareToPos(from, squareSize, side);
	let [x2, y2] = squareToPos(to, squareSize, side);

	const xDist = x2 - x1;
	const yDist = y2 - y1;
	const dist = Math.sqrt(xDist * xDist + yDist * yDist);
	const newDist = dist - squareSize * (2 / 5);
	const scale = newDist / dist;

	x2 = x1 + xDist * scale;
	y2 = y1 + yDist * scale;

	let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	line.setAttribute('x1', x1);
	line.setAttribute('y1', y1);
	line.setAttribute('x2', x2);
	line.setAttribute('y2', y2);
	line.setAttribute('marker-end', `url(#triangle${turn})`);
	line.setAttribute('stroke', colors[turn]);
	line.setAttribute('stroke-width', squareSize / 6);
	overlay.appendChild(line);
}

function squareToPos(square, squareSize, side) {
	const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const ranks = range(1, 8);

	side == WHITE ? ranks.reverse() : files.reverse();

	let [file, rank] = square.split('');
	rank = parseInt(rank);

	const x = files.indexOf(file);
	const y = ranks.indexOf(rank);

	return [squareSize * x + squareSize / 2, squareSize * y + squareSize / 2];
}
