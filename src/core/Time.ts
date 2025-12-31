export class Time {
  public deltaTime = 0;
  public tickRate = 1.0 / 60.0;
  // the time accumulator used for smooth frame rate
  public accumulator = 0;

  private startTime = 0;
  private prevTime = 0;

  constructor() {
    this.startTime = performance.now();
    this.prevTime = this.startTime;
  }

  public update() {
    const currentTime = performance.now();
    this.deltaTime = (currentTime - this.prevTime) * 0.001; // ms to seconds
    this.prevTime = currentTime;

    this.accumulator += this.deltaTime;
  }
}
