export function handlePromise(somePromise: Promise<any>): void {
  somePromise.catch((e: Error) => {
    atom.notifications.addFatalError(e.name, {
      detail: e.message,
      stack: e.stack,
    })
  })
}
