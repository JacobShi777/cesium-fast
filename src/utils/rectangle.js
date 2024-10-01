import * as Cesium from 'cesium'

export const getPolylinePositionsByRectangleDiagonalPointCartesian = (startCartesian, endCartesian) => {
  const startCartographic = Cesium.Cartographic.fromCartesian(startCartesian)
  const endCartographic = Cesium.Cartographic.fromCartesian(endCartesian)
  const startLongitude = Cesium.Math.toDegrees(startCartographic.longitude)
  const startLatitude = Cesium.Math.toDegrees(startCartographic.latitude)
  const endLongitude = Cesium.Math.toDegrees(endCartographic.longitude)
  const endLatitude = Cesium.Math.toDegrees(endCartographic.latitude)
  return [
    Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude),
    Cesium.Cartesian3.fromDegrees(endLongitude, startLatitude),
    Cesium.Cartesian3.fromDegrees(endLongitude, endLatitude),
    Cesium.Cartesian3.fromDegrees(startLongitude, endLatitude),
    Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude),
  ]
}