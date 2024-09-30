export default class Color {
  static RED = new Color('Red')
  static YELLOW = new Color('Yellow')
  static BLUE = new Color('Blue')
  static GREEN = new Color('Green')

  constructor(name) {
    this.name = name
  }
  toString() {
    return `Color.${this.name}`
  }
}
