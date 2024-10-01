import * as Cesium from 'cesium'
import GraphicsType from '../constants/graphics';

class EntityBuilder {

  static point(position, options) {
    return {
      position,
      point: {
        pixelSize: 9,
        color: options.color || Cesium.Color.YELLOW,
        outlineColor: options.outlineColor || Cesium.Color.BLUE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: "",
        font: "11pt sans-serif",
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        verticalOrigin: Cesium.VerticalOrigin.BASELINE,
        fillColor: Cesium.Color.GHOSTWHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.DARKSLATEGREY.withAlpha(0.8),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        type: GraphicsType.POINT,
        layer: options.layer || 'default',
        options,
        userProperties: options.properties,
      }
    }
  }

  static rectangle(rectangleCoordinates, polylinePositions, options) {
    let material = Cesium.Color.YELLOW.withAlpha(0.2)
    if (options.fill && options.color) {
      material = options.color
    }
    return {
      rectangle: {
        coordinates: rectangleCoordinates,
        fill: options.fill || false,
        material,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      polyline: {
        positions: polylinePositions,
        width: 2,
        material: options.outlineColor || Cesium.Color.LAWNGREEN,
        arcType: Cesium.ArcType.RHUMB,
      },
      label: {
        text: "",
        font: "11pt sans-serif",
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        fillColor: Cesium.Color.GHOSTWHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.DARKSLATEGREY.withAlpha(0.8),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        type: GraphicsType.RECTANGLE,
        layer: options.layer || 'default',
        options,
        userProperties: options.properties,
      }
    }
  }

  static polygon(polygonHierarchy, polylinePositions, options) {
    let material = Cesium.Color.YELLOW.withAlpha(0.2)
    if (options.fill && options.color) {
      material = options.color
    }
    return {
      polygon: {
        hierarchy: polygonHierarchy,
        fill: options.fill || false,
        material,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      polyline: {
        positions: polylinePositions,
        width: 2,
        material: options.outlineColor || Cesium.Color.LAWNGREEN,
      },
      label: {
        text: "",
        font: "11pt sans-serif",
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        fillColor: Cesium.Color.GHOSTWHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.DARKSLATEGREY.withAlpha(0.8),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: {
        type: GraphicsType.POLYGON,
        layer: options.layer || 'default',
        options,
        userProperties: options.properties,
      }
    }
  }
}

export default EntityBuilder
