import * as Cesium from 'cesium'

import GraphicsType from './constants/graphics';

import Draw from './fast/Draw.js';

class CesiumFast {
  static Cesium = Cesium;
  static GraphicsType = GraphicsType

  viewer
  draw

  constructor(container, options, viewAtChina = true) {
    this._init(container, options, viewAtChina)
    this.draw = new Draw(this)
  }

  _init(container, options, viewAtChina) {
    const defaultOptions = {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      // homeButton: false,
      infoBox: false,
      // sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      // scene3DOnly: true,
      shouldAnimate: true,
      clockViewModel: new Cesium.ClockViewModel(new Cesium.Clock()),
    }
    options = Object.assign(defaultOptions, options)
    this.viewer = new Cesium.Viewer(container, options);
    
    this.viewer.cesiumWidget.creditContainer.style.display = 'none'
    viewAtChina && this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9042, 31000000),
    });
  }
}

export default CesiumFast;
