import * as Cesium from 'cesium'

import FastGraphicsType from '../constants/graphics';
import * as rectangleUtils from '../utils/rectangle'
import EventHandler from './EventHandler'

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

  eventHandler = new EventHandler(['DRAW_ENTITY', 'LEFT_CLICK_ENTITY'])
  
  constructor(_this) {
    this.viewer = _this.viewer
  }

  /**
   * 绘制图形
   * @param { FastGraphicsType } fastGraphicsType 图形类型
   * @param { { layer: string, outlineColor: Color, fill: boolean, color: Color, properties: Object.<string, *> } } options 选项
   * @param { function({ entity: Entity, coordinates: Array }): void } callback 回调函数
   */
  drawEntity(fastGraphicsType, options) {
    if (!(fastGraphicsType instanceof FastGraphicsType)) {
      throw new Error('fastGraphicsType must be an instance of FastGraphicsType')
    }
    if (options) {
      if (!(options instanceof Object)) throw new Error('options must be an instance of Object')
      if (options.layer && typeof options.layer !== 'string') throw new Error('options.layer must be an instance of String')
      if (options.outlineColor && !(options.outlineColor instanceof Cesium.Color)) throw new Error('options.outlineColor must be an instance of Cesium.Color')
      if (options.fill && typeof options.fill !== 'boolean') throw new Error('options.fill must be an instance of Boolean')
      if (options.color && !(options.color instanceof Cesium.Color)) throw new Error('options.color must be an instance of Cesium.Color')
      if (options.properties && !(options.properties instanceof Object)) throw new Error('options.properties must be an instance of Object')
    }

    this.#initState()
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
          type: FastGraphicsType.POINT,
          layer: options.layer || 'default',
          userProperties: options.properties,
        }
      })
      this.eventHandler.trigger('DRAW_ENTITY', {
        entity,
        type: FastGraphicsType.POINT,
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
        let material = Cesium.Color.YELLOW.withAlpha(0.2)
        if (options.fill && options.color) {
          material = options.color
        }
        this.#state.entity = this.viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(() => {
              return Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
            }, false),
            fill: options.fill || false,
            material,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              return rectangleUtils.getPolylinePositionsByRectangleDiagonalPointCartesian(this.#state.startCartesian, this.#state.currentCartesian)
            }, false),
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
            type: FastGraphicsType.RECTANGLE,
            layer: options.layer || 'default',
            userProperties: options.properties,
          }
        })
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#handler.setInputAction(() => {
      this.#state.entity.rectangle.coordinates = Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
      this.#state.entity.polyline.positions = rectangleUtils.getPolylinePositionsByRectangleDiagonalPointCartesian(this.#state.startCartesian, this.#state.currentCartesian)
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

      this.eventHandler.trigger('DRAW_ENTITY', {
        entity: this.#state.entity,
        type: FastGraphicsType.RECTANGLE,
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
              width: 2,
              material: options.outlineColor || Cesium.Color.LAWNGREEN,
            }
          })
        }
      }

      if (this.#state.cartesianStack.length === 2 && this.#state.entity.polyline) {
        this.viewer.entities.remove(this.#state.entity)
        let material = Cesium.Color.YELLOW.withAlpha(0.2)
        if (options.fill && options.color) {
          material = options.color
        }

        this.#state.entity = this.viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.CallbackProperty(() => {
              return new Cesium.PolygonHierarchy([...this.#state.cartesianStack, this.#state.currentCartesian])
            }, false),
            fill: options.fill || false,
            material,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              return [...this.#state.cartesianStack, this.#state.currentCartesian, this.#state.cartesianStack[0]]
            }, false),
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
      this.#state.entity.polyline.positions = [...this.#state.cartesianStack, this.#state.cartesianStack[0]]
      this.#state.entity.position = Cesium.BoundingSphere.fromPoints(this.#state.cartesianStack).center

      const coordinates = this.#state.cartesianStack.map(cartesian => {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        return [toDegrees(cartographic.longitude), toDegrees(cartographic.latitude)]
      })

      this.eventHandler.trigger('DRAW_ENTITY', {
        entity: this.#state.entity,
        type: FastGraphicsType.POLYGON,
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

  /**
   * 设置实体颜色
   * @param {Cesium.Entity} entity 实体
   * @param {{ outlineColor: Cesium.Color, fill: boolean, color: Cesium.Color }} options 选项
   * @returns 
   */
  setColor(entity, options) {
    if (!entity) {
      return
    }
    if (entity.properties.getValue().type === FastGraphicsType.POINT) {
      options.fill && (entity.point.outlineColor = options.outlineColor || Cesium.Color.BLUE)
      entity.point.color = options.color || Cesium.Color.YELLOW
    } else if (entity.properties.getValue().type === FastGraphicsType.RECTANGLE) {
      entity.rectangle.material = options.fill ? options.color : Cesium.Color.YELLOW.withAlpha(0.2)
      entity.polyline.material = options.outlineColor || Cesium.Color.LAWNGREEN
    } else if (entity.properties.getValue().type === FastGraphicsType.POLYGON) {
      entity.polygon.material = options.fill ? options.color : Cesium.Color.YELLOW.withAlpha(0.2)
      entity.polyline.material = options.outlineColor || Cesium.Color.LAWNGREEN
    }
  }
}

export default FastDraw;
