import {Disposable, Point, TextBuffer, TextEditor, CompositeDisposable} from 'atom'

declare global {

class UPI {
  public consume(options: any): Disposable
}

class UPIInstance {
  public menu: IUPIMenu
  public messages: IUPIMessages
  public events: IUPIEvents
  public tooltips: IUPITooltips
  public controls: IUPIControls
  public params: IUPIParams
  public utils: IUPIUtils
  public tooltipEvents: Set<TTooltipHandlerSpec>
}

}

declare interface IUPIMenu {
  /**
  Adds new sumbenu to 'Haskell IDE' menu item

  @param name -- submenu label, should be descriptive of a package
  @param menu -- Atom menu object

  @returns Disposable.
  */
  set(options: {label: string, menu: any[]}) : Disposable
}

declare interface IUPINormalStatus {
  status: 'ready' | 'error' | 'warning'
}

declare interface IUPIProgressStatus {
  status: 'progress'
  progress?: number
}

declare type IUPIStatus = (IUPINormalStatus | IUPIProgressStatus) & {detail: string}

declare interface IUPIMessageText {
  text: string
  highlighter?: string
}

declare interface IUPIMessageHTML {
  html: string
}

declare type TSeverity = 'error' | 'warning' | 'lint' | string
declare type TPosition = Point | [number, number] | {row: number, column: number}
declare type TUPIText = String | IUPIMessageText | IUPIMessageHTML

declare interface IUPIMessage {
  uri?: string
  position?: TPosition
  message: TUPIText
  severity: TSeverity
}

declare interface ISeverityTabDefinition {
  uriFilter?: boolean
  autoScroll?: boolean
}

declare interface IUPIMessages {
  /**
  Sets backend status
  @param status {Object}
    status: one of 'progress', 'ready', 'error', 'warning'
    progress: float between 0 and 1, only relevant when status is 'progress'
              if 0 or undefined, progress bar is not shown
  */
  status (status: IUPIStatus): void

  /**
  Add messages to ide-haskell output
  @param messages: {Array<Object>}
    uri: String, File URI message relates to
    position: Point, or Point-like Object, position to which message relates
    message: String or {<text | html>, highlighter?}, message
    severity: String, one of 'error', 'warning', 'lint', 'build',
              or user-defined, see `setMessageTypes`
  @param types: Array of String, containing possible message `severity`. If undefined,
         will be taken from `messages`
  */
  add (messages: IUPIMessage[], types: TSeverity[]): void

  /**
  Set messages in ide-haskell output. Clears all existing messages with
  `severity` in `types`
  messages: Array of Object
    uri: String, File URI message relates to
    position: Point, or Point-like Object, position to which message relates
    message: String, message
    severity: String, one of 'error', 'warning', 'lint', 'build',
              or user-defined, see `setMessageTypes`
  types: Array of String, containing possible message `severity`. If undefined,
         will be taken from `messages`
  */
  set(messages: IUPIMessage[], types: TSeverity[]): void

  /**
  Clear all existing messages with `severity` in `types`
  This is shorthand from `setMessages([],types)`
  */
  clear (types: TSeverity[]): void

  /**
  Set possible message `severity` that your package will use.
  types: Object with keys representing possible message `severity` (i.e. tab name)
         and values being Objects with keys
    uriFilter: Bool, should uri filter apply to tab?
    autoScroll: Bool, should tab auto-scroll?

  This allows to define custom output panel tabs.
  */
  setTypes (types: {[severity: string]: ISeverityTabDefinition}): void
}

declare type TextBufferCallback = (buffer: TextBuffer) => void

declare interface IUPIEvents {
  /**
  Convenience function. Will fire before Haskell buffer is saved.

  callback: callback(buffer)
    buffer: TextBuffer, buffer that generated event

  @returns {Disposable}
  */
  onWillSaveBuffer (callback: TextBufferCallback): Disposable

  /**
  Convenience function. Will fire after Haskell buffer is saved.

  callback: callback(buffer)
    buffer: TextBuffer, buffer that generated event

  @returns {Disposable}
  */
  onDidSaveBuffer(callback: TextBufferCallback): Disposable

  /**
  Convenience function. Will fire after Haskell buffer has stopped changing for
  some fraction of a second (usually 300 ms).

  callback: callback(buffer)
    buffer: TextBuffer, buffer that generated event

  @returns {Disposable}
  */
  onDidStopChanging(callback: TextBufferCallback): Disposable
}
declare interface IShowTooltipParams {
  editor: TextEditor
  pos: TPosition
  eventType: TEventRangeType
  detail: any
  tooltip: TTooltipFunction
}
declare type TTooltipFunction = (crange: Range) => ITooltipData | Promise<ITooltipData>
declare interface ITooltipData {
  range: Range
  text: TUPIText
  persistOnCursorMove?: boolean
}
declare type TTooltipHandler = (editor: TextEditor, crange: Range, type: TEventRangeType) => ITooltipData | Promise<ITooltipData>
declare interface IUPITooltips {
  /**
  Show tooltip in editor.

  editor: editor that will show tooltip
  pos: tooltip position
  eventType: one of 'context', 'keyboard' and 'mouse'
  detail: for automatic selection between 'context' and 'keyboard'.
          Ignored if 'eventType' is set.
  tooltip: function(crange)
    crange: Range, currently selected range in editor (possibly empty)

    Returns {range, text} or Promise
      range: Range, tooltip highlighting range
      persistOnCursorMove: Boolean, optional, default false, persist on cursor move regardless of settings
      text: tooltip text. String or {text, highlighter} or {html}
        text: tooltip text
        highlighter: grammar scope that will be used to highlight tooltip text
        html: html to be displayed in tooltip
  */
  show (params: IShowTooltipParams): void

  /**
  Editor event subscription. Fires when mouse cursor stopped over a symbol in
  editor.

  priority: event priority, higher value means higher priority,
            subscription with hightest priority will be called first.
  callback: callback(editor, crange, type)
    editor: TextEditor, editor that generated event
    crange: Range, cursor range that generated event.
    type: One of 'mouse', 'selection' -- type of event that triggered this

    Returns {range, text} or Promise.
      range: Range, tooltip highlighting range
      text: tooltip text. String or {text, highlighter} or {html}
        text: tooltip text
        highlighter: grammar scope that will be used to highlight tooltip text
        html: html to be displayed in tooltip

  returns Disposable
  */
  onShouldShowTooltip (priority: number, handler: TTooltipHandler): Disposable
  onShouldShowTooltip (handler: TTooltipHandler): Disposable
}
declare interface IControlOpts {
  id: string
  events: {[key: string]: Function}
  classes: string[]
  style: {[key: string]: string}
  attrs: {[key: string]: string}
}
declare interface IUPIControlDefinition {
  element: string | HTMLElement
  opts: IControlOpts
}
declare interface IUPIControls {
  /**
  Add a new control to ouptut panel heading.

  element: HTMLElement of control, or String with tag name
  opts: various options
    id: String, id
    events: Object, event callbacks, key is event name, e.g. "click",
            value is callback
    classes: Array of String, classes
    style: Object, css style, keys are style attributes, values are values
    attrs: Object, other attributes, keys are attribute names, values are values
    before: String, CSS selector of element, that this one should be inserted
            before, e.g. '#progressBar'

  Returns Disposable.
  */
  add (def: IUPIControlDefinition): Disposable
}
declare interface IParamSpec<T> {
  onChanged: (value: T) => void
  items: Array<T> | (() => Array<T>)
  itemTemplate: (item: T) => String
  itemFilterKey: string
  description?: string
  displayName?: string
  displayTemplate: (item: T) => String
  default: T
}
declare interface IUPIParams {
  /**
  addConfigParam
    param_name:
      onChanged: callback void(value)
      items: Array or callback Array(void)
      itemTemplate: callback, String(item), html template
      itemFilterKey: String, item filter key
      description: String [optional]
      displayName: String [optional, capitalized param_name default]
      displayTemplate: callback, String(item), string template
      default: item, default value

  Returns
    disp: Disposable
    change: object of change functions, keys being param_name
  */
  add (spec: {[param_name: string]: IParamSpec<any>}): Disposable

  /**
  getConfigParam(paramName) or getConfigParam(pluginName, paramName)

  returns a Promise that resolves to parameter
  value.

  Promise can be rejected with either error, or 'undefined'. Latter
  in case user cancels param selection dialog.
  */
  get<T> (plugin: string, name: string): Promise<T>
  get<T> (name: string): Promise<T>

  /**
  setConfigParam(paramName, value) or setConfigParam(pluginName, paramName, value)

  value is optional. If omitted, a selection dialog will be presented to user.

  returns a Promise that resolves to parameter value.

  Promise can be rejected with either error, or 'undefined'. Latter
  in case user cancels param selection dialog.
  */
  set<T> (plugin: string, name: string, value?: T): Promise<T>
  set<T> (name: string, value?: T): Promise<T>
}
declare type TEventRangeType = 'keyboard' | 'context' | 'mouse' | 'selection'
declare interface IEventRangeParams {
  editor: TextEditor
  detail?: any
  eventType: TEventRangeType
  pos: TPosition
  controller: undefined
}
declare type TEventRangeCallback<T> = (pars: {pos: Point, crange: Range}, eventType: TEventRangeType) => T
declare interface IUPIUtils {
  /**
  Utility function to extract event range/type for a given event

  editor: TextEditor, editor that generated event
  detail: event detail, ignored if eventType is set
  eventType: String, event type, one of 'keyboard', 'context', 'mouse'
  pos: Point, or Point-like Object, event position, can be undefined
  controller: leave undefined, this is internal field

  callback: callback({pos, crange}, eventType)
    pos: Point, event position
    crange: Range, event range
    eventType: String, event type, one of 'keyboard', 'context', 'mouse'
  */
  withEventRange<T>(params: IEventRangeParams, callback: TEventRangeCallback<T>): T | undefined
}
declare type TTooltipHandlerSpec = {priority: number, handler: TTooltipHandler}
