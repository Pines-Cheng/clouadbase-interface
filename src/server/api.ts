/*
  parse protocol domains to object method
*/

import { IProtocol } from '../types'

function arrayToObject(parameters) {
  const keyValue = {}
  parameters.forEach(parameter => {
    const name = parameter.name
    delete parameter.name
    keyValue[name] = parameter
  })
  return keyValue
}

function decorate(to, category, object) {
  to.category = category
  Object.keys(object).forEach(field => {
    // skip the 'name' field as it is part of the function prototype
    if (field === 'name') {
      return
    }
    // commands and events have parameters whereas types have properties
    // eslint-disable-next-line no-mixed-operators
    if (
      (category === 'type' && field === 'properties') ||
      field === 'parameters'
    ) {
      to[field] = arrayToObject(object[field])
    } else {
      to[field] = object[field]
    }
  })
}

function addCommand(chrome, domainName, command) {
  const handler = params => {
    return chrome.send({
      method: `${domainName}.${command.name}`,
      params: params || {}
    })
  }
  decorate(handler, 'command', command)
  chrome[domainName][command.name] = handler
}

function addEvent(chrome, domainName, event) {
  const eventName = `${domainName}.${event.name}`
  const handler = handler => {
    chrome.on(eventName, async message => {
      const { id, method, params = {} } = message
      try {
        const result = await handler(params)
        chrome.send({
          id,
          method,
          result: typeof result === 'undefined' ? {} : result
        })
      } catch (e) {
        chrome.send({
          id,
          error: {
            code: 32000,
            message: method + ' : ' + e.message
          }
        })
      }
    })
  }
  decorate(handler, 'event', event)
  chrome[domainName][event.name] = handler
}

function addType(chrome, domainName, type) {
  const help = {}
  decorate(help, 'type', type)
  chrome[domainName][type.id] = help
}

function prepare(object: any, protocol: IProtocol): void {
  // assign the protocol and generate the shorthands
  object.protocol = protocol
  protocol.domains.forEach(domain => {
    const domainName = domain.domain || ''
    object[domainName] = {}
    // add commands
    ;(domain.events || []).forEach(command => {
      addCommand(object, domainName, command)
    })
    // add events
    ;(domain.commands || []).forEach(event => {
      addEvent(object, domainName, event)
    })
    // add types
    ;(domain.types || []).forEach(type => {
      addType(object, domainName, type)
    })
  })
}

export default prepare
