class EventHandler {
  events = {}
  actionTypes = new Set()

  /**
   * 
   * @param {Array.<string>} actionTypes 
   */
  constructor(actionTypes) {
    actionTypes.some(actionType => {
      if (typeof actionType !== 'string') {
        throw new Error('Action type must be a string')
      }
    })
    this.actionTypes = new Set(actionTypes)
  }

  setAction(callback, actionType) {
    if (!this.actionTypes.has(actionType)) {
      throw new Error(`Action type ${actionType} is not supported. Supported action types are ${Array.from(this.actionTypes).join(', ')}`)
    }
    this.events[actionType] = callback
  }

  getAction(actionType) {
    return this.events[actionType]
  }

  removeAction(actionType) {
    delete this.events[actionType]
  }

  trigger(actionType, ...args) {
    if (this.events[actionType]) {
      this.events[actionType](...args)
    }
  }
}

export default EventHandler
