var http = require('http')
var sockjs = require('sockjs')
var Server = require('../dist/server').default
var pty = require('../dist/middleware/node-pty').default

var echo = sockjs.createServer()

echo.on('connection', function(conn) {
  conn.on('close', function() {
    console.log('close')
  })

  const serverAdaptor = {
    on: conn.on.bind(conn),
    send: conn.write.bind(conn)
  }
  // console.log(conn)
  const server = new Server({ serverAdaptor })
  server.use(pty())
  server.applyMiddleware()
  // DOM
  const { DOM } = server
  DOM.setChildNodes({ from: 'server setChildNodes1' })
  DOM.setChildNodes({ from: 'server setChildNodes2' })
  DOM.enable(params => {
    console.log('recive:', params)
  })
  DOM.focus(params => {
    console.log('recive:', params)
    return { focus: 1 }
  })
  DOM.getDocument(params => {
    console.log('recive:', params)
    return { getDocument: 1 }
  })
})

var server = http.createServer()
echo.installHandlers(server, { prefix: '/echo' })
server.listen(9999, '0.0.0.0')
