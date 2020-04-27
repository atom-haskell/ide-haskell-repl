import * as UPI from 'atom-haskell-upi'

export function handlePromise(somePromise: Promise<any>): void {
  somePromise.catch((e: Error) => {
    atom.notifications.addFatalError(e.name, {
      detail: e.message,
      stack: e.stack,
    })
  })
}

export function getText(m: UPI.TMessage): string {
  if (typeof m === 'string') {
    return m
  } else {
    if ('text' in m) return m.text
    else return m.html
  }
}
