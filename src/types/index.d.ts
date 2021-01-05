import { EventEmitter } from 'events'
import { Connection } from 'sockjs'

export type CallbackFunctionVariadic = (...args: any[]) => void

export interface IDomain {
  domain?: string
  types?: Record<string, unknown>[]
  commands?: Record<string, unknown>[]
  events?: Record<string, unknown>[]
}

export interface ICOptions {
  host?: string
  port?: number
  path?: string
  url?: string
  secure?: boolean
  local?: boolean
  protocol: IProtocol
  _notifier?: EventEmitter
}

export interface ISOptions {
  serverAdaptor: IServerAdaptor
  protocol: IProtocol
}

export interface IServerAdaptor {
  on(event: 'data', listener: (message: string) => any): Connection

  on(event: 'close', listener: () => void): Connection

  on(event: string, listener: Function): Connection

  send(buffer: Uint8Array | string, cb?: (err?: Error | null) => void): boolean

  send(
    str: string,
    encoding?: BufferEncoding,
    cb?: (err?: Error | null) => void
  ): boolean
}

export interface IMessage {
  id?: number
  method: string
  params: Record<string, unknown>[]
  error?: {
    code: number
    message: string
  }
  result?: Record<string, unknown>[]
}

export interface IProtocol {
  domains: IDomain[]
}

export type IMiddleware = (ctx: any, next: any) => Promise<void>
