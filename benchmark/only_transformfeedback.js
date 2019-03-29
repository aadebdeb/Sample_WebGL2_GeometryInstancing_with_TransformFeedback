(function() {

  function createShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) + source);
    }
    return shader;
  }

  function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, vertexShaderSource, gl.VERTEX_SHADER));
    gl.attachShader(program, createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  function createTransformFeedbackProgram(gl, vertexShaderSource, fragmentShaderSource, varyings) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, vertexShaderSource, gl.VERTEX_SHADER));
    gl.attachShader(program, createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER));
    gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
  }

  function createVbo(gl, array, usage) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, array, usage !== undefined ? usage : gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vbo;
  }

  function createIbo(gl, array) {
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return ibo;
  }

  function getUniformLocations(gl, program, keys) {
    const locations = {};
    keys.forEach(key => {
        locations[key] = gl.getUniformLocation(program, key);
    });
    return locations;
  }

  function addVertex3(vertices, vi, x, y, z) {
    vertices[vi++] = x;
    vertices[vi++] = y;
    vertices[vi++] = z;
    return vi;
  };

  function addTriangle(indices, i, v0, v1, v2) {
    indices[i++] = v0;
    indices[i++] = v1;
    indices[i++] = v2;
    return i;
  };

  function addQuad(indices, i, v00, v10, v01, v11) {
    indices[i] = v00;
    indices[i + 1] = indices[i + 5] = v10;
    indices[i + 2] = indices[i + 4] = v01;
    indices[i + 3] = v11;
    return i + 6;
  };

  function createSphere(radius, thetaSegment, phiSegment) {
    const vertexNum = 2 + (thetaSegment - 1) * phiSegment;
    const indexNum = phiSegment * 6 + (thetaSegment - 2) * phiSegment * 6;
    const indices = new Int16Array(indexNum);
    const positions = new Float32Array(3 * vertexNum);
    const normals = new Float32Array(3 * vertexNum);

    const thetaStep = Math.PI / thetaSegment;
    const phiStep = 2.0 * Math.PI / phiSegment;

    // setup positions & normals
    let posCount = 0;
    let normalCount = 0;
    posCount = addVertex3(positions, posCount, 0, -radius, 0);
    normalCount = addVertex3(normals, normalCount, 0, -1, 0);
    for (let hi = 1; hi < thetaSegment; hi++) {
      const theta = Math.PI - hi * thetaStep;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let pi = 0; pi < phiSegment; pi++) {
        const phi = pi * phiStep;
        const sinP = Math.sin(-phi);
        const cosP = Math.cos(-phi);
        const p = new Vector3(
          radius * sinT * cosP,
          radius * cosT,
          radius * sinT * sinP
        );
        posCount = addVertex3(positions, posCount, p.x, p.y, p.z);
        const np = Vector3.norm(p);
        normalCount = addVertex3(normals, normalCount, np.x, np.y, np.z);
      }
    }
    posCount = addVertex3(positions, posCount, 0, radius, 0);
    normalCount = addVertex3(normals, normalCount, 0, 1, 0);

    // setup indices
    let indexCount = 0;
    for (let pi = 0; pi < phiSegment; pi++) {
      indexCount = addTriangle(indices, indexCount, 0, pi !== phiSegment - 1 ? pi + 2 : 1, pi + 1);
    }
    for (let hi = 0; hi < thetaSegment - 2; hi++) {
      const hj = hi + 1;
      for (let pi = 0; pi < phiSegment; pi++) {
        const pj = pi !== phiSegment - 1 ? pi + 1 : 0;
        indexCount = addQuad(indices, indexCount, 
          pi + hi * phiSegment + 1,
          pj + hi * phiSegment + 1,
          pi + hj * phiSegment + 1,
          pj + hj * phiSegment + 1
        );
      }
    }
    for (let pi = 0; pi < phiSegment; pi++) {
      indexCount = addTriangle(indices, indexCount,
        vertexNum - 1,
        pi + (thetaSegment - 2) * phiSegment + 1,
        (pi !== phiSegment - 1 ? pi + 1 : 0) + (thetaSegment - 2) * phiSegment + 1
      );
    }

    return {
      indices: indices,
      positions: positions,
      normals: normals,
    };
  }

  function hsvToRgb(h, s, v) {
    h = h / 60;
    const c = v * s;
    const x = c * (1.0 - Math.abs(h % 2 - 1));
    let r, g, b;
    if (h < 1.0) {
      [r, g, b] = [c, x, 0];
    } else if (h < 2.0) {
      [r, g, b] = [x, c, 0];
    } else if (h < 3.0) {
      [r, g, b] = [0, c, x];
    } else if (h < 4.0) {
      [r, g, b] = [0, x, c];
    } else if (h < 5.0) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }
    const m = v - c;
    [r, g, b] = [r + m, g + m, b + m];
    return [r, g, b];
  }

  const RENDER_VERTEX_SHADER_SOURCE =
`#version 300 es

layout (location = 0) in vec3 position;
layout (location = 1) in vec3 normal;

out vec3 v_normal;

uniform mat4 u_mvpMatrix;
uniform vec3 u_center;

void main(void) {
  v_normal = (u_mvpMatrix * vec4(normal, 0.0)).xyz;
  vec3 pos = position + u_center * 500.0;
  gl_Position = u_mvpMatrix * vec4(pos, 1.0);
}
`;

  const RENDER_FRAGMENT_SHADER_SOURCE =
`#version 300 es

precision highp float;

in vec3 v_normal;

out vec4 o_color;

uniform vec3 u_color;

vec3 LightDir = normalize(vec3(1.0, 1.0, -1.0));

void main(void) {
  vec3 normal = normalize(v_normal);
  float dotNL = dot(normal, LightDir);
  o_color = vec4(u_color * max(0.0, smoothstep(-1.0, 1.0, dotNL)), 1.0);
}
`

  const UPDATE_VERTEX_SHADER_SOURCE =
`#version 300 es

layout (location = 0) in vec3 i_position;
layout (location = 1) in vec3 i_velocity;

out vec3 o_position;
out vec3 o_velocity;

uniform float u_deltaTime;

vec3 GRAVITY_FORCE = vec3(0.0, -9.8, 0.0);
float MASS = 10.0;

void main(void) {
  vec3 velocity = i_velocity;
  vec3 position = i_position;

  velocity += u_deltaTime * GRAVITY_FORCE / MASS;
  position += u_deltaTime * velocity;

  if (position.x <= -1.0 || position.x >= 1.0) {
    velocity.x *= -1.0;
    position.x += u_deltaTime * velocity.x;
  }
  if (position.y <= -1.0 || position.y >= 1.0) {
    velocity.y *= -1.0;
    position.y += u_deltaTime * velocity.y;
  }
  if (position.z <= -1.0 || position.z >= 1.0) {
    velocity.z *= -1.0;
    position.z += u_deltaTime * velocity.z;
  }

  o_position = position;
  o_velocity = velocity;
}
`

  const UPDATE_FRAGMENT_SHADER_SOURCE =
`#version 300 es

precision highp float;

out vec4 o_color;

void main(void) {
  o_color = vec4(1.0);
}
`

  const canvas = document.getElementById('canvas');
  const resizeCanvas = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  const gl = canvas.getContext('webgl2');
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  const gui = new dat.GUI();
  const data = {
    num: 30000,
    sphere: {
      radius: 5.0,
      thetaSegment: 16,
      phiSegment: 16
    },
    camera: {
      angle: -45.0,
      distance: 1000.0,
      height: 1000.0
    },
    reset: () => {reset()},
  };
  gui.add(data, 'num', 100, 100000).step(1);
  const guiSphere = gui.addFolder('sphere');
  guiSphere.add(data.sphere, 'radius', 1.0, 20.0);
  guiSphere.add(data.sphere, 'thetaSegment', 4, 64).step(1);
  guiSphere.add(data.sphere, 'phiSegment', 4, 64).step(1);
  const guiCamera = gui.addFolder('camera');
  guiCamera.add(data.camera, 'angle', -180, 180);
  guiCamera.add(data.camera, 'distance', 50.0, 3000.0);
  guiCamera.add(data.camera, 'height', -3000.0, 3000.0);
  gui.add(data, 'reset');

  const renderProgram = createProgram(gl, RENDER_VERTEX_SHADER_SOURCE, RENDER_FRAGMENT_SHADER_SOURCE);
  const renderUniforms = getUniformLocations(gl, renderProgram, ['u_mvpMatrix', 'u_center', 'u_color']);

  let sphere, sphereNum, vao;
  let positions, velocities, positionVboR, velocityVboR, positionVboW, velocityVboW, colors;
  const reset = function() {
    sphere = createSphere(data.sphere.radius, data.sphere.thetaSegment, data.sphere.phiSegment);
    const sphereIbo = createIbo(gl, sphere.indices);
    const vertexPositionVbo = createVbo(gl, sphere.positions);
    const vertexNormalVbo = createVbo(gl, sphere.normals);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIbo);
    [vertexPositionVbo, vertexNormalVbo].forEach((vbo, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);

    sphereNum = data.num;
    positions = new Float32Array(Array.from({length: sphereNum * 3}, () => {
      return (2.0 * Math.random() - 1.0);
    }));
    velocities = new Float32Array(sphereNum * 3);
    for (let i = 0; i < sphereNum; i++) {
      velocities[3 * i] = (2.0 * Math.random() - 1.0) * 0.5;
      velocities[3 * i + 1] = 0.0;
      velocities[3 * i + 2] = (2.0 * Math.random() - 1.0) * 0.5;
    }
    colors = new Float32Array(sphereNum * 3);
    for (let i = 0; i < sphereNum; i++) {
      const rgb = hsvToRgb(Math.floor(Math.random() * 360.99), 1, 1);
      colors[3 * i] = rgb[0];
      colors[3 * i + 1] = rgb[1];
      colors[3 * i + 2] = rgb[2];
    }
    positionVboR = createVbo(gl, positions, gl.DYNAMIC_COPY);
    velocityVboR = createVbo(gl, velocities, gl.DYNAMIC_COPY);
    positionVboW = createVbo(gl, new Float32Array(sphereNum * 3), gl.DYNAMIC_COPY);
    velocityVboW = createVbo(gl, new Float32Array(sphereNum * 3), gl.DYNAMIC_COPY);
  }
  reset();

  const swapParticleVbos = function() {
    const tmpP = positionVboR;
    const tmpV = velocityVboR;
    positionVboR = positionVboW;
    velocityVboR = velocityVboW;
    positionVboW = tmpP;
    velocityVboW = tmpV;
  }

  const updateProgram = createTransformFeedbackProgram(gl, 
    UPDATE_VERTEX_SHADER_SOURCE, UPDATE_FRAGMENT_SHADER_SOURCE, ['o_position', 'o_velocity']);
  const updateUniforms = getUniformLocations(gl, updateProgram, ['u_deltaTime']);
  const transformFeedback = gl.createTransformFeedback();

  gl.clearColor(0.3, 0.3, 0.3, 1.0);
  gl.clearDepth(1.0);
  let previousTIme = performance.now();
  const render = function() {
    stats.update();

    const currentTime = performance.now();
    const elapsedTime = Math.min(0.1, (currentTime - previousTIme) * 0.001);
    previousTIme = currentTime;

    const cameraRadian = Math.PI * data.camera.angle / 180.0;
    const viewMatrix = Matrix4.inverse(Matrix4.lookAt(
      new Vector3(data.camera.distance * Math.cos(cameraRadian), data.camera.height, data.camera.distance * Math.sin(cameraRadian)),
      Vector3.zero, new Vector3(0.0, 1.0, 0.0)
    ));
    const projectionMatrix = Matrix4.perspective(canvas.width / canvas.height, 60, 0.01, 10000.0);
    const mvpMatrix = Matrix4.mul(viewMatrix, projectionMatrix);

    // update particles
    gl.useProgram(updateProgram);
    gl.uniform1f(updateUniforms['u_deltaTime'], elapsedTime);
    [positionVboR, velocityVboR].forEach((vbo, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 0, 0);
    });
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, positionVboW);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, velocityVboW);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, sphereNum);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    swapParticleVbos();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionVboR);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, positions);

    // render to screen
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0.0, 0.0, canvas.width, canvas.height);
    gl.useProgram(renderProgram);
    gl.uniformMatrix4fv(renderUniforms['u_mvpMatrix'], false, mvpMatrix.elements);
    gl.bindVertexArray(vao);
    for (let i = 0; i < sphereNum; i++) {
      gl.uniform3f(renderUniforms['u_color'], colors[3 * i], colors[3 * i + 1], colors[3 * i + 2]);
      gl.uniform3f(renderUniforms['u_center'], positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]);
      gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  };
  render();

}());
