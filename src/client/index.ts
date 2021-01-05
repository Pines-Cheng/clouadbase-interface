import { EventEmitter } from 'events'

import { CallbackFunctionVariadic, ICOptions } from '../types'
import Chrome from './client'

function getClient(
  options: ICOptions,
  callback?: CallbackFunctionVariadic
): EventEmitter | Promise<void> {
  if (typeof options === 'function') {
    callback = options
    // @ts-ignore
    options = undefined
  }
  const notifier = new EventEmitter()
  if (typeof callback === 'function') {
    // allow to register the error callback later
    setTimeout(() => {
      // eslint-disable-next-line no-new
      new Chrome(options, notifier)
    })
    return notifier.once('connect', callback)
  } else {
    return new Promise((fulfill, reject) => {
      notifier.once('connect', fulfill)
      notifier.once('error', reject)
      // eslint-disable-next-line no-new
      new Chrome(options, notifier)
    })
  }
}

export default getClient // CBP
