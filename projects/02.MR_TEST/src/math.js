const EPSILON = 0.000001;

export function v3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecScale(a, scalar) {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

export function vecScaleAndAdd(a, b, scalar) {
  return [a[0] + b[0] * scalar, a[1] + b[1] * scalar, a[2] + b[2] * scalar];
}

export function vecCopy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

export function vecLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vecDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function vecNormalize(a) {
  const length = vecLength(a);
  if (length < EPSILON) {
    return [0, 0, -1];
  }
  return [a[0] / length, a[1] / length, a[2] / length];
}

export function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function vecLerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

export function flattenForward(forward) {
  const flat = [forward[0], 0, forward[2]];
  return vecNormalize(flat);
}

export function quatIdentity() {
  return [0, 0, 0, 1];
}

export function quatNormalize(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (length < EPSILON) {
    return quatIdentity();
  }
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

export function quatSlerp(a, b, t) {
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  let cosine = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;

  if (cosine < 0) {
    cosine = -cosine;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (cosine > 0.9995) {
    return quatNormalize([
      a[0] + t * (bx - a[0]),
      a[1] + t * (by - a[1]),
      a[2] + t * (bz - a[2]),
      a[3] + t * (bw - a[3])
    ]);
  }

  const theta = Math.acos(cosine);
  const sinTheta = Math.sin(theta);
  const scaleA = Math.sin((1 - t) * theta) / sinTheta;
  const scaleB = Math.sin(t * theta) / sinTheta;

  return [
    a[0] * scaleA + bx * scaleB,
    a[1] * scaleA + by * scaleB,
    a[2] * scaleA + bz * scaleB,
    a[3] * scaleA + bw * scaleB
  ];
}

export function quatFromBasis(right, up, forward) {
  const m00 = right[0];
  const m01 = up[0];
  const m02 = forward[0];
  const m10 = right[1];
  const m11 = up[1];
  const m12 = forward[1];
  const m20 = right[2];
  const m21 = up[2];
  const m22 = forward[2];
  const trace = m00 + m11 + m22;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return quatNormalize([
      (m21 - m12) / s,
      (m02 - m20) / s,
      (m10 - m01) / s,
      0.25 * s
    ]);
  }

  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return quatNormalize([
      0.25 * s,
      (m01 + m10) / s,
      (m02 + m20) / s,
      (m21 - m12) / s
    ]);
  }

  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return quatNormalize([
      (m01 + m10) / s,
      0.25 * s,
      (m12 + m21) / s,
      (m02 - m20) / s
    ]);
  }

  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return quatNormalize([
    (m02 + m20) / s,
    (m12 + m21) / s,
    0.25 * s,
    (m10 - m01) / s
  ]);
}

export function quatLookAt(position, target) {
  const forward = vecNormalize(vecSub(target, position));
  let right = vecCross([0, 1, 0], forward);
  if (vecLength(right) < EPSILON) {
    right = [1, 0, 0];
  } else {
    right = vecNormalize(right);
  }
  const up = vecNormalize(vecCross(forward, right));
  return quatFromBasis(right, up, forward);
}

export function mat4Identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

export function mat4FromRotationTranslationScale(q, position, scale) {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];

  return new Float32Array([
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    position[0],
    position[1],
    position[2],
    1
  ]);
}

export function mat4FromBillboard(position, cameraPosition, scale) {
  const forward = vecNormalize(vecSub(cameraPosition, position));
  let right = vecCross([0, 1, 0], forward);
  if (vecLength(right) < EPSILON) {
    right = [1, 0, 0];
  } else {
    right = vecNormalize(right);
  }
  const up = vecNormalize(vecCross(forward, right));

  return new Float32Array([
    right[0] * scale[0],
    right[1] * scale[0],
    right[2] * scale[0],
    0,
    up[0] * scale[1],
    up[1] * scale[1],
    up[2] * scale[1],
    0,
    forward[0] * scale[2],
    forward[1] * scale[2],
    forward[2] * scale[2],
    0,
    position[0],
    position[1],
    position[2],
    1
  ]);
}

export function mat4Perspective(fovDegrees, aspect, near, far) {
  const fov = fovDegrees * Math.PI / 180;
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

export function mat4LookAt(eye, center, up = [0, 1, 0]) {
  const zAxis = vecNormalize(vecSub(eye, center));
  const xAxis = vecNormalize(vecCross(up, zAxis));
  const yAxis = vecCross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -vecDot(xAxis, eye), -vecDot(yAxis, eye), -vecDot(zAxis, eye), 1
  ]);
}

export function extractPosition(matrix) {
  return [matrix[12], matrix[13], matrix[14]];
}

export function extractForward(matrix) {
  return vecNormalize([-matrix[8], -matrix[9], -matrix[10]]);
}

export function horizontalRightFromForward(forward) {
  return vecNormalize(vecCross(forward, [0, 1, 0]));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
