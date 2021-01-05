import { EventEmitter } from 'events'

import {
  CallbackFunctionVariadic,
  ICOptions,
  IMessage,
  IProtocol
} from '../types'
import * as config from '../config/defaults.json'
import * as localProtocol from '../protocol.json'
import prepare from './api'

const concat = require('lodash/concat')
const SockJS = require('sockjs-client')

class ProtocolError extends Error {
  request: any
  response: any

  constructor(request, response) {
    let { message } = response
    if (response.data) {
      message += ` (${response.data})`
    }
    super(message)
    // attach the original response as well
    this.request = request
    this.response = response
  }
}

class Client extends EventEmitter {
  host: string
  port: number
  path: string
  secure: boolean
  local: boolean
  wsUrl: string
  _nextCommandId: number
  protocol: IProtocol
  _notifier: EventEmitter
  _callbacks: Record<number, CallbackFunctionVariadic>
  _ws: any

  constructor(options: ICOptions, notifier: EventEmitter) {
    super()
    options = options || {}
    this.host = options.host || config.HOST
    this.port = options.port || config.PORT
    this.path = options.path || config.PATH
    this.secure = options.secure || false
    options.protocol = options.protocol || { domains: [] }
    this.protocol = this._mergeProtocol(options.protocol)
    this.local = options.local || false
    this.wsUrl = this._getWsUrl(options.url || '') // url first
    this._notifier = notifier
    this._nextCommandId = 1
    this._callbacks = {}
    this._start()
  }

  send(
    method: string,
    params,
    callback: CallbackFunctionVariadic
  ): Promise<any> | null {
    if (typeof params === 'function') {
      callback = params
      params = undefined
    }
    // return a promise when a callback is not provided
    if (typeof callback === 'function') {
      this._enqueueCommand(method, params, callback)
      return null
    } else {
      return new Promise((fulfill, reject) => {
        this._enqueueCommand(method, params, (error, response) => {
          if (error) {
            const request = { method, params }
            reject(
              error instanceof Error
                ? error // low-level WebSocket error
                : new ProtocolError(request, response)
            )
          } else {
            fulfill(response)
          }
        })
      })
    }
  }

  close(callback: CallbackFunctionVariadic) {
    const closeWebSocket = callback => {
      // don't close if it's already closed
      if (this._ws.readyState === 3) {
        callback()
      } else {
        this._ws.close()
        callback()
      }
    }
    if (typeof callback === 'function') {
      closeWebSocket(callback)
      return undefined
    } else {
      return new Promise((fulfill, reject) => {
        closeWebSocket(fulfill)
      })
    }
  }

  async _start(): Promise<void> {
    try {
      prepare(this, this.protocol)
      await this._connectToWebSocket()
      this._notifier.emit('connect', this)
    } catch (err) {
      this._notifier.emit('error', err)
    }
  }

  // send a command to the remote endpoint and register a callback for the reply
  _enqueueCommand(
    method: string,
    params: any,
    callback: CallbackFunctionVariadic
  ): void {
    const id = this._nextCommandId++
    const message = {
      id,
      method,
      params: params || {}
    }
    try {
      this._ws.send(JSON.stringify(message))
    } catch (e) {
      if (typeof callback === 'function') {
        callback(e)
      }
    }
    this._callbacks[id] = callback
  }

  _getWsUrl(url: string): string {
    // a WebSocket URL is specified by the user (e.g., node-inspector)
    if (url.match(/^http?:/i)) {
      return url // done!
    } else {
      // use default host and port if omitted (and a relative URL is specified)
      return `http://${this.host}:${this.port}${this.path}`
    }
  }

  _mergeProtocol(extProtocol: IProtocol): IProtocol {
    return { domains: concat(localProtocol.domains, extProtocol.domains) }
  }

  _connectToWebSocket(): Promise<void> {
    return new Promise((fulfill, reject) => {
      // create the WebSocket
      try {
        if (this.secure) {
          this.wsUrl = this.wsUrl.replace(/^http:/i, 'https:')
        }
        this._ws = new SockJS(this.wsUrl)
      } catch (err) {
        // handles bad URLs
        reject(err)
        return null
      }
      // set up event handlers
      this._ws.onopen = () => {
        fulfill()
      }
      this._ws.onmessage = e => {
        const message = JSON.parse(e.data)
        this._handleMessage(message)
      }
      this._ws.onclose = () => {
        this.emit('disconnect')
      }
      this._ws.onerror = err => {
        reject(err)
      }
    })
  }

  // handle the messages read from the WebSocket
  _handleMessage(message: IMessage): void {
    // command response
    if (message.id) {
      const callback: CallbackFunctionVariadic = this._callbacks[message.id]
      if (!callback) {
        return
      }
      // interpret the lack of both 'error' and 'result' as success
      // (this may happen with node-inspector)
      if (message.error) {
        callback(true, message.error)
      } else {
        callback(
          false,
          typeof message.result === 'undefined' ? {} : message.result
        )
      }
      // unregister command response callback
      delete this._callbacks[message.id]
      // notify when there are no more pending commands
      if (Object.keys(this._callbacks).length === 0) {
        this.emit('ready')
      }
      // eslint-disable-next-line brace-style
    }
    // event
    else if (message.method) {
      this.emit('event', message)
      this.emit(message.method, message.params)
    }
  }
}

export default Client
