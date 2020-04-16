import { createHash } from 'crypto'
import { Directory } from 'atom'

export async function setupGhciWrapper() {
  const downloadUrl =
    'https://github.com/atom-haskell/win-ghci-wrapper/releases/download/v0.0.2/ghci-wrapper.exe'
  const expectedDigest = '4663295d71a5057dee41945a52d39ed61fcd8830'
  try {
    atom.notifications.addInfo('GHCi Wrapper setup started...')
    const buf = await downloadFile(downloadUrl)
    checkHash(buf, expectedDigest)
    const filePath = await writeFile(buf)
    atom.config.set('ide-haskell-repl.ghciWrapperPath', filePath)
    atom.notifications.addSuccess('GHCi Wrapper setup finished!')
  } catch (e) {
    // tslint:disable-next-line: no-null-keyword
    if (e != null) {
      atom.notifications.addFatalError('GHCi wrapper setup failed', {
        stack: e.stack,
        detail: e.message,
        dismissable: true,
      })
    }
  }
}

async function downloadFile(url: string): Promise<Buffer> {
  const result = await window.fetch(url, {
    redirect: 'follow',
  })
  if (!result.ok) {
    atom.notifications.addError('Getting ghci-wrapper.exe failed', {
      detail: result.statusText,
      dismissable: true,
    })
    throw undefined
  }
  return Buffer.from(await result.arrayBuffer())
}

function checkHash(buf: Buffer, expected: string): void {
  const hash = createHash('sha1')
  hash.update(buf)
  const digest = hash.digest('hex')
  if (digest !== expected) {
    atom.notifications.addError(
      'Got ghci-wrapper.exe, but hash check failed!',
      {
        detail: `Expected ${expected} but got ${digest}`,
        dismissable: true,
      },
    )
    throw undefined
  }
}

async function writeFile(buf: Buffer): Promise<string> {
  const configDir = new Directory(atom.getConfigDirPath())
  const subdir = configDir.getSubdirectory('ide-haskell-repl')
  if (!(await subdir.exists())) {
    if (!(await subdir.create())) {
      atom.notifications.addError(
        'Failed to create directory for ghci-wrapper',
        {
          detail: subdir.getPath(),
          dismissable: true,
        },
      )
      throw undefined
    }
  }
  const file = subdir.getFile('ghci-wrapper.exe')
  const stream = file.createWriteStream()
  try {
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject)
      stream.write(buf, (error) => {
        stream.off('error', reject)
        // tslint:disable-next-line: no-null-keyword
        if (error != null) reject(error)
        else resolve()
      })
    })
  } finally {
    stream.close()
  }
  return file.getPath()
}
