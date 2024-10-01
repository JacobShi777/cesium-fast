import * as Cesium from 'cesium'

export const getPolylinePositionsByRectangleDiagonalPoint = (startCartesian, endCartesian, type) => {
  let startLongitude, startLatitude, endLongitude, endLatitude
  if (type === 'Cartesian') {
    const startCartographic = Cesium.Cartographic.fromCartesian(startCartesian)
    const endCartographic = Cesium.Cartographic.fromCartesian(endCartesian)
    startLongitude = Cesium.Math.toDegrees(startCartographic.longitude)
    startLatitude = Cesium.Math.toDegrees(startCartographic.latitude)
    endLongitude = Cesium.Math.toDegrees(endCartographic.longitude)
    endLatitude = Cesium.Math.toDegrees(endCartographic.latitude)
  } else {
    startLongitude = startCartesian[0]
    startLatitude = startCartesian[1]
    endLongitude = endCartesian[0]
    endLatitude = endCartesian[1]
  }
  return [
    Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude),
    Cesium.Cartesian3.fromDegrees(endLongitude, startLatitude),
    Cesium.Cartesian3.fromDegrees(endLongitude, endLatitude),
    Cesium.Cartesian3.fromDegrees(startLongitude, endLatitude),
    Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude),
  ]
}