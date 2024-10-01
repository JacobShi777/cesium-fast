import * as Cesium from 'cesium'

import GraphicsType from '../constants/graphics';
import * as rectangleUtils from '../utils/rectangle'
import EventHandler from './EventHandler'

const toDegrees = Cesium.Math.toDegrees;

class FastDraw {
  #handler
  #state = {}
  #initState() {
    this.#state = {
      isDrawing: false,
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
    this.#initState()
    this.#setLeftClickEntityHandler()
  }

  // TODO 可能需要处理不是Entity的情况
  #setLeftClickEntityHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
    handler.setInputAction((event) => {
      if (this.#state.isDrawing) return

      // 如果没有注册LEFT_CLICK_ENTITY事件，则不处理
      if (!this.eventHandler.hasAction('LEFT_CLICK_ENTITY')) return
      
      const pickedObjects = this.viewer.scene.drillPick(event.position)
      this.eventHandler.trigger('LEFT_CLICK_ENTITY', pickedObjects.map(pickedObject => pickedObject.id))
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  /**
   * 绘制图形
   * @param { GraphicsType } graphicsType 图形类型
   * @param { { layer: string, outlineColor: Color, fill: boolean, color: Color, properties: Object.<string, *> } } options 选项
   * @param { function({ entity: Entity, coordinates: Array }): void } callback 回调函数
   */
  drawEntity(graphicsType, options) {
    if (!(graphicsType instanceof GraphicsType)) {
      throw new Error('graphicsType must be an instance of GraphicsType')
    }
    if (options) {
      if (!(options instanceof Object)) throw new Error('options must be an instance of Object')
      if (options.layer && typeof options.layer !== 'string') throw new Error('options.layer must be an instance of String')
      if (options.outlineColor && !(options.outlineColor instanceof Cesium.Color)) throw new Error('options.outlineColor must be an instance of Cesium.Color')
      if (options.fill && typeof options.fill !== 'boolean') throw new Error('options.fill must be an instance of Boolean')
      if (options.color && !(options.color instanceof Cesium.Color)) throw new Error('options.color must be an instance of Cesium.Color')
      if (options.properties && !(options.properties instanceof Object)) throw new Error('options.properties must be an instance of Object')
    }

    this.#state.isDrawing = true
    if (graphicsType === GraphicsType.POINT) {
      this.#drawPoint(options)

    } else if (graphicsType === GraphicsType.RECTANGLE) {
      this.#drawRectangle(options)

    } else if (graphicsType === GraphicsType.POLYGON) {
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
          type: GraphicsType.POINT,
          layer: options.layer || 'default',
          options,
          userProperties: options.properties,
        }
      })
      this.eventHandler.trigger('DRAW_ENTITY', {
        entity,
        type: GraphicsType.POINT,
        coordinates: [longitude, latitude]
      })
      this.#handler.destroy()
      this.#handler = undefined
      this.#initState()
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
              return rectangleUtils.getPolylinePositionsByRectangleDiagonalPoint(this.#state.startCartesian, this.#state.currentCartesian, 'Cartesian')
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
            type: GraphicsType.RECTANGLE,
            layer: options.layer || 'default',
            options,
            userProperties: options.properties,
          }
        })
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#handler.setInputAction(() => {
      this.#state.entity.rectangle.coordinates = Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
      this.#state.entity.polyline.positions = rectangleUtils.getPolylinePositionsByRectangleDiagonalPoint(this.#state.startCartesian, this.#state.currentCartesian, 'Cartesian')
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
        type: GraphicsType.RECTANGLE,
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
            type: GraphicsType.POLYGON,
            layer: options.layer || 'default',
            options,
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
      console.log(this.#state.cartesianStack)
      this.#state.entity.polygon.hierarchy = new Cesium.PolygonHierarchy(this.#state.cartesianStack)
      this.#state.entity.polyline.positions = [...this.#state.cartesianStack, this.#state.cartesianStack[0]]
      this.#state.entity.position = Cesium.BoundingSphere.fromPoints(this.#state.cartesianStack).center

      const coordinates = this.#state.cartesianStack.map(cartesian => {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        return [toDegrees(cartographic.longitude), toDegrees(cartographic.latitude)]
      })

      this.eventHandler.trigger('DRAW_ENTITY', {
        entity: this.#state.entity,
        type: GraphicsType.POLYGON,
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
   * @param {{ outlineColor: Cesium.Color, fill: boolean, color: Cesium.Color }} options 选项; 如果不传，则使用实体创建时的options
   * @returns 
   */
  setColor(entity, options) {
    if (!entity) {
      return
    }
    if (!options) {
      options = entity.properties.getValue().options
    }
    let material = Cesium.Color.YELLOW.withAlpha(0.2)
    if (options.fill && options.color) {
      material = options.color
    }
    if (entity.properties.getValue().type === GraphicsType.POINT) {
      entity.point.color = options.color || Cesium.Color.YELLOW
      options.fill && (entity.point.outlineColor = options.outlineColor || Cesium.Color.BLUE)
    } else if (entity.properties.getValue().type === GraphicsType.RECTANGLE) {
      entity.polyline.material = options.outlineColor || Cesium.Color.LAWNGREEN
      entity.rectangle.material = material
    } else if (entity.properties.getValue().type === GraphicsType.POLYGON) {
      entity.polyline.material = options.outlineColor || Cesium.Color.LAWNGREEN
      entity.polygon.material = material
    }
  }

  /**
   * 获取实体的属性(创建时传入的options.properties)
   * @param {Cesium.Entity} entity - 实体
   * @returns 
   */
  getProperties(entity) {
    if (!entity) return
    return entity.properties.getValue().userProperties
  }

  addEntity(coordinates, graphicsType, options) {
    if (graphicsType === GraphicsType.POINT) {
      this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
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
      })
    } else if (graphicsType === GraphicsType.RECTANGLE) {
      this.viewer.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(coordinates[0][0], coordinates[1][1], coordinates[1][0], coordinates[0][1]),
          fill: options.fill || false,
          material: options.color || Cesium.Color.YELLOW.withAlpha(0.2),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        polyline: {
          positions: rectangleUtils.getPolylinePositionsByRectangleDiagonalPoint(...coordinates),
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
      })
    } else if (graphicsType === GraphicsType.POLYGON) {
      this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(coordinates.reduce((acc, cur) => acc.concat(cur), []))),
          fill: options.fill || false,
          material: options.color || Cesium.Color.YELLOW.withAlpha(0.2),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(coordinates.reduce((acc, cur) => acc.concat(cur), [])),
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
      })
    }
  }
}

export default FastDraw;
