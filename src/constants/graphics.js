export default class GraphicsType {
  static POINT = new GraphicsType('Point')
  static RECTANGLE = new GraphicsType('Rectangle')
  static POLYGON = new GraphicsType('Polygon')

  constructor(name) {
    this.name = name
  }
  toString() {
    return `GraphicsType.${this.name}`
  }
}
