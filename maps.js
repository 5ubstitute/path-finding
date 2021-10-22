"use strict";

Object.assign(CellMap.prototype, {
	length: 0,
	randomize: function(chance) {
		for (let i = 0; i < this.length; i ++) {
			this.states[i] = Math.random() + chance;
		}
	},
	reset: function() {
		for (let i = 0; i < this.length; i ++) {
			this.states[i] = 0;
		}
	},
	invert: function() {
		for (let i = 0; i < this.length; i ++) {
			this.states[i] = this.states[i] & 1 ^ 1;
		}
	},
	next: function(minNeighbours) {
		var map = new CellMap(this.width, this.height);
		for (let i = 0; i < this.length; i ++) {
			if (this.states[i] === 1 || this.neighbours(i % this.width, Math.floor(i / this.width)) >= minNeighbours) {
				map[i] = 1;
			}
		}
		
		for (let i = 0; i < this.length; i ++) {
			this.states[i] = map[i];
		}
	},
	neighbours: function(x, y) {
		var result = 0;
		for (let i = -1; i < 2; i ++) {
			for (let j = -1; j < 2; j ++) {
				if ((i !== 0 || j !== 0) && ![x + i, y + j].includes(-1) && x + i < this.width && y + j < this.height && this.stateAt(x + i, j + y) === 1) {
					result ++;
				}
			}
		}
		
		return result;
	},
	stateAt: function(x, y) {
		return this.states[this.width * y + x];
	}
});

function CellMap(width, height) {
	this.width = width;
	this.height = height;
	this.length = width * height;
	this.states = new Uint16Array(this.length);
}
