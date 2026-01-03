export class InputState {
  // keys by code: "KeyW", "Space", etc.
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();

  public mouseX = 0;
  public mouseY = 0;
  public mouseDX = 0;
  public mouseDY = 0;
  public wheelDX = 0;
  public wheelDY = 0;

  public hasFocus = true;

  beginFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDX = 0;
    this.wheelDY = 0;
  }

  isDown(code: string) {
    return this.down.has(code);
  }
  wasPressed(code: string) {
    return this.pressed.has(code);
  }
  wasReleased(code: string) {
    return this.released.has(code);
  }

  _setKeyDown(code: string) {
    if (!this.down.has(code)) this.pressed.add(code);
    this.down.add(code);
  }

  _setKeyUp(code: string) {
    if (this.down.has(code)) this.released.add(code);
    this.down.delete(code);
  }
}
