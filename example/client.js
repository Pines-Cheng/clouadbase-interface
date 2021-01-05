import 'xterm/css/xterm.css'

import { Terminal } from 'xterm'
import { WebLinksAddon } from 'xterm-addon-web-links'
// import { FitAddon } from 'xterm-addon-fit'

const getClient = require('../dist/client').default

console.log(getClient)

function initTerminal(id) {
  const terminal = new Terminal()
  terminal.loadAddon(new WebLinksAddon())
  // terminal.loadAddon(new FitAddon())
  terminal.open(document.getElementById(id))
  terminal.setOption('theme', { background: '#16171C' })
  terminal.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ')
  terminal.onData(data => {
    console.log(data)
  })
  return terminal
}

async function example() {
  let client
  try {
    // connect to endpoint
    client = await getClient({ host: '127.0.0.1', port: 9999, path: '/echo' })
    console.log(client)
    // extract domains
    const { DOM, Shell } = client
    const terminal1 = initTerminal('terminal')
    const terminal2 = initTerminal('terminal2')

    // setup handlers
    DOM.setChildNodes(params => {
      console.log('event:', params)
    })
    // enable events then start!
    // await DOM.enable({ test: 1 }, result => console.log('result:', result))
    const res1 = await DOM.enable({ test: 1 })
    console.log(res1)
    const res2 = await DOM.focus()
    console.log(res2)
    const res3 = await DOM.getDocument()
    console.log(res3)
    // Shell
    Shell.logReceived(({ commandId, log }) => {
      if (commandId === 1) {
        terminal1.write(log)
      }
    })
    Shell.logReceived(({ commandId, log }) => {
      if (commandId === 2) {
        terminal2.write(log)
      }
    })
    await Shell.exec({ commandId: 1, command: 'ls -al\r' })
    await Shell.exec({ commandId: 2, command: 'yarn\r' })
    await Shell.exec({ commandId: 1, command: 'yarn\r' })
  } catch (err) {
    console.error(err)
  } finally {
    if (client) {
      // await client.close(() => console.log('closed'))
    }
  }
}

example()
