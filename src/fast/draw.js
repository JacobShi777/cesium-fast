import * as Cesium from 'cesium'

import GraphicsType from '../constants/graphics'
import * as rectangleUtils from '../utils/rectangle'
import EventHandler from './EventHandler'
import EntityBuilder from '../utils/EntityBuilder'

const toDegrees = Cesium.Math.toDegrees;

class Draw {
  #state = {}
  #initState() {
    this.#state.handler && this.#state.handler.destroy()
    this.#state = {
      handler: undefined,
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
    let editable = false

    this.viewer = _this.viewer
    this.#initState()
    this.#setLeftClickEntityHandler()

    Object.defineProperty(this, 'editable', {
      get: () => editable,
      set: (value) => {
        editable = value
      },
    })
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
    this.#state.handler && this.#state.handler.destroy()
    this.#state.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.#state.handler.setInputAction((mouse) => {
      const ray = this.viewer.camera.getPickRay(mouse.position);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);

      if (!Cesium.defined(cartesian)) {
        return;
      }
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const longitude = toDegrees(cartographic.longitude);
      const latitude = toDegrees(cartographic.latitude);
      const entity = this.viewer.entities.add(EntityBuilder.point(cartesian, options))
      this.eventHandler.trigger('DRAW_ENTITY', {
        entity,
        type: GraphicsType.POINT,
        coordinates: [longitude, latitude]
      })
      this.#initState()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  #drawRectangle(options) {
    // 禁用旋转
    this.viewer.scene.screenSpaceCameraController.enableRotate = false

    this.#state.handler && this.#state.handler.destroy()
    this.#state.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.#state.handler.setInputAction((mouse) => {
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

    this.#state.handler.setInputAction((mouse) => {
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
        const rectangleCoordinates = new Cesium.CallbackProperty(() => {
          return Cesium.Rectangle.fromCartesianArray([this.#state.startCartesian, this.#state.currentCartesian])
        }, false)
        const polylinePositions = new Cesium.CallbackProperty(() => {
          return rectangleUtils.getPolylinePositionsByRectangleDiagonalPoint(this.#state.startCartesian, this.#state.currentCartesian, 'Cartesian')
        }, false)
        this.#state.entity = this.viewer.entities.add(EntityBuilder.rectangle(rectangleCoordinates, polylinePositions, options))
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#state.handler.setInputAction(() => {
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
      this.#initState()
      this.viewer.scene.screenSpaceCameraController.enableRotate = true
    }, Cesium.ScreenSpaceEventType.LEFT_UP)
  }

  #drawPolygon(options) {
    this.#state.handler && this.#state.handler.destroy()
    this.#state.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)

    this.#state.handler.setInputAction((mouse) => {
      const ray = this.viewer.camera.getPickRay(mouse.position);
      const globe = this.viewer.scene.globe;
      const cartesian = globe.pick(ray, this.viewer.scene);

      if (!Cesium.defined(cartesian)) {
        return;
      }
      this.#state.cartesianStack.push(cartesian)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    this.#state.handler.setInputAction((mouse) => {
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
        

        const polygonHierarchy = new Cesium.CallbackProperty(() => {
          return new Cesium.PolygonHierarchy([...this.#state.cartesianStack, this.#state.currentCartesian])
        }, false)
        const polylinePositions = new Cesium.CallbackProperty(() => {
          return [...this.#state.cartesianStack, this.#state.currentCartesian, this.#state.cartesianStack[0]]
        }, false)
        this.#state.entity = this.viewer.entities.add(EntityBuilder.polygon(polygonHierarchy, polylinePositions, options))
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    this.#state.handler.setInputAction((mouse) => {
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
        type: GraphicsType.POLYGON,
        coordinates
      })
      this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(this.#state.store['LEFT_DOUBLE_CLICK'], Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
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

  /**
   * 根据坐标添加实体
   * @param {*} coordinates - 坐标
   * @param {CesiumFast.GraphicsType} graphicsType - 图形类型
   * @param {*} options - 选项
   */
  addEntity(coordinates, graphicsType, options) {
    if (graphicsType === GraphicsType.POINT) {
      const position = Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1])
      this.viewer.entities.add(EntityBuilder.point(position, options))

    } else if (graphicsType === GraphicsType.RECTANGLE) {
      const rectangleCoordinates = Cesium.Rectangle.fromDegrees(coordinates[0][0], coordinates[1][1], coordinates[1][0], coordinates[0][1])
      const polylinePositions = rectangleUtils.getPolylinePositionsByRectangleDiagonalPoint(...coordinates)
      this.viewer.entities.add(EntityBuilder.rectangle(rectangleCoordinates, polylinePositions, options))

    } else if (graphicsType === GraphicsType.POLYGON) {
      const polygonHierarchy = new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(coordinates.reduce((acc, cur) => acc.concat(cur), [])))
      const polylinePositions = Cesium.Cartesian3.fromDegreesArray(coordinates.reduce((acc, cur) => acc.concat(cur), []))
      this.viewer.entities.add(EntityBuilder.polygon(polygonHierarchy, polylinePositions, options))
    }
  }
}

export default Draw;
