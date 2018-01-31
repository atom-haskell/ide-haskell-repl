export class CommandHistory {
  private back: string[]
  private current: number
  private temp: string
  constructor(history: string[] = []) {
    this.back = history
    this.current = -1
    this.temp = ''
  }

  public goBack(current: string): string {
    if (this.current === -1) {
      this.temp = current
    }
    this.current += 1
    if (this.current >= this.back.length) {
      this.current = this.back.length - 1
    }
    if (this.current < 0) {
      this.current = -1
      return this.temp
    }
    return this.back[this.current]
  }

  public peek(shift: number): string | undefined {
    return this.back[this.current - shift]
  }

  public goForward(): string {
    if (this.current <= 0) {
      this.current = -1
      return this.temp
    }
    this.current -= 1
    return this.back[this.current]
  }

  public save(current: string): void {
    this.current = -1
    this.back.unshift(current)
  }

  public serialize(): string[] {
    return this.back
  }
}
