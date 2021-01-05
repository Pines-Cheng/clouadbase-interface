import { spawn } from 'node-pty'

const defaultOption = {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  }
}

const getDefaultShell = () => {
  if (process.platform === 'darwin') {
    return process.env.SHELL || '/bin/bash'
  }

  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/sh'
}

// TODO 先单终端进行着吧
function getPtyProcess(options) {
  let ptyProcess
  const defaultShell = getDefaultShell()
  if (process.cwd() !== options.cwd) {
    ptyProcess = spawn(defaultShell, [], options)
  }
  if (!ptyProcess) {
    ptyProcess = spawn(defaultShell, [], options)
  }
  return ptyProcess
}

export default function(options = defaultOption) {
  return async (ctx, next): Promise<void> => {
    await new Promise((resolve, reject) => {
      const { Shell } = ctx
      Shell.exec(({ commandId, command, cwd }) => {
        if (cwd) {
          options.cwd = cwd
        }
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
