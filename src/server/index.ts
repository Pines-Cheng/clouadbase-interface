import { EventEmitter } from 'events'

import * as localProtocol from '../protocol.json'
import {
  IMessage,
  IMiddleware,
  IProtocol,
  IServerAdaptor,
  ISOptions
} from '../types'
import prepare from './api'
import { compose } from './compose'

const concat = require('lodash/concat')

class Server extends EventEmitter {
  protocol: IProtocol
  serverAdaptor: IServerAdaptor
  middlewares: IMiddleware[]

  constructor(options: ISOptions) {
    super()
    options.protocol = options.protocol || { domains: [] }
    this.protocol = this._mergeProtocol(options.protocol)
    this.serverAdaptor = options.serverAdaptor
    this.middlewares = []
    this._append()
  }

  _mergeProtocol(extProtocol: IProtocol): IProtocol {
    return { domains: concat(localProtocol.domains, extProtocol.domains) }
  }

  _onerror(err) {
    // When dealing with cross-globals a normal `instanceof` check doesn't work properly.
    // See https://github.com/koajs/koa/issues/1466
    // We can probably remove it once jest fixes https://github.com/facebook/jest/issues/2549.
    const isNativeError =
      Object.prototype.toString.call(err) === '[object Error]' ||
      err instanceof Error
    if (!isNativeError) throw new TypeError('non-error thrown:' + err)
  }

  use(fn: IMiddleware): this {
    if (typeof fn !== 'function') {
      throw new TypeError('middleware must be a function!')
    }
    this.middlewares.push(fn)
    return this
  }

  applyMiddleware(): void {
    const fnMiddleware = compose(this.middlewares)
    console.log(fnMiddleware)
    fnMiddleware(this).catch(this._onerror)
  }

  send(message: IMessage): void {
    this.serverAdaptor.send(JSON.stringify(message))
  }

  _handleMessage(message: IMessage): void {
    if (message.method) {
      this.emit(message.method, message)
    }
  }

  async _append(): Promise<void> {
    prepare(this, this.protocol)
    this.serverAdaptor.on('data', message => {
      this._handleMessage(JSON.parse(message))
    })
  }
}

export default Server
