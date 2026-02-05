export declare class Vector3 {
  constructor(x?: number, y?: number, z?: number);
  x: number;
  y: number;
  z: number;
}

export declare class Quaternion {
  constructor(x?: number, y?: number, z?: number, w?: number);
  x: number;
  y: number;
  z: number;
  w: number;
}

export declare class Color {
  constructor(hex?: number | string);
  getHex(): number;
  set(hex: number | string): this;
}
