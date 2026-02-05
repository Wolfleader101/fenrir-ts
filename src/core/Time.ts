export class Time {
  public deltaTime = 0;
  public tickRate = 1.0 / 60.0;
  // the time accumulator used for smooth frame rate
  public accumulator = 0;

  private startTime = 0;
  private prevTime = 0;
  private paused = false;
  private pauseStartTime = 0;
  private totalPausedTime = 0;

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

  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseStartTime = performance.now();
  }

  public resume(): void {
    if (!this.paused) return;
    this.paused = false;

    // Calculate how long we were paused and add it to total paused time
    const pauseDuration = performance.now() - this.pauseStartTime;
    this.totalPausedTime += pauseDuration;

    // Reset prevTime to current time to prevent large delta on next update
    this.prevTime = performance.now();
  }

  public reset(): void {
    this.deltaTime = 0;
    this.accumulator = 0;
    this.startTime = performance.now();
    this.prevTime = this.startTime;
    this.paused = false;
    this.pauseStartTime = 0;
    this.totalPausedTime = 0;
  }

  public get delta(): number {
    return this.deltaTime;
  }

  public get elapsed(): number {
    const currentTime = this.paused ? this.pauseStartTime : performance.now();
    return (currentTime - this.startTime - this.totalPausedTime) * 0.001;
  }
}
