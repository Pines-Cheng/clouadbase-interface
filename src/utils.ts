import { isArray, mergeWith } from 'lodash'

import { IProtocol } from './types'

// 合并 protocol
export function mergeProtocol(...protocols: IProtocol[]): IProtocol {
  const mergedProtocol: IProtocol = { domains: [] }
  for (let i = 0; i < protocols.length; i++) {
    mergeWith(mergedProtocol, protocols[i], customizer)
  }
  return mergedProtocol
}

function customizer(objValue, srcValue) {
  if (isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

// 合并 middleware
