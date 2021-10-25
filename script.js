"use strict";

const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2");

gl.clearColor(0.5, 0.5, 0.5, 1);

const program = createProgram([`#version 300 es
in vec2 a_position;
in float a_state;
in float u;

uniform float u_width;
uniform float u_height;

uniform float u_states;

uniform float u_total_width;
uniform float u_total_height;

const vec4 air = vec4(1, 1, 1, 1);
const vec4 wall = vec4(0, 0, 0, 1);
const vec4 back = vec4(0, 0, 1, 1);
const vec4 mix1 = vec4(1, 0, 0, 1);
const vec4 mix2 = vec4(1, 0.5, 0, 1);

const float margin = 0.0;

out vec4 v_color;

void main()
{
	gl_Position = vec4(2.0 * (a_position.x + float(gl_VertexID & 1)) / u_width - 2.0 * margin / u_total_width * float(gl_VertexID & 1) + margin / u_total_width - 1.0, 1.0 - 2.0 * (a_position.y + float(gl_VertexID / 2)) / u_height + 2.0 * margin / u_total_width * float(gl_VertexID / 2) - margin / u_total_height, u, 1);
	if (a_state == 0.0) {
		v_color = air;
	}
	else if (a_state == 1.0) {
		v_color = wall;
	}
	else if (a_state == 2.0) {
		v_color = back;
	} else {
		v_color = mix(mix1, mix2, (a_state - 2.0) / (u_states - 2.0));
	}
}
`, `#version 300 es
precision highp float;

in vec4 v_color;

out vec4 color;

void main()
{
	color = v_color;
}
`]);

var map = new CellMap(Math.round(144 * screen.width / screen.height), 144);
var savedPosition;
var savedState;

gl.uniform1f(gl.getUniformLocation(program, "u_width"), map.width);
gl.uniform1f(gl.getUniformLocation(program, "u_height"), map.height);

const locations = {
	position: 0,
	state: 1,
	width: gl.getUniformLocation(program, "u_total_width"),
	height: gl.getUniformLocation(program, "u_total_height"),
	states: gl.getUniformLocation(program, "u_states")
};

gl.uniform1f(locations.width, canvas.clientWidth);
gl.uniform1f(locations.height, canvas.clientHeight);

const buffers = {
	position: gl.createBuffer(),
	state: gl.createBuffer()
};

{
	const positions = new Uint16Array(map.length << 1);
	let i = 0;
	for (let y = 0; y < map.height; y ++) {
		for (let x = 0; x < map.width; x ++) {
			positions[i ++] = x;
			positions[i ++] = y;
		}
	}
	
	gl.enableVertexAttribArray(locations.position);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	gl.vertexAttribPointer(locations.position, 2, gl.UNSIGNED_SHORT, false, 0, 0);
	gl.vertexAttribDivisor(locations.position, 1);

	gl.enableVertexAttribArray(locations.state);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.state);
	gl.vertexAttribPointer(locations.state, 1, gl.UNSIGNED_SHORT, false, 0, 0);
	gl.vertexAttribDivisor(locations.state, 1);

	gl.enableVertexAttribArray(2);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, 4, gl.STATIC_DRAW);
	gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

window.addEventListener("DOMContentLoaded", function() {
	document.body.appendChild(canvas);
	draw();
}, {once: true});

window.addEventListener("pagehide", function() {
	for (let i = 0; i < 3; i ++) {
		gl.vertexAttribPointer(i, 1, gl.FLOAT, false, 0, 0);
		gl.disableVertexAttribArray(i);
	}

	gl.deleteProgram(program);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	canvas.width = 0;
	canvas.height = 0;
});

window.addEventListener("keydown", function(event) {
	switch (event.key.toLowerCase()) {
		case "e":
			map.reset();
			draw();
			break;
		case "i":
			map.invert();
			draw();
			break;
		case "n":
			map.next(5);
			draw();
			break;
		case "r":
			map.randomize(0.4);
			draw();
	}
});

window.addEventListener("contextmenu", function(event) {
	event.preventDefault();
});

canvas.addEventListener("mousedown", function(event) {
	var position = map.width * Math.floor(event.y / window.innerHeight * map.height) + Math.floor(event.x / window.innerWidth * map.width);
	switch (event.which) {
		case 1:
			if (map.states[position] < 2) {
				savedState = map.states[position] = map.states[position] ^ 1;
				draw();
			}
			else {
				savedState = undefined;
			}
			break;
		case 3:
			if (map.states[position] === 0) {
				const iterator = findPath([position % map.width, Math.floor(position / map.width)], 2);
				let data;

				const interval = setInterval(function() {
					data = iterator.next();
					draw();

					if (data.done) {
						clearInterval(interval);
					}
				}, 200);
			}
			else if (map.states[position] > 2) {
				const iterator = traceBack(position, 0);
				let data;
				
				const interval = setInterval(function() {
					data = iterator.next();
					draw();
					
					if (data.done) {
						clearInterval(interval);
					}
				}, 200);
			}
	}
});

canvas.addEventListener("mousemove", function(event) {
	if (event.buttons === 1) {
		var position = map.width * Math.floor(event.y / window.innerHeight * map.height) + Math.floor(event.x / window.innerWidth * map.width);
			if (position !== savedPosition && map.states[position] === savedState ^ 1) {
				if (savedState !== undefined) {
					map.states[position] = savedState;
					draw();
				}
				savedPosition = position;
			}
	}
});

function* findPath(positions, state) {
	var possible = [];

	for (let i = 0; i < positions.length; i += 2) {
		const position = positions.slice(i, i + 2);
		map.states[map.width * position[1] + position[0]] = state;

		[-1, 1].forEach(function(stride) {
			for (let i = 0; i < 2; i ++) {
				let uneven = i & 1;
				let even = uneven ^ 1;

				let x = position[0] + uneven * stride;
				let y = position[1] + even * stride;

				if (without(possible, x, y) && 0 <= x && x < map.width && 0 <= y && y < map.height && map.states[map.width * y + x] === 0) {
					possible.push(x, y);
				}
			}
		});
	}

	if (possible.length !== 0) {
		yield;
		return yield* findPath(possible, state + 1);
	}

	function without(array, x, y) {
		for (let i = 0; i < array.length; i += 2) {
			if (array[i] === x && array[i + 1] === y) {
				return false;
			}
		}
		
		return true;
	}
}

function* traceBack(position, direction) {
	var state = map.states[position];
	var x = position % map.width;
	var y = Math.floor(position / map.width);

	map.states[position] = 2;
	yield state;

	for (let i = 0; i < 4; i ++) {
		let next = position + map.width * (direction & 1 ^ 1) * (direction - 1) + (direction & 1) * (direction - 2);
			
		if (((direction & 1) === 0 && ![-1, map.height].includes(y + direction - 1) || (direction & 1) === 1 && ![-1, map.width].includes(x + direction - 2))) {
			if (i !== 2 || map.states[next] > 2) {
				if (map.states[next] === 2) {
					break;
				}
				if (state === map.states[next] + 1) {
					return yield* traceBack(next, direction);
				}
			}
		}

		direction = (direction + 1) % 4;
	}
}

function draw() {	
	gl.clear(gl.COLOR_BUFFER_BIT);

	if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
		
		gl.uniform1f(locations.width, canvas.clientWidth);
		gl.uniform1f(locations.height, canvas.clientHeight);
	}
	
	gl.uniform1f(locations.states, Math.max.apply(Math, Array.from(map.states)));

	gl.bindBuffer(gl.ARRAY_BUFFER, buffers.state);
	gl.bufferData(gl.ARRAY_BUFFER, map.states, gl.DYNAMIC_DRAW);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, map.length);
}

function createProgram(shaders) {
	const program = gl.createProgram();
	
	shaders = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map(function(type, i) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, shaders[i]);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
		
		return shader;
	});
	
	gl.linkProgram(program);
	
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.warn(gl.getProgramInfoLog(program));
		shaders.forEach(function(shader) {
			console.warn(gl.getShaderInfoLog(shader));
			gl.detachShader(program, shader);
			gl.deleteShader(shader);
		});
		
		return null;
	}
	
	gl.useProgram(program);
	
	shaders.forEach(function(shader) {
		gl.detachShader(program, shader);
		gl.deleteShader(shader);
	});
	
	return program;
}
