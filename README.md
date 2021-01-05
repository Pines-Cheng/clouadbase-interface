# cloudbase-interface

借鉴了 Chrome DevTools Protocol 和定义、使用及生态，设计了**基于 Websocket 的 JSON RPC 协议规范和及 API**。

主要包括：

1. 协议：Taro CloudBase Protocol
2. 接口：cloudbase-interface（分为 client 和 server）

### 使用

#### 前端

参考 [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) 进行封装，接口优雅，异步编程。

```js
async function example() {
  let client
  try {
    // connect to endpoint
    client = await getClient({ host: '127.0.0.1', port: 9999, path: '/echo' })
    console.log(client)
    // extract domains
    const { DOM } = client
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
  } catch (err) {
    console.error(err)
  } finally {
    if (client) {
      await client.close(() => console.log('closed'))
    }
  }
}

example()
```

#### 服务端

和前端类似，连接接口改为启动服务，然后解析协议，绑定对应事件即可。

每个 domain 只有 接收到 `domain.enable` 命令时才绑定该 domain 对应的事件。(待实现)

不管后端使用什么 websocket 框架，只需要提供：serverAdaptor 接口即可。

```js
var http = require('http')
var sockjs = require('sockjs')
var Server = require('../dist/server').default

var echo = sockjs.createServer()

echo.on('connection', function(conn) {
  conn.on('close', function() {
    console.log('close')
  })

  const serverAdaptor = {
    on: conn.on.bind(conn),
    send: conn.write.bind(conn)
  }
  const server = new Server({ serverAdaptor })
  const { DOM } = server
  DOM.setChildNodes({ from: 'server setChildNodes1' }) // 服务端发送
  DOM.setChildNodes({ from: 'server setChildNodes2' })
  DOM.enable(params => {
    console.log('recive:', params)
  })
  DOM.focus(params => {
    // 服务端监听，返回值为
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
```

### 服务端中间件

定义

```js
export default function(options = defaultOption) {
  return async (ctx, next) => {
    await new Promise((resolve, reject) => {
      const { Shell } = ctx
      Shell.exec(({ commandId, command }) => {
        const ptyProcess = getPtyProcess(options)

        ptyProcess.write(command)

        ptyProcess.on('data', function(data) {
          process.stdout.write(data)
          Shell.logReceived({
            commandId: commandId,
            log: data
          })
        })
      })

      resolve()
    })
    await next()
  }
}
```

使用

```js
import middlewarePty from '@o2team/cloudbase-interface/dist/middleware/node-pty'

server.use(middlewarePty())
server.use(middlewareDashboard())

server.applyMiddleware()
```

## 详细设计协议

### 协议定义

参考 devtools-frontend 使用 JSON 定义。

- 协议定义：[`devtools_protocol/browser_protocol.json`](https://github.com/ChromeDevTools/devtools-frontend/blob/master/third_party/blink/public/devtools_protocol/browser_protocol.json)
- 协议文档：[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol)

TS 类型文件也是通过脚本读取 JSON 文件生成的：[protocol_dts_generator.ts ](https://github.com/ChromeDevTools/devtools-frontend/blob/719446c0dbbd09dac06fc58c50f5c7b48315ed54/scripts/protocol_typescript/protocol_dts_generator.ts)

**简单概览：**

```json
{
  "domain": "DOM",
  "description": "This domain exposes DOM read/write operations",
  "dependencies": ["Runtime"],
  "types": [
    {
      "id": "NodeId",
      "description": "Unique DOM node identifier.",
      "type": "integer"
    }
  ],
  "commands": [
    {
      "name": "getAttributes",
      "description": "Returns attributes for the specified node.",
      "parameters": [
        {
          "name": "nodeId",
          "description": "Id of the node to retrieve attibutes for.",
          "$ref": "NodeId"
        }
      ],
      "returns": [
        {
          "name": "attributes",
          "description": "An interleaved array of node attribute names and values.",
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ]
    }
  ],
  "events": [
    {
      "name": "childNodeRemoved",
      "description": "Mirrors `DOMNodeRemoved` event.",
      "parameters": [
        {
          "name": "parentNodeId",
          "description": "Parent id.",
          "$ref": "NodeId"
        },
        {
          "name": "nodeId",
          "description": "Id of the node that has been removed.",
          "$ref": "NodeId"
        }
      ]
    }
  ]
}
```

**关键字解析：**

- domain：协议内容分为若干域 Domain(DOM、Debugger、Network 等)。每个域定义了它所支持的许多命令（commands）和它所生成的事件（events）。命令和事件都是固定结构的序列化 JSON 对象。
- experimental：是否试验性
- description：描述
- dependencies：依赖
- types：Cmmand 和 Event 中涉及到的数据类型的定义
- commands：如同一个异步调用，通过请求的信息，获取相应的返回结果。这样的通讯必然有一个 message id，否则两方都无法正确的判断请求和返回的匹配状况。
- events：用于由一方单方面的通知另一方某个信息。

**Command / Event 命名规范：**

1. 动作：enable、disable、focus
2. 动词+名词：getAttributes、highlightNode、removeNode、copyTo、

### 协议示例

```
🔝{"id":1,"method":"Network.enable","params":{"maxPostDataSize":65536}}
🔝{"id":2,"method":"Page.enable"}
🔝{"id":3,"method":"Page.getResourceTree"}
🔝{"id":4,"method":"Runtime.enable"}
🔝{"id":5,"method":"Profiler.enable"}
🔝{"id":6,"method":"Debugger.enable","params":{"maxScriptsCacheSize":10000000}}
🔝{"id":9,"method":"DOM.enable"}
🔝{"id":10,"method":"CSS.enable"}
⬇️{"method":"Target.attachedToTarget","params":{"sessionId":"93AFA6399DA8A8623D82C166AF8094A2","targetInfo":{"targetId":"9F45931CC38889806267A00B8BB40478","type":"iframe","title":"chrome-extension://react-perf/devtools.html","url":"chrome-extension://react-perf/devtools.html","attached":true,"browserContextId":"35183A5B763F607EACECFD0BBA9421A0"},"waitingForDebugger":false}}
🔝{"id":29,"method":"Page.getResourceTree","sessionId":"93AFA6399DA8A8623D82C166AF8094A2"}
⬇️{"id":1,"result":{}}
⬇️{"id":2,"result":{}}
⬇️{"id":3,"result":{"frameTree":{"frame":{"id":"1071A0A3CD4026CF3910F3BCF58D1171","loaderId":"AF4B4B66A0E7C141C845309F85599A47","url":"devtools://devtools/bundled/devtools_app.html?remoteBase=https://chrome-devtools-frontend.appspot.com/serve_file/@36cc3c133da6270352f9b7ccb712eeacee0dd458/&can_dock=true&toolbarColor=rgba(223,223,223,1)&textColor=rgba(0,0,0,1)&experiments=true","securityOrigin":"devtools://devtools","mimeType":"text/html"},"resources":[{"url":"devtools://devtools/bundled/devtools_app.js","type":"Script","mimeType":"application/javascript","contentSize":195937},{"url":"devtools://devtools/bundled/Images/largeIcons.svg","type":"Image","mimeType":"image/svg+xml","contentSize":20597},{"url":"devtools://devtools/bundled/Images/treeoutlineTriangles.svg","type":"Image","mimeType":"image/svg+xml","contentSize":120},{"url":"devtools://devtools/bundled/Images/smallIcons.svg","type":"Image","mimeType":"image/svg+xml","contentSize":15394},{"url":"devtools://devtools/bundled/shell.js","type":"Script","mimeType":"application/javascript","contentSize":195282}]}}}
⬇️{"method":"CSS.mediaQueryResultChanged","params":{},"sessionId":"93AFA6399DA8A8623D82C166AF8094A2"}
```

#### error

```
⬇️{"error":{"code":-32000,"message":"Not supported"},"id":20}
```

## TODO

1. 基于 Types 做类型校验

## 参考

- [ChromeDevTools/devtools-protocol](https://github.com/chromedevtools/devtools-protocol)
- [ChromeDevTools/devtools-protocol 类型定义](https://github.com/ChromeDevTools/devtools-protocol/tree/master/types)
- [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface/)
- [chrome-remote-interface 使用场景](https://github.com/cyrus-and/chrome-remote-interface/wiki)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
