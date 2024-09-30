import * as Cesium from 'cesium'

import FastGraphicsType from '../constants/graphics';
import FastColor from '../constants/color';

const toDegrees = Cesium.Math.toDegrees;

class FastDraw {
  #handler
  #state = {}
  #initState() {
    this.#state = {
      startCartesian: undefined,
      currentCartesian: undefined,
      entity: undefined,
      callback: undefined,
      cartesianStack: [],
      store: {},
    }
  }
  
  constructor(_this) {
    this.viewer = _this.viewer
  }

  /**
   * 绘制图形
   * @param { FastGraphicsType } fastGraphicsType 图形类型
   * @param { { layer: String, color: FastColor, properties: Object.<string, *> } } options 选项
   * @param { function({ entity: Entity, coordinates: Array }): void } callback 回调函数
   */
  drawEntity(fastGraphicsType, options, callback) {
    if (!(fastGraphicsType instanceof FastGraphicsType)) {
      throw new Error('fastGraphicsType must be an instance of FastGraphicsType')
    }
    if (typeof options === 'function') {
      callback = options
      options = undefined
    }

    this.#initState()
    this.#state.callback = callback
    if (fastGraphicsType === FastGraphicsType.POINT) {
      this.#drawPoint(options)

    } else if (fastGraphicsType === FastGraphicsType.RECTANGLE) {
      this.#drawRectangle(options)

    } else if (fastGraphicsType === FastGraphicsType.POLYGON) {
      this.#state.store['LEFT_DOUBLE_CLICK'] = this.viewer.cesiumWidget.screenSpaceEventHandler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      this.#drawPolygon(options)
    }
  }
  
  #drawPoint(options) {
    this.#handler && this.#handler.destroy()
    this.#handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.#handler.setInputAction((mouse) => {
      const ray = this.viewer.camera.getPickRay(mouse.position);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);

      if (!Cesium.defined(cartesian)) {
        return;
      }
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const longitude = toDegrees(cartographic.longitude);
      const latitude = toDegrees(cartographic.latitude);
      const entity = this.viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
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
          type: FastGraphicsType.POINT,
          layer: options.layer || 'default',
          userProperties: options.properties,
        }
      })
      this.#state.callback({
        entity,
        coordinates: [longitude, latitude]
      })
      this.#handler.destroy()
      this.#handler = undefined
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  #drawRectangle(options) {
    // 禁用旋转
    this.viewer.scene.screenSpaceCameraController.enableRotate = false

    this.#handler && this.#handler.destroy()
    this.#handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.#handler.setInputAction((mouse) => {
      const ray = this.viewer.camera.getPickRay(mouse.position);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);
      if (!Cesium.defined(cartesian)) {
        return;
      }
      if (!this.#state.startCartesian) {
        this.#state.startCartesian = cartesian
      } 
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

    this.#handler.setInputAction((mouse) => {
      if (!this.#state.startCartesian) {
        return
      }

      const ray = this.viewer.camera.getPickRay(mouse.endPosition);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);
      if (!Cesium.defined(cartesian)) {
        return;
      }
      this.#state.currentCartesian = cartesian

      if (!this.#state.entity) {
        this.#state.entity = this.viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(() => {
              return Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
            }, false),
            fill: false,
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 15,
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
            type: FastGraphicsType.RECTANGLE,
            layer: options.layer || 'default',
            userProperties: options.properties,
          }
        })
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#handler.setInputAction(() => {
      this.#state.entity.rectangle.coordinates = Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
      // 这种方法在球体中，在视觉上不是中间
      // this.#state.entity.position = Cesium.Cartesian3.midpoint(this.#state.startCartesian, this.#state.currentCartesian, new Cesium.Cartesian3())

      let cartographic = Cesium.Cartographic.fromCartesian(this.#state.startCartesian);
      const startCoordinate = [toDegrees(cartographic.longitude), toDegrees(cartographic.latitude)]
      cartographic = Cesium.Cartographic.fromCartesian(this.#state.currentCartesian);
      const endCoordinate = [toDegrees(cartographic.longitude), toDegrees(cartographic.latitude)]
      const coordinates = [
        startCoordinate,
        endCoordinate,
      ]

      this.#state.entity.position = Cesium.Cartesian3.midpoint(
        Cesium.Cartesian3.midpoint(
          Cesium.Cartesian3.fromDegrees(startCoordinate[0], startCoordinate[1]),
          Cesium.Cartesian3.fromDegrees(endCoordinate[0], startCoordinate[1]),
          new Cesium.Cartesian3(),
        ),
        Cesium.Cartesian3.midpoint(
          Cesium.Cartesian3.fromDegrees(startCoordinate[0], endCoordinate[1]),
          Cesium.Cartesian3.fromDegrees(endCoordinate[0], endCoordinate[1]),
          new Cesium.Cartesian3(),
        ),
        new Cesium.Cartesian3(),
      )

      this.#state.callback({
        entity: this.#state.entity,
        coordinates,
      })
      this.#handler.destroy()
      this.#handler = undefined
      this.#initState()
      this.viewer.scene.screenSpaceCameraController.enableRotate = true
    }, Cesium.ScreenSpaceEventType.LEFT_UP)
  }

  #drawPolygon(options) {
    this.#handler && this.#handler.destroy()
    this.#handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)

    this.#handler.setInputAction((mouse) => {
      const ray = this.viewer.camera.getPickRay(mouse.position);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);

      if (!Cesium.defined(cartesian)) {
        return;
      }
      this.#state.cartesianStack.push(cartesian)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.#handler.setInputAction((mouse) => {
      if (this.#state.cartesianStack.length === 0) {
        return
      }
      const ray = this.viewer.camera.getPickRay(mouse.endPosition);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);

      if (!Cesium.defined(cartesian)) {
        return;
      }
      this.#state.currentCartesian = cartesian

      if (this.#state.cartesianStack.length === 1) {
        if (!this.#state.entity) {
          this.#state.entity = this.viewer.entities.add({
            polyline: {
              positions: new Cesium.CallbackProperty(() => {
                return [...this.#state.cartesianStack, this.#state.currentCartesian]
              }, false),
              width: 1,
              material: Cesium.Color.YELLOW,
            }
          })
        }
      }

      if (this.#state.cartesianStack.length === 2 && this.#state.entity.polyline) {
        this.viewer.entities.remove(this.#state.entity)

        this.#state.entity = this.viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.CallbackProperty(() => {
              return new Cesium.PolygonHierarchy([...this.#state.cartesianStack, this.#state.currentCartesian])
            }, false),
            fill: false,
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 2,
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
            type: FastGraphicsType.POLYGON,
            layer: options.layer || 'default',
            userProperties: options.properties,
          }
        })
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#handler.setInputAction((mouse) => {
      this.#state.cartesianStack.pop()
      this.#state.cartesianStack.pop()

      if (this.#state.cartesianStack.length < 2) {
        const ray = this.viewer.camera.getPickRay(mouse.endPosition);
        const globe = this.viewer.scene.globe;
        const cartesian = globe.pick(ray, this.viewer.scene);

        if (!Cesium.defined(cartesian)) {
          return;
        }
        this.#state.cartesianStack.push(cartesian)

        return
      }
      this.#state.cartesianStack.push(this.#state.currentCartesian)
      this.#state.entity.polygon.hierarchy = new Cesium.PolygonHierarchy(this.#state.cartesianStack)
      this.#state.entity.position = Cesium.BoundingSphere.fromPoints(this.#state.cartesianStack).center

      const coordinates = this.#state.cartesianStack.map(cartesian => {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        return [toDegrees(cartographic.longitude), toDegrees(cartographic.latitude)]
      })

      this.#state.callback({
        entity: this.#state.entity,
        coordinates
      })
      this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(this.#state.store['LEFT_DOUBLE_CLICK'], Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      this.#handler.destroy()
      this.#handler = undefined
      this.#initState()
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  }

  /**
   * 删除实体
   * @param { Entity | Array.<Entity> } entities 可以是单个实体，也可以是实体数组
   * @returns 
   */
  removeEntities(entities) {
    if (!entities) {
      return
    }
    if (!Array.isArray(entities)) {
      entities = [entities]
    }
    entities.forEach(entity => {
      this.viewer.entities.remove(entity)
    })
  }

  /**
   * 删除指定图层的实体
   * @param { String } layer 图层名称
   */
  removeEntitiesByLayer(layer) {
    layer = layer || 'default'
    const entitiesToRemove = this.viewer.entities.values.filter(entity => 
      entity.properties.getValue().layer === layer
    );
    entitiesToRemove.forEach(entity => {
      this.viewer.entities.remove(entity);
    });
  }
}

export default FastDraw;
